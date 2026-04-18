"""
Vietnamese post generator using Cerebras Llama 3.3 70B.
Falls back to building a basic post from vision data if Cerebras is unavailable.
"""

import json
import httpx

from models import PostResult

POST_PROMPT = """Bạn là chuyên gia viết bài đăng bán nông sản Việt Nam trên mạng xã hội.

Dựa trên thông tin sản phẩm dưới đây, hãy viết bài đăng hấp dẫn bằng TIẾNG VIỆT.

Trả về JSON hợp lệ (KHÔNG markdown, KHÔNG giải thích):
{{
  "title": "Tiêu đề ngắn gọn, hấp dẫn (15-25 từ, dùng emoji phù hợp)",
  "description": "Mô tả chi tiết 80-150 từ, nhấn mạnh chất lượng và giá trị",
  "hashtags": ["NôngSảnViệt", "ThựcPhẩmSạch", ... tối đa 10 hashtag không dấu #]
}}

THÔNG TIN SẢN PHẨM:
{product_info}"""


async def generate_post(product_info: dict) -> PostResult:
    from config import get_settings
    settings = get_settings()

    info_text = (
        f"Tên: {product_info.get('product_name', '')}\n"
        f"Phân loại: {product_info.get('grade', '')} | {product_info.get('category', '')}\n"
        f"Độ tươi: {product_info.get('freshness', '')}\n"
        f"Lỗi: {', '.join(product_info.get('defects', [])) or 'Không có'}\n"
        f"Chứng nhận: {', '.join(product_info.get('certifications', [])) or 'Không có'}\n"
        f"Giá đề xuất: {product_info.get('suggested_price_per_kg', 0):,} VND/kg\n"
        f"Mô tả gốc: {product_info.get('description', '')}"
    )

    if settings.cerebras_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.cerebras.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.cerebras_api_key}"},
                    json={
                        "model": "llama-3.3-70b",
                        "messages": [
                            {"role": "user", "content": POST_PROMPT.format(product_info=info_text)}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 600,
                    },
                )
                resp.raise_for_status()
                text = resp.json()["choices"][0]["message"]["content"].strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                data = json.loads(text)
                return PostResult(
                    title=data.get("title") or product_info.get("title", ""),
                    description=data.get("description") or product_info.get("description", ""),
                    hashtags=data.get("hashtags", []),
                )
        except Exception:
            pass

    # Fallback: use vision data directly
    name = product_info.get("product_name", "Nông sản")
    grade = product_info.get("grade", "")
    certs = product_info.get("certifications", [])
    cert_tag = f" {certs[0]}" if certs else ""
    hashtags = [
        name.replace(" ", "").replace("ị", "i").replace("ọ", "o"),
        "NongSanViet",
        "ThucPhamSach",
        "NongSanTuoi",
    ]
    return PostResult(
        title=product_info.get("title") or f"🌿 {name} {grade}{cert_tag} — Tươi ngon, giá tốt!",
        description=product_info.get("description") or f"{name} {grade} chất lượng cao, đảm bảo tươi ngon.",
        hashtags=hashtags,
    )
