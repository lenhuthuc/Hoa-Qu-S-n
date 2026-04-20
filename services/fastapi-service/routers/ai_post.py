from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Request

from models import GeneratePostResponse, PostData, VisionResult, PricingResult, PostResult

router = APIRouter()


@router.post("/generate-post", response_model=GeneratePostResponse)
async def generate_post(
    request: Request,
    images: List[UploadFile] = File(...),
) -> GeneratePostResponse:
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
        return GeneratePostResponse(success=False, error=result["error"])

    vision: VisionResult = result.get("vision_result")
    if vision is None or vision.error:
        error_msg = vision.error if vision else "Không phân tích được ảnh"
        return GeneratePostResponse(success=False, error=error_msg)

    pricing: PricingResult = result["pricing_result"]
    post: PostResult = result["post_result"]

    return GeneratePostResponse(
        success=True,
        data=PostData(
            product_name=vision.product_name,
            grade=vision.grade,
            category=vision.category,
            freshness=vision.freshness,
            defects=vision.defects,
            certifications=vision.certifications,
            confidence=vision.confidence,
            provider=vision.provider,
            title=post.title,
            description=post.description,
            hashtags=post.hashtags,
            suggested_price_per_kg=pricing.suggested_price_per_kg,
            price_breakdown=pricing.breakdown,
            similar_products=pricing.market.similar_products,
            market_avg=pricing.market.market_avg,
            price_reasoning=pricing.market.note,
        ),
    )
