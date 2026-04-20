"""
VisionProviderChain: OpenRouter (Gemma-2) → Gemini 2.0 Flash → Gemini 1.5 Flash
Accepts multiple images, returns VisionResult Pydantic model.
"""

import base64
import json
from typing import Optional
import httpx

from models import VisionResult

VISION_PROMPT = """Bạn là chuyên gia phân tích nông sản Việt Nam với 20 năm kinh nghiệm.
Nhiệm vụ: nhận diện BẤT KỲ loại nông sản nào trong ảnh — trái cây, rau củ, hạt, nấm, thảo mộc, v.v.

━━━ HƯỚNG DẪN PHÂN TÍCH ━━━
1. Quan sát kỹ: màu sắc, hình dáng, kích thước, kết cấu vỏ/lá, màu thịt (nếu thấy), nhãn/sticker
2. Xác định tên cụ thể nhất có thể (ví dụ: "Cà chua bi đỏ", "Xoài cát Hòa Lộc", "Nấm hương khô")
3. Nếu không chắc chắn về giống cụ thể, ghi tên phổ thông và confidence thấp (0.4-0.6)
4. Chỉ trả về {"error": "Ảnh không phải sản phẩm nông sản"} khi ảnh rõ ràng KHÔNG phải nông sản (đồ vật, người, xe cộ, phong cảnh...)

━━━ OUTPUT JSON ━━━
Trả về JSON hợp lệ DUY NHẤT (KHÔNG markdown, KHÔNG giải thích):
{
  "product_name": "tên giống cụ thể, ví dụ: Xoài cát Hòa Lộc, Sầu riêng Ri6, Chôm chôm nhãn",
  "grade": "Loại 1 HOẶC Loại 2 HOẶC Loại 3",
  "category": "Trái cây HOẶC Rau củ",
  "freshness": "Rất tươi HOẶC Tươi HOẶC Bình thường HOẶC Kém tươi",
  "defects": ["chỉ ghi lỗi thật sự thấy: dập, úng, sâu, nứt, vàng héo — [] nếu không có"],
  "certifications": ["VietGAP, GlobalGAP, Organic — chỉ khi thấy nhãn/sticker xác nhận, [] nếu không"],
  "description": "mô tả 50-80 từ: giống, màu sắc, độ tươi, đặc điểm nổi bật",
  "title": "tiêu đề bài đăng 15-25 từ tiếng Việt, hấp dẫn",
  "confidence": 0.85
}"""


def _parse_and_validate(text: str, provider: str) -> VisionResult:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    data = json.loads(text)
    if "error" in data:
        return VisionResult(error=data["error"], provider=provider)
    data.setdefault("provider", provider)
    return VisionResult.model_validate(data)


async def _try_openrouter(images_b64: list[dict], api_key: str) -> Optional[VisionResult]:
    content = [{"type": "text", "text": VISION_PROMPT}] + [
        {"type": "image_url", "image_url": {"url": f"data:{img['mime_type']};base64,{img['data']}"}}
        for img in images_b64[:3]
    ]

    vision_models = [
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "qwen/qwen2.5-vl-72b-instruct:free",
        "google/gemini-2.0-flash-001",
        "google/gemini-flash-1.5",
    ]

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in vision_models:
            try:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer": "https://hoaquason.vn",
                        "X-Title": "Hoa Qua Son",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": content}],
                        "temperature": 0.1,
                    },
                )
                resp.raise_for_status()
                text = resp.json()["choices"][0]["message"]["content"]
                return _parse_and_validate(text, f"openrouter/{model}")
            except Exception as e:
                print(f"[DEBUG] openrouter/{model} failed: {e}")
                continue
    return None


async def _try_gemini(images_b64: list[dict], api_key: str) -> Optional[VisionResult]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    for model_name in ["gemini-2.5-vision", "gemini-2.0-vision", "gemini-1.5-vision"]:
        try:
            model = genai.GenerativeModel(model_name)
            parts = [VISION_PROMPT] + [
                {
        "inline_data": {
            "mime_type": img["mime_type"],
            "data": img["data"]  # giữ nguyên base64 string, KHÔNG decode
        }
    }
                for img in images_b64[:3]
            ]
            response = model.generate_content(parts)
            if response and getattr(response, 'text', None):
                return _parse_and_validate(response.text, model_name)
        except Exception as e:
            print(f"[DEBUG] {model_name} failed: {e}")
            continue
    return None


async def analyze_images(image_files: list[tuple]) -> VisionResult:
    """
    image_files: list of (bytes, content_type) tuples
    Returns VisionResult Pydantic model.
    """
    from config import get_settings
    settings = get_settings()

    images_b64 = [
        {"mime_type": ct or "image/jpeg", "data": base64.b64encode(data).decode()}
        for data, ct in image_files
    ]

    errors: list[str] = []

    if settings.openrouter_api_key:
        try:
            result = await _try_openrouter(images_b64, settings.openrouter_api_key)
            if result:
                return result
            errors.append("openrouter: trả về None (tất cả models thất bại)")
        except Exception as e:
            errors.append(f"openrouter: {e}")
            print(f"[ERROR] openrouter top-level: {e}")
    else:
        errors.append("openrouter: OPENROUTER_API_KEY chưa được set")

    if settings.gemini_api_key:
        try:
            result = await _try_gemini(images_b64, settings.gemini_api_key)
            if result:
                return result
            errors.append("gemini: trả về None (tất cả models thất bại)")
        except Exception as e:
            errors.append(f"gemini: {e}")
            print(f"[ERROR] gemini top-level: {e}")
    else:
        errors.append("gemini: GEMINI_API_KEY chưa được set")

    raise RuntimeError(f"Tất cả vision providers đều thất bại: {'; '.join(errors)}")
