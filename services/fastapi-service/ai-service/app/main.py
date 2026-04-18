from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from typing import List
from app.agents.graph import build_graph
from app.storage.postgres import PostgresClient
from app.storage.qdrant_client import QdrantClientWrapper
from app.storage.minio_client import MinioClientWrapper
from app.models import GeneratePostResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown."""
    # Initialize clients
    postgres_client = PostgresClient()
    await postgres_client.connect()

    qdrant_client = QdrantClientWrapper()
    qdrant_client.ensure_collection()

    minio_client = MinioClientWrapper()
    minio_client.ensure_bucket()

    app.state.postgres_client = postgres_client
    app.state.qdrant_client = qdrant_client
    app.state.minio_client = minio_client

    yield

    # Cleanup
    await postgres_client.disconnect()


app = FastAPI(
    title="Hoa Quả Sơn — AI Service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/ai/generate-post", response_model=GeneratePostResponse)
async def generate_post(
    images: List[UploadFile] = File(...),
):
    if not images:
        raise HTTPException(status_code=400, detail="Cần ít nhất 1 ảnh")

    # Process images
    image_files = []
    for img in images[:5]:
        data = await img.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Ảnh {img.filename} quá lớn (tối đa 20MB)")
        image_files.append((data, img.content_type or "image/jpeg"))

    # Build graph and run
    graph = build_graph()

    try:
        result = await graph.ainvoke({
            "images": image_files,
            "postgres_client": app.state.postgres_client,
            "qdrant_client": app.state.qdrant_client,
            "minio_client": app.state.minio_client,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi pipeline: {str(exc)}")

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    # Return formatted response
    vision = result.get("vision_result", {})
    pricing = result.get("pricing_result", {})
    post = result.get("post_result", {})

    return GeneratePostResponse(
        success=True,
        draft_id=result.get("draft_id"),
        data={
            "product_name": vision.get("product_name"),
            "grade": vision.get("grade"),
            "category": vision.get("category"),
            "freshness": vision.get("freshness"),
            "defects": vision.get("defects", []),
            "certifications": vision.get("certifications", []),
            "confidence": vision.get("confidence", 0.8),
            "provider": vision.get("provider", "unknown"),
            "title": post.get("title"),
            "description": post.get("description"),
            "hashtags": post.get("hashtags", []),
            "suggested_price_per_kg": pricing.get("suggested_price_per_kg"),
            "price_breakdown": pricing.get("breakdown", []),
            "similar_products": pricing.get("market", {}).get("similar_products", []),
            "market_avg": pricing.get("market", {}).get("market_avg"),
            "price_reasoning": pricing.get("market", {}).get("note"),
        }
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy"}