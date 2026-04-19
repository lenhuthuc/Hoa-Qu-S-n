"""
Dynamic pricing engine: 15 features from vision → DuckDuckGo search → KNN weighted average.
No yaml knowledge base required.
"""

import re
import asyncio
from models import PricingResult, PriceBreakdown, PriceMultiplier, MarketInfo, SimilarProduct

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


def _build_features(
    product_name: str,
    grade: str,
    freshness: str,
    defects: list[str],
    certifications: list[str],
    category: str,
    extra_features: list[str],
) -> list[str]:
    """Nếu vision đã trả về features thì dùng luôn, không thì build từ các field."""
    if extra_features:
        # Đảm bảo feature[0] luôn là tên sản phẩm
        if extra_features[0].lower() != product_name.lower():
            return [product_name] + extra_features[:14]
        return extra_features[:15]

    # Fallback: build từ các field cũ
    features = [product_name]
    if grade:
        features.append(grade)
    if freshness:
        features.append(f"độ tươi: {freshness}")
    if certifications:
        features.extend(certifications[:2])
    if defects:
        features.extend(defects[:2])
    if category:
        features.append(category)
    return features


def _build_queries(features: list[str], grade: str) -> list[str]:
    name = features[0] if features else "nông sản"
    highlights = " ".join(f for f in features[1:4] if f)
    return [
        f"{name} {grade} giá bán lẻ 1kg",
        f"{name} {highlights} giá kg hôm nay",
        f"{name} giá bao nhiêu 1kg bán lẻ",
    ]


def _iqr_filter(items: list[SimilarProduct]) -> list[SimilarProduct]:
    if len(items) < 4:
        return items
    prices = sorted(p.price for p in items)
    n = len(prices)
    q1, q3 = prices[n // 4], prices[(3 * n) // 4]
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    cleaned = [p for p in items if lo <= p.price <= hi]
    return cleaned if len(cleaned) >= 3 else items


def _knn_weighted_avg(items: list[SimilarProduct]) -> int | None:
    candidates = _iqr_filter(items)
    if len(candidates) < 5:
        return None
    total_w = sum(p.score for p in candidates)
    if total_w == 0:
        avg = sum(p.price for p in candidates) / len(candidates)
    else:
        avg = sum(p.price * p.score for p in candidates) / total_w
    return round(avg / 1_000) * 1_000


async def calculate_price(
    product_name: str,
    grade: str,
    defects: list[str],
    certifications: list[str],
    freshness: str,
    embedding_service=None,
    category: str = "",
    features: list[str] | None = None,
) -> PricingResult:
    all_features = _build_features(
        product_name, grade, freshness, defects, certifications, category, features or []
    )
    queries = _build_queries(all_features, grade)

    found: list[SimilarProduct] = []
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
                found.append(SimilarProduct(product_name=title, price=price, score=score))
    except Exception as e:
        print(f"[pricing] DuckDuckGo failed: {e}")

    found.sort(key=lambda x: x.score, reverse=True)
    found = found[:30]
    market_avg = _knn_weighted_avg(found)

    knn_count = len(found)
    if market_avg and knn_count >= 5:
        suggested = market_avg
        note = f"KNN weighted avg từ {knn_count} mẫu (sau IQR filter) → {market_avg:,}đ/kg"
    elif found:
        prices = sorted(p.price for p in found)
        suggested = round(prices[len(prices) // 2] / 1_000) * 1_000
        note = f"Chỉ có {knn_count} mẫu (cần ≥5) → dùng median {suggested:,}đ/kg"
    else:
        suggested = 30_000
        note = "Không tìm được dữ liệu giá từ web, dùng giá mặc định"

    # PriceBreakdown với multiplier=1.0 vì không còn dùng rule-based
    breakdown = PriceBreakdown(
        base_price=suggested,
        grade=PriceMultiplier(label=grade or "Loại 2", multiplier=1.0),
        defect=PriceMultiplier(label=", ".join(defects) or "Không có", multiplier=1.0),
        certification=PriceMultiplier(label=", ".join(certifications) or "Không có", multiplier=1.0),
        seasonal=PriceMultiplier(label="KNN-based", multiplier=1.0),
        freshness=PriceMultiplier(label=freshness or "Tươi", multiplier=1.0),
    )

    return PricingResult(
        suggested_price_per_kg=suggested,
        breakdown=breakdown,
        market=MarketInfo(
            similar_products=found[:10],
            market_avg=market_avg,
            note=note,
        ),
    )
