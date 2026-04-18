"""
VisionProviderChain: OpenRouter (Gemma 4) → Gemini 2.5 Flash → Gemini 2.0 Flash
Accepts multiple images, returns structured product analysis.
"""

import base64
import json
from typing import Optional
import httpx

VISION_PROMPT = """Bạn là chuyên gia phân tích hình ảnh nông sản Việt Nam.

QUAN TRỌNG: Tất cả các trường trong JSON phải viết bằng TIẾNG VIỆT.
"product_name" PHẢI là tên tiếng Việt cụ thể (ví dụ: "Xoài cát Hòa Lộc", "Dưa leo", "Cải xanh").
NGHIÊM CẤM dùng tiếng Anh.

Phân tích kỹ và trả về JSON hợp lệ (KHÔNG markdown, KHÔNG giải thích thêm):
{
  "product_name": "Tên sản phẩm TIẾNG VIỆT cụ thể",
  "grade": "Loại 1 HOẶC Loại 2 HOẶC Loại 3",
  "category": "Trái cây HOẶC Rau củ",
  "freshness": "Rất tươi HOẶC Tươi HOẶC Bình thường HOẶC Kém tươi",
  "defects": ["danh sách lỗi như: dập, úng, sâu, vàng lá — để rỗng [] nếu không có"],
  "certifications": ["VietGAP, GlobalGAP, Organic — để rỗng [] nếu không thấy dấu hiệu"],
  "description": "Mô tả chi tiết 50-80 từ tiếng Việt",
  "title": "Tiêu đề bài đăng hấp dẫn 15-25 từ tiếng Việt",
  "confidence": 0.85
}

Nếu ảnh không phải nông sản: {"error": "Ảnh không phải sản phẩm nông sản"}"""


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


async def _try_openrouter(images_b64: list[dict], api_key: str) -> Optional[dict]:
    content = [{"type": "text", "text": VISION_PROMPT}]
    for img in images_b64[:3]:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{img['mime_type']};base64,{img['data']}"},
        })

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://hoaquason.vn",
                "X-Title": "Hoa Qua Son",
            },
            json={
                "model": "google/gemma-3-27b-it:free",
                "messages": [{"role": "user", "content": content}],
                "temperature": 0.1,
            },
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        return _parse_json_response(text)


async def _try_gemini(images_raw: list[dict], api_key: str) -> Optional[dict]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    for model_name in ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash"]:
        try:
            model = genai.GenerativeModel(model_name)
            parts = [VISION_PROMPT]
            for img in images_raw[:3]:
                parts.append({"mime_type": img["mime_type"], "data": img["data"]})
            response = model.generate_content(parts)
            result = _parse_json_response(response.text)
            result.setdefault("provider", model_name)
            return result
        except Exception:
            continue
    return None


async def analyze_images(image_files: list[tuple]) -> dict:
    """
    image_files: list of (bytes, content_type) tuples
    Returns structured analysis dict.
    """
    from config import get_settings
    settings = get_settings()

    images_b64 = [
        {"mime_type": ct or "image/jpeg", "data": base64.b64encode(data).decode()}
        for data, ct in image_files
    ]
    images_raw = [
        {"mime_type": ct or "image/jpeg", "data": data}
        for data, ct in image_files
    ]

    if settings.openrouter_api_key:
        try:
            result = await _try_openrouter(images_b64, settings.openrouter_api_key)
            if result:
                result.setdefault("provider", "openrouter/gemma-4")
                return result
        except Exception:
            pass

    if settings.gemini_api_key:
        try:
            result = await _try_gemini(images_raw, settings.gemini_api_key)
            if result:
                return result
        except Exception:
            pass

    raise RuntimeError("Tất cả vision providers đều thất bại")
