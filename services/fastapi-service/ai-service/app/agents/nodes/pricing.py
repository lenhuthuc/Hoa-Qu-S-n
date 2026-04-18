import re
import yaml
import os
import asyncio
from datetime import datetime
from typing import Dict, Any

from app.agents.state import PostGenState

_KB_PATH = os.path.join(os.path.dirname(__file__), "../../data/pricing_kb.yaml")
_kb_cache: dict | None = None

# Giá VND dạng: 45.000 / 45,000 / 45000 / 45k
_PRICE_RE = re.compile(
    r'(\d{1,3}(?:[.,]\d{3})+|\b\d{4,6}\b)\s*(?:đ|vnđ|vnd|đồng|k\b)?',
    re.IGNORECASE,
)

# Các từ chỉ đơn vị bán lô/buôn — nếu xuất hiện gần giá thì bỏ qua
_BULK_UNITS = re.compile(
    r'\b(tấn|tạ|thùng|bao|lô|pallet|xe|container|tải|kiện|sọt)\b',
    re.IGNORECASE,
)

# Từ chỉ rõ đây là giá bán lẻ / kg — ưu tiên kết quả có từ này
_RETAIL_SIGNALS = re.compile(
    r'\b(kg|kilogram|1\s*kg|bán lẻ|giá lẻ|đồng/kg|đ/kg|vnd/kg)\b',
    re.IGNORECASE,
)


def _load_kb() -> dict:
    global _kb_cache
    if _kb_cache is None:
        with open(_KB_PATH, encoding="utf-8") as f:
            _kb_cache = yaml.safe_load(f)
    return _kb_cache


async def base_price(state: PostGenState) -> Dict[str, Any]:
    vision = state["vision_result"]
    product_name = vision.get("product_name", "").lower()
    grade = vision.get("grade", "Loại 2").lower()

    kb = _load_kb()
    bp = 30_000

    for prod, grades in kb.get("products", {}).items():
        if prod in product_name or product_name.split()[0] in prod:
            bp = grades.get("base_prices", {}).get(grade, grades.get("base_prices", {}).get("loại 2", 30_000))
            break

    return {
        "base_price_result": {
            "product_name": product_name,
            "grade": grade,
            "base_price_per_kg": bp,
        }
    }


async def seasonal(state: PostGenState) -> Dict[str, Any]:
    base = state["base_price_result"]
    kb = _load_kb()

    month = datetime.now().month
    multiplier = 1.0
    label = f"Mùa bình thường tháng {month}"

    for fruit, data in kb.get("seasonal_multipliers", {}).items():
        if fruit in base["product_name"]:
            if month in data.get("peak_months", []):
                multiplier, label = 0.88, f"Chính vụ tháng {month} ×0.88"
            elif month in data.get("off_months", []):
                multiplier, label = 1.18, f"Trái vụ tháng {month} ×1.18"
            break

    return {
        "seasonal_result": {
            "base_price": base["base_price_per_kg"],
            "seasonal_multiplier": multiplier,
            "seasonal_label": label,
            "seasonal_price": int(base["base_price_per_kg"] * multiplier),
            "month": month,
        }
    }


def _extract_retail_price(snippet: str) -> int | None:
    """
    Trích giá bán lẻ/kg từ snippet.
    Bỏ qua nếu từ chỉ bán lô (tấn/thùng/lô...) xuất hiện trong cửa sổ ±60 ký tự quanh giá.
    """
    text = snippet.lower()
    for m in _PRICE_RE.finditer(text):
        start = max(0, m.start() - 60)
        end = min(len(text), m.end() + 60)
        window = text[start:end]

        # Bỏ qua nếu context chứa từ bán lô
        if _BULK_UNITS.search(window):
            continue

        raw = m.group(1).replace(".", "").replace(",", "")
        try:
            val = int(raw)
        except ValueError:
            continue

        # Giá bán lẻ trái cây Việt Nam: 5,000–500,000 VND/kg
        if 5_000 <= val <= 500_000:
            return val
        # Dạng "45k" (đã strip đơn vị, giá trị là 45)
        if 5 <= val <= 500:
            return val * 1_000

    return None


def _has_retail_signal(snippet: str) -> bool:
    return bool(_RETAIL_SIGNALS.search(snippet))


def _remove_outliers(items: list[dict]) -> list[dict]:
    """IQR filter: loại bỏ giá nằm ngoài [Q1 - 1.5×IQR, Q3 + 1.5×IQR]."""
    if len(items) < 4:
        return items
    prices = sorted(p["price"] for p in items)
    n = len(prices)
    q1 = prices[n // 4]
    q3 = prices[(3 * n) // 4]
    iqr = q3 - q1
    lo = q1 - 1.5 * iqr
    hi = q3 + 1.5 * iqr
    cleaned = [p for p in items if lo <= p["price"] <= hi]
    # Nếu lọc xong còn quá ít, trả về bản gốc để tránh mất hết data
    return cleaned if len(cleaned) >= 3 else items


def _weighted_avg(items: list[dict]) -> int | None:
    if not items:
        return None
    total_w = sum(p["score"] for p in items)
    if total_w == 0:
        avg = sum(p["price"] for p in items) / len(items)
    else:
        avg = sum(p["price"] * p["score"] for p in items) / total_w
    return round(avg / 1_000) * 1_000


async def similar(state: PostGenState) -> Dict[str, Any]:
    """
    Query DuckDuckGo với 2 câu tìm kiếm bán lẻ/kg cụ thể.
    Loại bỏ kết quả bán lô. Score theo vị trí rank.
    """
    vision = state["vision_result"]
    product_name = vision.get("product_name", "trái cây")
    grade = vision.get("grade", "Loại 2")

    # 2 query: cụ thể + rộng hơn để lấy đủ 30
    queries = [
        f"{product_name} {grade} giá bán lẻ 1kg",
        f"{product_name} giá kg bán lẻ hôm nay",
    ]
    found: list[dict] = []
    seen_titles: set[str] = set()

    try:
        from duckduckgo_search import DDGS

        def _search(q: str, n: int) -> list[dict]:
            with DDGS() as ddgs:
                return list(ddgs.text(q, max_results=n, region="vn-vi"))

        loop = asyncio.get_event_loop()

        for q in queries:
            # Lấy đủ 60 kết quả mỗi query để sau lọc còn ~30
            raw = await loop.run_in_executor(None, _search, q, 60)
            for rank, r in enumerate(raw):
                title = r.get("title", "")[:80]
                if title in seen_titles:
                    continue
                seen_titles.add(title)

                snippet = title + " " + r.get("body", "")
                price = _extract_retail_price(snippet)
                if not price:
                    continue

                # Score: ưu tiên kết quả có từ "kg/bán lẻ" và rank cao
                has_signal = _has_retail_signal(snippet)
                score = round((1.0 / (rank + 1)) * (1.2 if has_signal else 1.0), 4)

                found.append({
                    "product_name": title,
                    "price": price,
                    "score": score,
                })

    except Exception as e:
        print(f"[similar] DuckDuckGo failed: {e}")

    # Sắp xếp theo score giảm dần, lấy tối đa 30
    found.sort(key=lambda x: x["score"], reverse=True)
    found = found[:30]

    # Lọc outlier bằng IQR trước khi tính average
    found = _remove_outliers(found)

    # Cần ít nhất 5 mẫu sạch thì kNN mới đáng tin
    market_avg = _weighted_avg(found) if len(found) >= 5 else None

    return {
        "similar_result": {
            "similar_products": found[:10],
            "market_avg": market_avg,
            "knn_count": len(found),
        }
    }


async def price_calculator(state: PostGenState) -> Dict[str, Any]:
    """Final price = rule × multipliers + kNN average (60/40 blend)."""
    vision = state["vision_result"]
    seasonal_result = state["seasonal_result"]
    similar_result = state["similar_result"]

    rule_price = seasonal_result["seasonal_price"]
    market_avg = similar_result["market_avg"]

    # Defect multiplier
    dm = 1.0
    dl = ""
    for defect in vision.get("defects", []):
        d = defect.lower()
        if "dập" in d:
            dm *= 0.88; dl += "dập ×0.88 "
        if "úng" in d or "thối" in d:
            dm *= 0.70; dl += "úng/thối ×0.70 "
        if "sâu" in d:
            dm *= 0.80; dl += "sâu ×0.80 "

    # Cert multiplier
    cm = 1.0
    cl = ""
    for cert in vision.get("certifications", []):
        c = cert.upper()
        if "GLOBALGAP" in c:
            cm = max(cm, 1.25); cl = "GlobalGAP ×1.25"
        elif "ORGANIC" in c or "HỮU CƠ" in c:
            cm = max(cm, 1.20); cl = "Organic ×1.20"
        elif "VIETGAP" in c:
            cm = max(cm, 1.10); cl = "VietGAP ×1.10"

    # Freshness multiplier
    f = vision.get("freshness", "").lower()
    if "rất tươi" in f:
        fm, fl = 1.08, "Rất tươi ×1.08"
    elif "kém" in f:
        fm, fl = 0.72, "Kém tươi ×0.72"
    elif "bình thường" in f:
        fm, fl = 0.90, "Bình thường ×0.90"
    else:
        fm, fl = 1.00, "Tươi ×1.00"

    # rule × multipliers
    rule_final = round(rule_price * dm * cm * fm / 1_000) * 1_000

    knn_count = similar_result["knn_count"]
    market_avg = similar_result["market_avg"]  # None nếu < 5 mẫu sạch

    if market_avg and knn_count >= 5:
        # Blend: 60% rule-based + 40% kNN weighted avg
        blended = round((rule_final * 0.6 + market_avg * 0.4) / 1_000) * 1_000
        knn_note = f"kNN {knn_count} mẫu (sau IQR) → avg {market_avg:,}đ"
        final_formula = f"{rule_final:,}×0.6 + {market_avg:,}×0.4 = {blended:,}đ/kg"
    else:
        blended = rule_final
        knn_note = f"kNN chỉ có {knn_count} mẫu hợp lệ → bỏ qua, dùng rule-based"
        final_formula = f"Rule-based: {rule_final:,}đ/kg"

    breakdown = [
        f"Giá gốc: {seasonal_result['base_price']:,}đ",
        f"× {seasonal_result['seasonal_multiplier']:.2f} ({seasonal_result['seasonal_label']})",
    ]
    if dl:
        breakdown.append(f"× {dm:.2f} ({dl.strip()})")
    if cl:
        breakdown.append(f"× {cm:.2f} ({cl})")
    breakdown.append(f"× {fm:.2f} ({fl})")
    breakdown.append(f"= {rule_final:,}đ (rule-based)")
    breakdown.append(knn_note)
    breakdown.append(final_formula)

    return {
        "pricing_result": {
            "suggested_price_per_kg": blended,
            "breakdown": breakdown,
            "market": {
                "similar_products": similar_result["similar_products"],
                "market_avg": market_avg,
                "note": knn_note,
            },
        }
    }
