"""
Dynamic pricing engine: 15 features from vision → DuckDuckGo search → KNN weighted average.
No yaml knowledge base required.
"""

import re
import json
import asyncio
from models import PricingResult, PriceBreakdown, PriceMultiplier, MarketInfo, SimilarProduct

_PRICE_RE = re.compile(
    r'(\d{1,3}(?:[.,]\d{3})+|\b\d{4,6}\b|\b\d{1,3}\b(?=\s*k\b))\s*'
    r'(?:đ|vnđ|vnd|đồng|k\b|nghìn|ngàn)?', 
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


def _extract_retail_price(snippet: str, min_price: int = 5_000, max_price: int = 500_000) -> int | None:
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
        if min_price <= val <= max_price:
            return val
        if 5 <= val <= 500 and (min_price <= val * 1_000 <= max_price):
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


def _build_queries(features: list[str], grade: str, unit: str = "1kg") -> list[str]:
    name = features[0] if features else "nông sản"
    highlights = " ".join(f for f in features[1:4] if f)
    return [
        f"{name} {grade} giá bán lẻ {unit}",
        f"{name} {highlights} giá {unit} hôm nay",
        f"{name} giá bao nhiêu {unit} bán lẻ",
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
    if len(candidates) < 3:
        return None
    total_w = sum(p.score for p in candidates)
    if total_w == 0:
        avg = sum(p.price for p in candidates) / len(candidates)
    else:
        avg = sum(p.price * p.score for p in candidates) / total_w
    return round(avg / 1_000) * 1_000

async def _gemini_fallback_price(
    product_name: str,
    grade: str,
    freshness: str,
    defects: list[str],
    certifications: list[str],
    category: str,
    unit: str,
    found: list[SimilarProduct],
    min_price: int,
    max_price: int,
) -> tuple[int, str]:
    """Gọi Gemini ước tính giá khi dữ liệu web không đủ."""
    from config import get_settings
    import google.generativeai as genai

    settings = get_settings()

    # Đính kèm mẫu giá tìm được (nếu có) để Gemini tham khảo
    partial_data = ""
    if found:
        samples = [f"  - {p.product_name}: {p.price:,}đ" for p in found[:5]]
        partial_data = "\nMột số mẫu giá tìm được từ web (chưa đủ để thống kê):\n" + "\n".join(samples)

    prompt = f"""Bạn là chuyên gia định giá nông sản Việt Nam.
Hãy ước tính giá bán lẻ hợp lý cho sản phẩm sau (đơn vị: {unit}):

- Tên sản phẩm : {product_name}
- Phân loại     : {grade or 'Không rõ'}
- Độ tươi       : {freshness or 'Không rõ'}
- Khuyết điểm   : {', '.join(defects) if defects else 'Không có'}
- Chứng nhận    : {', '.join(certifications) if certifications else 'Không có'}
- Danh mục      : {category or 'Không rõ'}
- Khoảng giá    : {min_price:,}đ – {max_price:,}đ{partial_data}

Trả về JSON hợp lệ DUY NHẤT (KHÔNG markdown, KHÔNG giải thích):
{{
  "price": <số nguyên, bội số của 1000, nằm trong khoảng giá cho phép>,
  "note": "<lý do ngắn gọn 1-2 câu tiếng Việt, thân thiện với người dùng>"
}}"""

    try:
        genai.configure(api_key=settings.gemini_api_key)

        # Thử lần lượt các model, giống pattern trong vision_chain.py
        for model_name in ["gemini-2.0-flash", "gemini-2.0-flash-lite"]:
            try:
                model = genai.GenerativeModel(
                    model_name,
                    generation_config={
                        "temperature": 0.2,
                        "max_output_tokens": 200,
                        "response_mime_type": "application/json",
                    },
                )
                response = model.generate_content(prompt)
                raw = response.text.strip()

                # Phòng trường hợp vẫn có ``` wrap
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

                data = json.loads(raw)
                price = round(int(data["price"]) / 1_000) * 1_000
                price = max(min_price, min(max_price, price))   # clamp an toàn
                note = str(data.get("note", "Giá được ước tính bởi AI."))
                return price, note

            except Exception:
                continue  # thử model tiếp theo

    except Exception as e:
        print(f"[pricing] Gemini fallback failed: {e}")

    # Hard fallback cuối cùng — chỉ khi Gemini cũng lỗi
    mid = round((min_price + max_price) / 2 / 1_000) * 1_000
    return mid, "Giá tham khảo từ thị trường."

async def calculate_price(
    product_name: str,
    grade: str,
    defects: list[str],
    certifications: list[str],
    freshness: str,
    embedding_service=None,
    category: str = "",
    features: list[str] | None = None,
    unit: str = "1kg",
    min_price: int = 5_000,
    max_price: int = 500_000,
) -> PricingResult:
    all_features = _build_features(
        product_name, grade, freshness, defects, certifications, category, features or []
    )
    queries = _build_queries(all_features, grade, unit)

    found: list[SimilarProduct] = []
    seen_titles: set[str] = set()

    try:
        from duckduckgo_search import DDGS

        def _search(q: str, n: int) -> list[dict]:
            with DDGS() as ddgs:
                return list(ddgs.text(q, max_results=n, region="vn-vi", timelimit="y"))

        loop = asyncio.get_running_loop()
        for q in queries:
            raw = await loop.run_in_executor(None, _search, q, 25)
            for rank, r in enumerate(raw):
                title = r.get("title", "")[:80]
                if title in seen_titles:
                    continue
                seen_titles.add(title)
                snippet = title + " " + r.get("body", "")
                price = _extract_retail_price(snippet, min_price, max_price)
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
        # Đủ dữ liệu → dùng KNN, note thân thiện
        suggested = market_avg
        note = (
            f"Dựa trên {knn_count} mẫu giá thị trường, "
            f"giá ước tính là {market_avg:,}đ/{unit}."
        )
    else:
        # Không đủ dữ liệu → nhờ Gemini suy luận
        suggested, note = await _gemini_fallback_price(
            product_name, grade, freshness, defects, certifications,
            category, unit, found, min_price, max_price,
        )

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
