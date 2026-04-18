"""
VisionProviderChain: OpenRouter (Gemma-2) → Gemini 2.0 Flash → Gemini 1.5 Flash
Accepts multiple images, returns VisionResult Pydantic model.
"""

import base64
import contextlib
import json
from typing import Optional
import httpx

from models import VisionResult

VISION_PROMPT = """Bạn là chuyên gia định danh giống nông sản Việt Nam với 20 năm kinh nghiệm.
Nhiệm vụ: xác định ĐÚNG GIỐNG/LOẠI cụ thể, không chỉ tên chung chung.

━━━ DANH SÁCH GIỐNG THAM KHẢO ━━━

XOÀI: quan sát màu vỏ, hình dáng, kích thước:
• Xoài cát Hòa Lộc → vỏ vàng xanh mướt, thon dài, đầu nhọn, thịt vàng đậm, ít xơ
• Xoài cát Chu → vỏ vàng cam khi chín, hình oval tròn hơn Hòa Lộc
• Xoài Đài Loan (xoài xanh) → vỏ xanh ngả vàng, to tròn, thịt giòn
• Xoài Úc (xoài R2E2/Kent/Kensington) → to bầu, vỏ đỏ-xanh-vàng loang, thịt cam
• Xoài tượng → rất to, dài, vỏ xanh, thịt trắng vàng nhạt, nhiều xơ
• Xoài thanh ca → nhỏ thon, vỏ xanh vàng, thơm đặc trưng
• Xoài keo → nhỏ, vỏ vàng xanh, nhiều xơ, vị ngọt chua

SẦU RIÊNG:
• Sầu riêng Ri6 → gai ngắn dày, thịt vàng đậm, múi mập
• Sầu riêng Monthong (Thái) → gai thưa nhọn, to hơn, thịt vàng nhạt, vị nhẹ
• Sầu riêng Musang King → vỏ mỏng hơn, thịt vàng kem, gai nhỏ
• Sầu riêng cơm vàng hạt lép → hạt nhỏ lép, múi dày

CHÔM CHÔM:
• Chôm chôm nhãn (Java) → lông mềm xanh-đỏ, tròn đều
• Chôm chôm Thái → lông dài đỏ-vàng, ngọt hơn
• Chôm chôm rongrien → lông đỏ đậm, vỏ dày

NHÃN:
• Nhãn lồng Hưng Yên → vỏ vàng nâu mỏng, cùi dày trắng đục
• Nhãn Ido → to hơn, vỏ nâu vàng sáng, cùi giòn

VẢI:
• Vải thiều Thanh Hà/Lục Ngạn → vỏ đỏ tươi, gai nhỏ đều
• Vải trứng → to hơn, vỏ đỏ sẫm

BƯỞI:
• Bưởi da xanh Bến Tre → vỏ xanh đặc trưng, múi hồng
• Bưởi Năm Roi → vỏ vàng xanh, múi vàng nhạt
• Bưởi đường lá cam → vỏ xanh nhỏ hơn, múi ngọt

CHUỐI:
• Chuối già Nam Mỹ (Cavendish) → vỏ vàng đều, thẳng
• Chuối cau → nhỏ, vỏ vàng xanh, ngọt đậm
• Chuối sứ → ngắn tròn, vỏ vàng cam
• Chuối xiêm → to, vỏ dày, ăn chín ngả đen

DƯA HẤU:
• Dưa hấu không hạt → vỏ sọc xanh đậm nhạt, tròn/bầu dục
• Dưa hấu hắc mỹ nhân → vỏ xanh đen bóng

━━━ HƯỚNG DẪN PHÂN TÍCH ━━━
1. Quan sát: màu vỏ, hình dáng, kích thước tương đối, kết cấu vỏ (bóng/mờ/gai), màu thịt nếu thấy, nhãn dán
2. So sánh với danh sách trên để chọn giống khớp nhất
3. Nếu không chắc giữa 2 giống: chọn cái phổ biến hơn và ghi confidence thấp (0.5-0.65)
4. Nếu không phải nông sản: trả về {"error": "Ảnh không phải sản phẩm nông sản"}

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

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://hoaquason.vn",
                "X-Title": "Hoa Qua Son",
            },
            json={
                "model": "google/gemma-2-9b-it:free",
                "messages": [{"role": "user", "content": content}],
                "temperature": 0.1,
            },
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        return _parse_and_validate(text, "openrouter/gemma-4")


async def _try_gemini(images_raw: list[dict], api_key: str) -> Optional[VisionResult]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]:
        try:
            model = genai.GenerativeModel(model_name)
            parts = [VISION_PROMPT] + [
                {"mime_type": img["mime_type"], "data": img["data"]}
                for img in images_raw[:3]
            ]
            response = model.generate_content(parts)
            return _parse_and_validate(response.text, model_name)
        except Exception:
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
    images_raw = [
        {"mime_type": ct or "image/jpeg", "data": data}
        for data, ct in image_files
    ]

    if settings.openrouter_api_key:
        with contextlib.suppress(Exception):
            result = await _try_openrouter(images_b64, settings.openrouter_api_key)
            if result:
                return result

    if settings.gemini_api_key:
        with contextlib.suppress(Exception):
            result = await _try_gemini(images_raw, settings.gemini_api_key)
            if result:
                return result

    raise RuntimeError("Tất cả vision providers đều thất bại")
