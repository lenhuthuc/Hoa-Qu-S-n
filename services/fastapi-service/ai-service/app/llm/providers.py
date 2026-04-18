import os
import base64
import httpx
from typing import List, Tuple, Optional, Dict, Any

import google.generativeai as genai
from openai import AsyncOpenAI

from app.models import VisionResult, PostResult
from app.llm.prompts import (
    VISION_SYSTEM, VISION_PROMPT,
    POST_GEN_SYSTEM, POST_GEN_PROMPT,
)


class VisionProviderChain:
    """Vision provider chain with structured output — no manual JSON parsing."""

    def __init__(self):
        self.providers = [
            self._gemini,
            self._openrouter_vision,
        ]

    async def analyze_images(self, images: List[Tuple[bytes, str]]) -> Dict[str, Any]:
        for provider in self.providers:
            try:
                result = await provider(images)
                if result and "error" not in result:
                    return result
            except Exception as e:
                print(f"[VisionChain] provider failed: {e}")
        return {"error": "All vision providers failed"}

    async def _gemini(self, images: List[Tuple[bytes, str]]) -> Optional[Dict[str, Any]]:
        """Gemini 2.0 Flash with response_schema → VisionResult Pydantic model."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=VISION_SYSTEM,
        )

        import PIL.Image
        from io import BytesIO

        pil_images = [
            PIL.Image.open(BytesIO(img_bytes))
            for img_bytes, _ in images[:3]
        ]

        generation_config = genai.types.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=VisionResult,
        )

        response = model.generate_content(
            [VISION_PROMPT, *pil_images],
            generation_config=generation_config,
        )

        validated = VisionResult.model_validate_json(response.text)
        result = validated.model_dump()
        result["provider"] = "gemini"
        return result

    async def _openrouter_vision(self, images: List[Tuple[bytes, str]]) -> Optional[Dict[str, Any]]:
        """Fallback: OpenRouter vision model với response_format json_schema."""
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not set")

        image_parts = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:{ct};base64,{base64.b64encode(b).decode()}"},
            }
            for b, ct in images[:3]
        ]

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "google/gemma-3-27b-it",
                    "messages": [
                        {"role": "system", "content": VISION_SYSTEM},
                        {"role": "user", "content": [{"type": "text", "text": VISION_PROMPT}, *image_parts]},
                    ],
                    "temperature": 0.1,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "VisionResult",
                            "schema": VisionResult.model_json_schema(),
                            "strict": True,
                        },
                    },
                },
            )

        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        validated = VisionResult.model_validate_json(content)
        result = validated.model_dump()
        result["provider"] = "openrouter"
        return result


class TextChain:
    """Cerebras Llama — structured output via OpenAI SDK .parse()."""

    def __init__(self):
        api_key = os.getenv("CEREBRAS_API_KEY")
        if not api_key:
            raise ValueError("CEREBRAS_API_KEY not set")
        self._client = AsyncOpenAI(
            base_url="https://api.cerebras.ai/v1",
            api_key=api_key,
        )

    async def generate_post(self, product_info: Dict[str, Any]) -> Dict[str, Any]:
        defects = ", ".join(product_info.get("defects") or []) or "Không có"
        certs = ", ".join(product_info.get("certifications") or []) or "Không có"

        prompt = POST_GEN_PROMPT.format(
            product_name=product_info.get("product_name", ""),
            grade=product_info.get("grade", ""),
            price=product_info.get("price_per_kg", 0),
            freshness=product_info.get("freshness", ""),
            defects=defects,
            certifications=certs,
        )

        response = await self._client.beta.chat.completions.parse(
            model="llama-3.3-70b",
            messages=[
                {"role": "system", "content": POST_GEN_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format=PostResult,
            temperature=0.75,
            max_tokens=1024,
        )

        parsed: PostResult = response.choices[0].message.parsed
        return parsed.model_dump()
