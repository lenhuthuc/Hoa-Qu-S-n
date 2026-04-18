"""
LangGraph pipeline: validate → vision → safety_check → pricing → post_gen
"""

from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END


class PostGenState(TypedDict):
    images: list          # list of (bytes, content_type) tuples
    embedding_service: Any
    vision_result: Optional[dict]
    pricing_result: Optional[dict]
    post_result: Optional[dict]
    error: Optional[str]


async def _validate(state: PostGenState) -> dict:
    images = state.get("images", [])
    if not images:
        return {"error": "Cần ít nhất 1 ảnh"}
    if len(images) > 5:
        return {"images": images[:5]}
    return {}


async def _vision(state: PostGenState) -> dict:
    from core.vision_chain import analyze_images
    try:
        result = await analyze_images(state["images"])
        return {"vision_result": result}
    except Exception as exc:
        return {"error": str(exc)}


def _safety_route(state: PostGenState) -> str:
    if state.get("error"):
        return "error"
    vision = state.get("vision_result") or {}
    if "error" in vision:
        return "error"
    return "ok"


async def _pricing(state: PostGenState) -> dict:
    from core.pricing import calculate_price
    v = state["vision_result"]
    result = await calculate_price(
        product_name=v.get("product_name", ""),
        grade=v.get("grade", "Loại 2"),
        defects=v.get("defects", []),
        certifications=v.get("certifications", []),
        freshness=v.get("freshness", "Tươi"),
        embedding_service=state.get("embedding_service"),
    )
    return {"pricing_result": result}


async def _post_gen(state: PostGenState) -> dict:
    from core.post_generator import generate_post
    info = {
        **state["vision_result"],
        "suggested_price_per_kg": state["pricing_result"]["suggested_price_per_kg"],
    }
    post = await generate_post(info)
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
