"""
Feature 6: Semantic Search
Embed product catalog → Qdrant → cosine similarity for intent queries like "trái cây giải nhiệt"
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

router = APIRouter()


class EmbedProductRequest(BaseModel):
    product_id: int
    product_name: str
    description: str | None = None
    category: str | None = None
    price: float = 0
    image: str | None = None


class BulkEmbedRequest(BaseModel):
    products: list[EmbedProductRequest]


@router.post("/embed-product")
async def embed_product(request: Request, body: EmbedProductRequest):
    """Embed a single product into Qdrant for semantic search."""
    svc = request.app.state.embedding_service
    try:
        svc.upsert_product(
            product_id=body.product_id,
            product_name=body.product_name,
            description=body.description,
            category=body.category,
            price=body.price,
            image=body.image,
        )
        return {
            "success": True,
            "data": {"message": f"Product {body.product_id} embedded successfully"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed-bulk")
async def embed_bulk(request: Request, body: BulkEmbedRequest):
    """Embed multiple products into Qdrant."""
    svc = request.app.state.embedding_service
    embedded = 0
    errors = []
    for p in body.products:
        try:
            svc.upsert_product(
                product_id=p.product_id,
                product_name=p.product_name,
                description=p.description,
                category=p.category,
                price=p.price,
                image=p.image,
            )
            embedded += 1
        except Exception as e:
            errors.append({"product_id": p.product_id, "error": str(e)})

    return {
        "success": True,
        "data": {"embedded": embedded, "total": len(body.products), "errors": errors},
    }


@router.get("/semantic")
async def semantic_search(
    request: Request,
    q: str = Query(..., min_length=1, description="Natural language search query"),
    limit: int = Query(10, ge=1, le=50),
    category: str = Query(None, description="Filter by category"),
):
    """
    Semantic search for products using natural language.
    Examples: "trái cây giải nhiệt", "rau sạch organic", "đặc sản miền Tây"
    """
    svc = request.app.state.embedding_service
    try:
        results = svc.search(query=q, limit=limit, category=category)
        return {
            "success": True,
            "data": {
                "query": q,
                "total": len(results),
                "results": results,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/product/{product_id}")
async def delete_product_embedding(request: Request, product_id: int):
    """Remove a product from the semantic search index."""
    svc = request.app.state.embedding_service
    try:
        svc.delete_product(product_id)
        return {"success": True, "data": {"message": f"Product {product_id} removed from index"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
