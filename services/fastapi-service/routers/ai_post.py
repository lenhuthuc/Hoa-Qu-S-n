"""
Feature 1: AI Post Creation
Upload farm image → Llama 4 Scout multimodal (via Groq) → auto-generate title + description + suggested price
"""

import base64
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from groq import Groq
import httpx

from config import get_settings

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

router = APIRouter()

MARKET_PRICES_PROMPT = """
Bạn là chuyên gia nông sản Việt Nam. Phân tích ảnh sản phẩm nông sản này và trả về JSON (KHÔNG markdown):
{
  "product_name": "Tên sản phẩm tiếng Việt (ví dụ: Xoài cát Hòa Lộc)",
  "title": "Tiêu đề bài đăng bán hấp dẫn (15-30 từ)",
  "description": "Mô tả chi tiết sản phẩm cho bài đăng (50-100 từ, nhấn mạnh chất lượng, nguồn gốc, lợi ích)",
  "category": "Phân loại (Trái cây / Rau củ / Lương thực / Đặc sản)",
  "estimated_weight": "Ước lượng trọng lượng nếu nhìn thấy",
  "freshness": "Đánh giá độ tươi (Rất tươi / Tươi / Bình thường)",
  "suggested_price_per_kg": <số tiền VND gợi ý/kg dựa trên chất lượng>,
  "price_reasoning": "Giải thích ngắn gọn lý do đề xuất giá"
}

Nếu ảnh không phải nông sản, trả về:
{"error": "Ảnh không phải sản phẩm nông sản"}
"""


class AIPostResponse(BaseModel):
    product_name: str
    title: str
    description: str
    category: str
    estimated_weight: str | None = None
    freshness: str | None = None
    suggested_price_per_kg: int
    price_reasoning: str
    market_comparison: dict | None = None


@router.post("/generate-post", response_model=dict)
async def generate_post(request: Request, image: UploadFile = File(...)):
    """
    Upload farm product image → Gemini Flash analyzes → returns post content + price suggestion.
    Compares against market price DB for validation.
    """
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    # Validate content type
    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if image.content_type and image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {image.content_type}. Allowed: JPG, PNG, GIF, WEBP")

    # Read image
    image_bytes = await image.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Image file is empty (0 bytes)")
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    # Call Groq vision model
    client = Groq(api_key=settings.groq_api_key)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = image.content_type or "image/jpeg"

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": MARKET_PRICES_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                    ],
                }
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        # Parse JSON response
        text = response.choices[0].message.content.strip()
        # Remove markdown code block if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        ai_result = json.loads(text)

        if "error" in ai_result:
            return {"success": False, "error": ai_result["error"]}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    # Compare with market prices from Spring service
    market_comparison = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.spring_service_url}/api/market-prices/search",
                params={"name": ai_result.get("product_name", "")},
            )
            if resp.status_code == 200:
                market_data = resp.json()
                if market_data.get("data"):
                    mp = market_data["data"]
                    suggested = ai_result.get("suggested_price_per_kg", 0)
                    market_comparison = {
                        "market_avg": mp.get("avgPrice"),
                        "market_min": mp.get("minPrice"),
                        "market_max": mp.get("maxPrice"),
                        "ai_suggested": suggested,
                        "vs_market": "above" if suggested > mp.get("avgPrice", 0) else "below",
                    }
    except Exception:
        pass  # Market comparison is optional

    ai_result["market_comparison"] = market_comparison

    return {"success": True, "data": ai_result}


@router.post("/generate-post-base64", response_model=dict)
async def generate_post_base64(request: Request):
    """Alternative: accept base64-encoded image in JSON body."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    body = await request.json()
    image_b64 = body.get("image")
    mime_type = body.get("mime_type", "image/jpeg")

    if not image_b64:
        raise HTTPException(status_code=400, detail="'image' field required (base64)")

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Decoded image is empty (0 bytes)")

    client = Groq(api_key=settings.groq_api_key)

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": MARKET_PRICES_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}},
                    ],
                }
            ],
            temperature=0.3,
            max_tokens=1024,
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        ai_result = json.loads(text)
        if "error" in ai_result:
            return {"success": False, "error": ai_result["error"]}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    # Compare with market prices from Spring service
    market_comparison = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.spring_service_url}/api/market-prices/search",
                params={"name": ai_result.get("product_name", "")},
            )
            if resp.status_code == 200:
                market_data = resp.json()
                if market_data.get("data"):
                    mp = market_data["data"]
                    suggested = ai_result.get("suggested_price_per_kg", 0)
                    market_comparison = {
                        "market_avg": mp.get("avgPrice"),
                        "market_min": mp.get("minPrice"),
                        "market_max": mp.get("maxPrice"),
                        "ai_suggested": suggested,
                        "vs_market": "above" if suggested > mp.get("avgPrice", 0) else "below",
                    }
    except Exception:
        pass  # Market comparison is optional

    ai_result["market_comparison"] = market_comparison

    return {"success": True, "data": ai_result}
