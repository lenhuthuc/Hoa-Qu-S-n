"""
Rule-based pricing engine with 6 multipliers + Qdrant kNN market reference.
No ML training required — uses pricing_kb.yaml as the knowledge base.
"""

import os
import yaml
from datetime import datetime

from models import PricingResult, PriceBreakdown, PriceMultiplier, MarketInfo, SimilarProduct

_KB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "pricing_kb.yaml")
_kb_cache: dict | None = None


def _load_kb() -> dict:
    global _kb_cache
    if _kb_cache is None:
        with open(_KB_PATH, encoding="utf-8") as f:
            _kb_cache = yaml.safe_load(f)
    return _kb_cache


def _find_base_price(product_name: str, grade: str) -> tuple[int, str]:
    kb = _load_kb()
    name_lower = product_name.lower().strip()
    grade_key = (grade or "Loại 2").lower()

    for key, data in kb.get("products", {}).items():
        if key in name_lower or name_lower in key:
            price = data["base_prices"].get(grade_key)
            if price is None:
                price = data["base_prices"].get("loại 2", 20000)
            return price, key

    first_word = name_lower.split()[0] if name_lower else ""
    for key, data in kb.get("products", {}).items():
        if first_word and first_word in key:
            price = data["base_prices"].get(grade_key, data["base_prices"].get("loại 2", 20000))
            return price, key

    return 20000, "unknown"


def _grade_mult(grade: str) -> float:
    g = (grade or "").lower()
    if "1" in g:
        return 1.0
    if "3" in g:
        return 0.60
    return 0.82


def _defect_mult(defects: list[str]) -> tuple[float, str]:
    if not defects:
        return 1.0, "Không có lỗi"
    m = 1.0
    labels = []
    joined = " ".join(defects).lower()
    if "dập" in joined:
        m *= 0.88
        labels.append("dập ×0.88")
    if "úng" in joined or "thối" in joined:
        m *= 0.70
        labels.append("úng/thối ×0.70")
    if "sâu" in joined:
        m *= 0.80
        labels.append("sâu ×0.80")
    if "vàng" in joined:
        m *= 0.85
        labels.append("vàng ×0.85")
    return round(m, 3), ", ".join(labels) if labels else "Không có lỗi"


def _cert_mult(certs: list[str]) -> tuple[float, str]:
    if not certs:
        return 1.0, "Không có chứng nhận"
    joined = " ".join(certs).upper()
    if "GLOBALGAP" in joined:
        return 1.25, "GlobalGAP ×1.25"
    if "ORGANIC" in joined or "HỮU CƠ" in joined:
        return 1.20, "Organic ×1.20"
    if "VIETGAP" in joined:
        return 1.10, "VietGAP ×1.10"
    return 1.0, ", ".join(certs)


def _seasonal_mult(product_key: str) -> tuple[float, str]:
    kb = _load_kb()
    month = datetime.now().month
    data = kb.get("seasonal_multipliers", {}).get(product_key)
    if not data:
        return 1.0, "Không có dữ liệu mùa vụ"
    if month in data.get("peak_months", []):
        return 0.88, f"Chính vụ tháng {month} ×0.88"
    if month in data.get("off_months", []):
        return 1.18, f"Trái vụ tháng {month} ×1.18"
    return 1.0, f"Mùa bình thường tháng {month}"


def _freshness_mult(freshness: str) -> tuple[float, str]:
    f = (freshness or "").lower()
    if "rất tươi" in f:
        return 1.08, "Rất tươi ×1.08"
    if "kém" in f:
        return 0.72, "Kém tươi ×0.72"
    if "bình thường" in f:
        return 0.90, "Bình thường ×0.90"
    return 1.0, "Tươi ×1.00"


def _build_feature_text(
    product_name: str,
    grade: str,
    freshness: str,
    defects: list[str],
    certifications: list[str],
    category: str = "",
) -> str:
    """Build rich feature text from all vision outputs for embedding search."""
    parts = [f"Sản phẩm: {product_name}"]
    if grade:
        parts.append(f"Chất lượng: {grade}")
    if freshness:
        parts.append(f"Độ tươi: {freshness}")
    if certifications:
        parts.append(f"Chứng nhận: {', '.join(certifications)}")
    if defects:
        parts.append(f"Khuyết tật: {', '.join(defects)}")
    else:
        parts.append("Không có khuyết tật")
    if category:
        parts.append(f"Loại: {category}")
    return ". ".join(parts)


_KNN_MIN_SAMPLES = 5  # kNN không đáng tin nếu ít hơn ngưỡng này


def _iqr_filter(items: list[SimilarProduct]) -> list[SimilarProduct]:
    """Loại outlier bằng IQR. Cần ít nhất 4 phần tử để có IQR có nghĩa."""
    if len(items) < 4:
        return items
    prices = sorted(p.price for p in items)
    n = len(prices)
    q1, q3 = prices[n // 4], prices[(3 * n) // 4]
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    cleaned = [p for p in items if lo <= p.price <= hi]
    return cleaned if len(cleaned) >= 3 else items


def _weighted_knn_avg(similar: list[SimilarProduct]) -> int | None:
    """
    Weighted average theo cosine score.
    Chỉ tính nếu đủ _KNN_MIN_SAMPLES mẫu sau IQR filter.
    """
    candidates = _iqr_filter([p for p in similar if p.price > 0 and p.score > 0])
    if len(candidates) < _KNN_MIN_SAMPLES:
        return None
    total_w = sum(p.score for p in candidates)
    raw = sum(p.price * p.score for p in candidates) / total_w
    return round(raw / 1000) * 1000


async def calculate_price(
    product_name: str,
    grade: str,
    defects: list[str],
    certifications: list[str],
    freshness: str,
    embedding_service=None,
    category: str = "",
) -> PricingResult:
    base_price, matched_key = _find_base_price(product_name, grade)

    gm = _grade_mult(grade)
    dm, dl = _defect_mult(defects)
    cm, cl = _cert_mult(certifications)
    sm, sl = _seasonal_mult(matched_key)
    fm, fl = _freshness_mult(freshness)

    rule_price = round(base_price * gm * dm * cm * sm * fm / 1000) * 1000

    similar_products: list[SimilarProduct] = []
    market_avg: int | None = None

    if embedding_service:
        try:
            feature_text = _build_feature_text(
                product_name, grade, freshness, defects, certifications, category
            )
            results = embedding_service.search(
                query=feature_text,
                limit=30,
                category=category or None,
            )
            similar_products = [
                SimilarProduct(
                    product_name=r["product_name"],
                    price=int(r["price"]),
                    score=r["score"],
                )
                for r in results
                if r.get("price", 0) > 0
            ]
            market_avg = _weighted_knn_avg(similar_products)
        except Exception:
            pass

    n_valid = len([p for p in similar_products if p.price > 0])
    if market_avg and market_avg > 0:
        suggested = round((rule_price * 0.6 + market_avg * 0.4) / 1000) * 1000
        note = f"{n_valid} sản phẩm tương tự (kNN weighted avg {market_avg:,}đ) + rule-based {rule_price:,}đ"
    else:
        suggested = rule_price
        reason = f"chỉ {n_valid} mẫu, cần ≥{_KNN_MIN_SAMPLES}" if n_valid else "Qdrant chưa có dữ liệu"
        note = f"Rule-based: {rule_price:,}đ ({reason})"

    return PricingResult(
        suggested_price_per_kg=suggested,
        breakdown=PriceBreakdown(
            base_price=base_price,
            grade=PriceMultiplier(label=grade or "Loại 2", multiplier=gm),
            defect=PriceMultiplier(label=dl, multiplier=dm),
            certification=PriceMultiplier(label=cl, multiplier=cm),
            seasonal=PriceMultiplier(label=sl, multiplier=sm),
            freshness=PriceMultiplier(label=fl, multiplier=fm),
        ),
        market=MarketInfo(
            similar_products=similar_products,
            market_avg=market_avg,
            note=note,
        ),
    )
