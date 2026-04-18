"""
Rule-based pricing engine with 6 multipliers + Qdrant kNN market reference.
No ML training required — uses pricing_kb.yaml as the knowledge base.
"""

import os
import yaml
from datetime import datetime

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

    # Fallback by first word match
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
    return 0.82  # loại 2 default


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


async def calculate_price(
    product_name: str,
    grade: str,
    defects: list[str],
    certifications: list[str],
    freshness: str,
    embedding_service=None,
) -> dict:
    base_price, matched_key = _find_base_price(product_name, grade)

    gm = _grade_mult(grade)
    dm, dl = _defect_mult(defects)
    cm, cl = _cert_mult(certifications)
    sm, sl = _seasonal_mult(matched_key)
    fm, fl = _freshness_mult(freshness)

    rule_price = round(base_price * gm * dm * cm * sm * fm / 1000) * 1000

    similar_products: list[dict] = []
    market_avg: int | None = None

    if embedding_service:
        try:
            results = embedding_service.search(query=product_name, limit=8)
            similar_products = [
                {
                    "product_name": r["product_name"],
                    "price": int(r["price"]),
                    "score": r["score"],
                }
                for r in results
                if r.get("price", 0) > 0
            ]
            prices = [r["price"] for r in similar_products]
            if prices:
                market_avg = round(sum(prices) / len(prices) / 1000) * 1000
        except Exception:
            pass

    if market_avg and market_avg > 0:
        suggested = round((rule_price * 0.6 + market_avg * 0.4) / 1000) * 1000
        note = f"Kết hợp: {rule_price:,}đ (rule-based) + {market_avg:,}đ (thị trường)"
    else:
        suggested = rule_price
        note = f"Rule-based: {rule_price:,}đ (chưa có dữ liệu thị trường)"

    return {
        "suggested_price_per_kg": suggested,
        "breakdown": {
            "base_price": base_price,
            "grade": {"label": grade or "Loại 2", "multiplier": gm},
            "defect": {"label": dl, "multiplier": dm},
            "certification": {"label": cl, "multiplier": cm},
            "seasonal": {"label": sl, "multiplier": sm},
            "freshness": {"label": fl, "multiplier": fm},
        },
        "market": {
            "similar_products": similar_products,
            "market_avg": market_avg,
            "note": note,
        },
    }
