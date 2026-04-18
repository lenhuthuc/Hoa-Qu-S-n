from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Request

router = APIRouter()


@router.post("/generate-post", response_model=dict)
async def generate_post(
    request: Request,
    images: List[UploadFile] = File(...),
):
    if not images:
        raise HTTPException(status_code=400, detail="Cần ít nhất 1 ảnh")

    image_files = []
    for img in images[:5]:
        data = await img.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Ảnh {img.filename} quá lớn (tối đa 20MB)")
        image_files.append((data, img.content_type or "image/jpeg"))

    from core.pipeline import get_pipeline
    pipeline = get_pipeline()

    try:
        result = await pipeline.ainvoke({
            "images": image_files,
            "embedding_service": request.app.state.embedding_service,
            "vision_result": None,
            "pricing_result": None,
            "post_result": None,
            "error": None,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi pipeline: {str(exc)}")

    if result.get("error"):
        return {"success": False, "error": result["error"]}

    vision = result.get("vision_result") or {}
    if "error" in vision:
        return {"success": False, "error": vision["error"]}

    pricing = result["pricing_result"]
    post = result["post_result"]

    return {
        "success": True,
        "data": {
            "product_name": vision.get("product_name"),
            "grade": vision.get("grade"),
            "category": vision.get("category"),
            "freshness": vision.get("freshness"),
            "defects": vision.get("defects", []),
            "certifications": vision.get("certifications", []),
            "confidence": vision.get("confidence", 0.8),
            "provider": vision.get("provider", "gemini"),
            "title": post["title"],
            "description": post["description"],
            "hashtags": post.get("hashtags", []),
            "suggested_price_per_kg": pricing["suggested_price_per_kg"],
            "price_breakdown": pricing["breakdown"],
            "similar_products": pricing["market"]["similar_products"],
            "market_avg": pricing["market"]["market_avg"],
            "price_reasoning": pricing["market"]["note"],
        },
    }