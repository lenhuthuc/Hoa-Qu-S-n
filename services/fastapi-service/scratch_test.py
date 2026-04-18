import asyncio
import sys
import os

# Add the core directory to path
sys.path.append("c:/Users/admin/myProject/HoaQuaSon/services/fastapi-service")

from core.pipeline import get_pipeline

async def test():
    pipeline = get_pipeline()
    try:
        # Mock state
        state = {
            "images": [(b"test", "image/jpeg")],
            "embedding_service": None,
            "vision_result": None,
            "pricing_result": None,
            "post_result": None,
            "error": None,
        }
        print("Invoking pipeline...")
        result = await pipeline.ainvoke(state)
        print("Result:", result)
    except Exception as e:
        print("Pipeline Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
