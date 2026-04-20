import re
import asyncio
from typing import Dict, Any

from app.agents.state import PostGenState

# Giá VND: 45.000 / 45,000 / 45000 / 45k
_PRICE_RE = re.compile(
    r'(\d{1,3}(?:[.,]\d{3})+|\b\d{4,6}\b)\s*(?:đ|vnđ|vnd|đồng|k\b)?',
    re.IGNORECASE,
)
_BULK_UNITS = re.compile(
    r'\b(tấn|tạ|thùng|bao|lô|pallet|xe|container|tải|kiện|sọt)\b',
    re.IGNORECASE,
)
_RETAIL_SIGNALS = re.compile(
    r'\b(kg|kilogram|1\s*kg|bán lẻ|giá lẻ|đồng/kg|đ/kg|vnd/kg)\b',
    re.IGNORECASE,
)


def _extract_retail_price(snippet: str) -> int | None:
    text = snippet.lower()
    for m in _PRICE_RE.finditer(text):
        start = max(0, m.start() - 60)
        end = min(len(text), m.end() + 60)
        window = text[start:end]
        if _BULK_UNITS.search(window):
            continue
        raw = m.group(1).replace(".", "").replace(",", "")
        try:
            val = int(raw)
        except ValueError:
            continue
        if 5_000 <= val <= 500_000:
            return val
        if 5 <= val <= 500:
            return val * 1_000
    return None


def _has_retail_signal(snippet: str) -> bool:
    return bool(_RETAIL_SIGNALS.search(snippet))


def _build_queries(features: list[str], grade: str) -> list[str]:
    """
    3 query từ features:
    - Query 1: tên + cấp chất lượng + giá kg
    - Query 2: tên + top đặc trưng nổi bật + giá bán lẻ
    - Query 3: tên + giá hôm nay (rộng để bắt thêm kết quả)
    """
    name = features[0] if features else "nông sản"
    highlights = " ".join(f for f in features[1:4] if f)

    return [
        f"{name} {grade} giá bán lẻ 1kg",
        f"{name} {highlights} giá kg hôm nay",
        f"{name} giá bao nhiêu 1kg bán lẻ",
    ]


def _iqr_filter(items: list[dict]) -> list[dict]:
    if len(items) < 4:
        return items
    prices = sorted(p["price"] for p in items)
    n = len(prices)
    q1, q3 = prices[n // 4], prices[(3 * n) // 4]
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    cleaned = [p for p in items if lo <= p["price"] <= hi]
    return cleaned if len(cleaned) >= 3 else items


def _knn_weighted_avg(items: list[dict]) -> int | None:
    """Weighted average theo score. Cần ít nhất 5 mẫu sau IQR filter."""
    candidates = _iqr_filter(items)
    if len(candidates) < 5:
        return None
    total_w = sum(p["score"] for p in candidates)
    if total_w == 0:
        avg = sum(p["price"] for p in candidates) / len(candidates)
    else:
        avg = sum(p["price"] * p["score"] for p in candidates) / total_w
    return round(avg / 1_000) * 1_000


async def similar(state: PostGenState) -> Dict[str, Any]:
    """Search giá bán lẻ dựa trên 15 features từ vision."""
    vision = state["vision_result"]
    features: list[str] = vision.get("features") or [vision.get("product_name", "nông sản")]
    grade = vision.get("grade", "Loại 2")

    queries = _build_queries(features, grade)
    found: list[dict] = []
    seen_titles: set[str] = set()

    try:
        from duckduckgo_search import DDGS

        def _search(q: str, n: int) -> list[dict]:
            with DDGS() as ddgs:
                return list(ddgs.text(q, max_results=n, region="vn-vi"))

        loop = asyncio.get_event_loop()

        for q in queries:
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

                has_signal = _has_retail_signal(snippet)
                score = round((1.0 / (rank + 1)) * (1.2 if has_signal else 1.0), 4)
                found.append({"product_name": title, "price": price, "score": score})

    except Exception as e:
        print(f"[similar] DuckDuckGo failed: {e}")

    found.sort(key=lambda x: x["score"], reverse=True)
    found = found[:30]
    market_avg = _knn_weighted_avg(found)

    return {
        "similar_result": {
            "similar_products": found[:10],
            "market_avg": market_avg,
            "knn_count": len(found),
            "queries_used": queries,
        }
    }


async def price_calculator(state: PostGenState) -> Dict[str, Any]:
    """Giá cuối = KNN weighted average thuần. Không dùng rule-based hay yaml."""
    vision = state["vision_result"]
    similar_result = state["similar_result"]

    features: list[str] = vision.get("features") or [vision.get("product_name", "nông sản")]
    product_name = features[0]
    grade = vision.get("grade", "Loại 2")
    market_avg = similar_result["market_avg"]
    knn_count = similar_result["knn_count"]

    if market_avg and knn_count >= 5:
        suggested = market_avg
        note = f"KNN weighted avg từ {knn_count} mẫu (sau IQR filter) → {market_avg:,}đ/kg"
        breakdown = [
            f"Sản phẩm: {product_name} ({grade})",
            f"Đặc trưng phân tích: {', '.join(features[:5])}{'...' if len(features) > 5 else ''}",
            f"Tìm được {knn_count} giá bán lẻ từ web",
            f"Sau IQR filter → KNN weighted avg = {market_avg:,}đ/kg",
        ]
    else:
        # Fallback: median của những gì tìm được
        all_prices = [p["price"] for p in similar_result["similar_products"]]
        if all_prices:
            all_prices.sort()
            suggested = round(all_prices[len(all_prices) // 2] / 1_000) * 1_000
            note = f"Chỉ có {knn_count} mẫu (cần ≥5) → dùng median {suggested:,}đ/kg"
        else:
            suggested = 0
            note = "Không tìm được dữ liệu giá từ web"
        breakdown = [
            f"Sản phẩm: {product_name} ({grade})",
            f"Đặc trưng phân tích: {', '.join(features[:5])}{'...' if len(features) > 5 else ''}",
            note,
        ]

    return {
        "pricing_result": {
            "suggested_price_per_kg": suggested,
            "breakdown": breakdown,
            "market": {
                "similar_products": similar_result["similar_products"],
                "market_avg": market_avg,
                "note": note,
                "features_used": features,
                "queries_used": similar_result.get("queries_used", []),
            },
        }
    }
