import os
import json
import httpx
from typing import List, Tuple, Optional, Dict, Any
import google.generativeai as genai
from app.models import VisionResult, PostResult


class VisionProviderChain:
    """Chain of vision providers with fallbacks"""

    def __init__(self):
        self.providers = [
            self._gemma_via_openrouter,
            self._gemini_fallback,
            self._qwen_fallback
        ]

    async def analyze_images(self, images: List[Tuple[bytes, str]]) -> Dict[str, Any]:
        """Try providers in order until one succeeds"""
        for provider in self.providers:
            try:
                result = await provider(images)
                if result and "error" not in result:
                    return result
            except Exception as e:
                print(f"Provider failed: {e}")
                continue

        return {"error": "All vision providers failed"}

    async def _gemma_via_openrouter(self, images: List[Tuple[bytes, str]]) -> Optional[Dict[str, Any]]:
        """Primary: Gemma 4 26B via OpenRouter"""
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY not set")

        # Convert images to base64
        import base64
        image_parts = []
        for img_bytes, content_type in images[:3]:  # Max 3 images
            b64 = base64.b64encode(img_bytes).decode()
            image_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:{content_type};base64,{b64}"}
            })

        from app.llm.prompts import VISION_PROMPT

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    *image_parts
                ]
            }
        ]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "google/gemma-7b-it",  # Note: Using available model, adjust to Gemma 4 when available
                    "messages": messages,
                    "temperature": 0.1
                },
                timeout=60
            )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # Try to extract JSON from response
            try:
                # First attempt: direct JSON parse
                result = json.loads(content.strip())
            except json.JSONDecodeError:
                # Second attempt: find JSON in text
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    return {"error": f"Could not extract JSON from Gemma response: {content[:200]}"}

            # Validate with Pydantic model
            try:
                validated = VisionResult(**result)
                result_dict = validated.dict()
                result_dict["provider"] = "gemma_openrouter"
                return result_dict
            except Exception as e:
                return {"error": f"Invalid JSON structure from Gemma: {str(e)}"}
        else:
            return {"error": f"OpenRouter API error: {response.status_code}"}

    async def _gemini_fallback(self, images: List[Tuple[bytes, str]]) -> Optional[Dict[str, Any]]:
        """Fallback 1: Gemini 2.5 Flash"""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")  # Using available model

        # Convert images
        import PIL.Image
        from io import BytesIO
        pil_images = []
        for img_bytes, _ in images[:3]:
            img = PIL.Image.open(BytesIO(img_bytes))
            pil_images.append(img)

        from app.llm.prompts import VISION_PROMPT

        response = model.generate_content([VISION_PROMPT, *pil_images])

        try:
            # Configure Gemini to return JSON
            generation_config = genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )

            response = model.generate_content(
                [VISION_PROMPT, *pil_images],
                generation_config=generation_config
            )

            result = json.loads(response.text)

            # Validate with Pydantic model
            validated = VisionResult(**result)
            result_dict = validated.dict()
            result_dict["provider"] = "gemini_fallback"
            return result_dict

        except json.JSONDecodeError:
            return {"error": f"Failed to parse Gemini JSON response: {response.text[:200]}"}
        except Exception as e:
            return {"error": f"Gemini validation error: {str(e)}"}

    async def _qwen_fallback(self, images: List[Tuple[bytes, str]]) -> Optional[Dict[str, Any]]:
        """Fallback 2: Qwen 2.5 VL"""
        # Placeholder - implement if needed
        return {"error": "Qwen fallback not implemented yet"}


class TextChain:
    """Text generation chain using Cerebras"""

    async def generate_post(self, product_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate post using Cerebras Llama 3.3"""
        api_key = os.getenv("CEREBRAS_API_KEY")
        if not api_key:
            raise ValueError("CEREBRAS_API_KEY not set")

        from app.llm.prompts import POST_GEN_PROMPT
        prompt = POST_GEN_PROMPT.format(product_info=json.dumps(product_info, ensure_ascii=False))

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.cerebras.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3.1-70b",  # Adjust to exact model name
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "max_tokens": 1000
                },
                timeout=30
            )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            try:
                # Direct JSON parse first
                result = json.loads(content.strip())
            except json.JSONDecodeError:
                # Extract JSON from text
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    return {"error": f"Could not extract JSON from Cerebras response: {content[:200]}"}

            # Validate with Pydantic model
            try:
                validated = PostResult(**result)
                return validated.dict()
            except Exception as e:
                return {"error": f"Invalid JSON structure from Cerebras: {str(e)}"}
        else:
            return {"error": f"Cerebras API error: {response.status_code}"}