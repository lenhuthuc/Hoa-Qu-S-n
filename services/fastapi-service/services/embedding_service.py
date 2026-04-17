"""
Embedding service — manages Qdrant vector collection and text embeddings.
Uses multilingual-e5-base for Vietnamese text support.
"""

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    PointIdsList,
)
from sentence_transformers import SentenceTransformer
from config import Settings


class EmbeddingService:
    def __init__(self, settings: Settings):
        self.client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        self.collection_name = settings.qdrant_collection
        self.model = SentenceTransformer(settings.embedding_model)
        self.vector_size = self.model.get_sentence_embedding_dimension()

    def ensure_collection(self):
        """Create Qdrant collection if it doesn't exist."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.vector_size,
                    distance=Distance.COSINE,
                ),
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="category",
                field_schema="keyword",
            )


    def embed_text(self, text: str) -> list[float]:
        """Encode text to embedding vector. Prefix with 'query:' for e5 models."""
        return self.model.encode(f"query: {text}").tolist()

    def embed_passage(self, text: str) -> list[float]:
        """Encode passage for storage. Prefix with 'passage:' for e5 models."""
        return self.model.encode(f"passage: {text}").tolist()

    def upsert_product(self, product_id: int, product_name: str, description: str,
                       category: str, price: float, image: str = None):
        """Embed and store a product in Qdrant."""
        # Combine fields for richer embedding
        combined_text = f"Tên sản phẩm: {product_name}. Phân loại: {category or 'Khác'}. Đặc điểm chi tiết: {description or 'Không có'}."
        vector = self.embed_passage(combined_text)

        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=product_id,
                    vector=vector,
                    payload={
                        "product_id": product_id,
                        "product_name": product_name,
                        "description": description or "",
                        "category": category or "",
                        "price": price,
                        "image": image or "",
                    },
                )
            ],
        )

    def search(self, query: str, limit: int = 10, category: str = None) -> list[dict]:
        """Semantic search for products matching a natural language query."""
        query_vector = self.embed_text(query)

        search_filter = None
        if category:
            search_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=category))]
            )

        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=search_filter,
            limit=limit,
            with_payload=True,
        )

        return [
            {
                "product_id": hit.payload.get("product_id"),
                "product_name": hit.payload.get("product_name"),
                "description": hit.payload.get("description"),
                "category": hit.payload.get("category"),
                "price": hit.payload.get("price"),
                "image": hit.payload.get("image"),
                "score": round(hit.score, 4),
            }
            for hit in results
        ]

    def delete_product(self, product_id: int):
        """Remove a product from the vector store."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=PointIdsList(points=[product_id], shard_key=None),
        )
