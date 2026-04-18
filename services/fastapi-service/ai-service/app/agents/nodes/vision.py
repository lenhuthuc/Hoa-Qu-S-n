from typing import Dict, Any
from app.agents.state import PostGenState
from app.llm.providers import VisionProviderChain


async def vision_extractor(state: PostGenState) -> Dict[str, Any]:
    """Extract features from images using vision AI"""
    images = state["images"]

    chain = VisionProviderChain()
    result = await chain.analyze_images(images)

    if "error" in result:
        return {"error": result["error"]}

    return {"vision_result": result}