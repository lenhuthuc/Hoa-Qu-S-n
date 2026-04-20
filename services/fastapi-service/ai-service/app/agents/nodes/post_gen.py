from typing import Dict, Any
from app.agents.state import PostGenState
from app.llm.providers import TextChain


async def post_generator(state: PostGenState) -> Dict[str, Any]:
    """Generate post content using text AI"""
    vision = state["vision_result"]
    pricing = state["pricing_result"]

    # Prepare product info for prompt
    product_info = {
        "product_name": vision.get("product_name"),
        "grade": vision.get("grade"),
        "freshness": vision.get("freshness"),
        "defects": vision.get("defects", []),
        "certifications": vision.get("certifications", []),
        "price_per_kg": pricing["suggested_price_per_kg"],
        "category": vision.get("category")
    }

    chain = TextChain()
    result = await chain.generate_post(product_info)

    if "error" in result:
        return {"error": result["error"]}

    return {"post_result": result}


async def save_draft(state: PostGenState) -> Dict[str, Any]:
    """Save draft to database"""
    postgres_client = state["postgres_client"]

    draft_data = {
        "vision_result": state.get("vision_result"),
        "pricing_result": state.get("pricing_result"),
        "post_result": state.get("post_result")
    }

    try:
        draft_id = await postgres_client.save_draft(draft_data)
        return {"draft_id": draft_id}
    except Exception as e:
        return {"error": f"Failed to save draft: {str(e)}"}