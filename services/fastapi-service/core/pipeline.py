"""
LangGraph pipeline: validate → vision → safety_check → pricing → post_gen
"""

from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END

from models import VisionResult, PricingResult, PostResult


class PostGenState(TypedDict):
    images: list                          # list of (bytes, content_type) tuples
    embedding_service: Any
    vision_result: Optional[VisionResult]
    pricing_result: Optional[PricingResult]
    post_result: Optional[PostResult]
    error: Optional[str]


async def _validate(state: PostGenState) -> dict:
    images = state.get("images", [])
    if not images:
        return {"error": "Cần ít nhất 1 ảnh"}
    
    # Limit to 5 images and force update
    final_images = images[:5] if len(images) > 5 else images
    return {"images": list(final_images), "error": None}


async def _vision(state: PostGenState) -> dict:
    from core.vision_chain import analyze_images
    try:
        result: VisionResult = await analyze_images(state["images"])
        return {"vision_result": result}
    except Exception as exc:
        return {"error": str(exc)}


def _safety_route(state: PostGenState) -> str:
    if state.get("error"):
        return "error"
    vision: Optional[VisionResult] = state.get("vision_result")
    if vision is None or vision.error:
        return "error"
    return "ok"


async def _pricing(state: PostGenState) -> dict:
    from core.pricing import calculate_price
    v: VisionResult = state["vision_result"]
    result: PricingResult = await calculate_price(
        product_name=v.product_name,
        grade=v.grade,
        defects=v.defects,
        certifications=v.certifications,
        freshness=v.freshness,
        embedding_service=state.get("embedding_service"),
        category=v.category,
        features=v.features,
    )
    return {"pricing_result": result}


async def _post_gen(state: PostGenState) -> dict:
    from core.post_generator import generate_post
    v: VisionResult = state["vision_result"]
    pricing: PricingResult = state["pricing_result"]
    info = {
        "product_name": v.product_name,
        "grade": v.grade,
        "category": v.category,
        "freshness": v.freshness,
        "defects": v.defects,
        "certifications": v.certifications,
        "description": v.description,
        "title": v.title,
        "suggested_price_per_kg": pricing.suggested_price_per_kg,
    }
    post: PostResult = await generate_post(info)
    return {"post_result": post}


def _build() -> Any:
    g = StateGraph(PostGenState)
    g.add_node("validate", _validate)
    g.add_node("vision", _vision)
    g.add_node("pricing", _pricing)
    g.add_node("post_gen", _post_gen)

    g.set_entry_point("validate")
    g.add_edge("validate", "vision")
    g.add_conditional_edges("vision", _safety_route, {"ok": "pricing", "error": END})
    g.add_edge("pricing", "post_gen")
    g.add_edge("post_gen", END)

    return g.compile()


_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = _build()
    return _pipeline
