import base64
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from groq import Groq
from config import get_settings
from core.pricing_agent import get_smart_pricing # <-- Import Agent vừa tạo

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
router = APIRouter()

# 
MARKET_PRICES_PROMPT = """
Bạn là chuyên gia phân tích hình ảnh nông sản. Trả về JSON (KHÔNG markdown):
{
  "product_name": "Tên sản phẩm tiếng Việt",
  "title": "Tiêu đề bài đăng bán hấp dẫn (15-30 từ)",
  "description": "Mô tả chi tiết sản phẩm cho bài đăng",
  "category": "Phân loại (Trái cây / Rau củ)",
  "freshness": "Đánh giá độ tươi (Rất tươi / Tươi / Bình thường)"
}
Nếu ảnh không phải nông sản, trả về: {"error": "Ảnh không phải sản phẩm nông sản"}
"""

@router.post("/generate-post", response_model=dict)
async def generate_post(image: UploadFile = File(...)):
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    image_bytes = await image.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = image.content_type or "image/jpeg"
    groq_client = Groq(api_key=settings.groq_api_key)

    try:
        # --- VISION MODEL ---
        response = groq_client.chat.completions.create(
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
            temperature=0.2,
            max_tokens=1024,
        )

        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        ai_result = json.loads(text)

        if "error" in ai_result:
            return {"success": False, "error": ai_result["error"]}

        # --- GỌI LANGCHAIN AGENT ---
        product_name = ai_result.get("product_name", "Nông sản không rõ tên")
        freshness = ai_result.get("freshness", "Bình thường")
        
        # Lấy kết quả từ Agent
        pricing_data = await get_smart_pricing(product_name, freshness)
        
        # Nhét ĐÚNG 2 CÁI TÊN mà Next.js đang cần vào ai_result
        ai_result["suggested_price_per_kg"] = pricing_data.get("suggested_price_per_kg", 0)
        ai_result["price_reasoning"] = pricing_data.get("price_reasoning", "AI đang gặp chút vấn đề khi tư vấn giá.")

        return {"success": True, "data": ai_result}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")