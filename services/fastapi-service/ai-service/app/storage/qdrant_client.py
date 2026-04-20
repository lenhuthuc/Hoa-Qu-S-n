from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import os
from typing import List, Dict, Any
import numpy as np


class QdrantClientWrapper:
    def __init__(self):
        self.client = QdrantClient(
            host=os.getenv("QDRANT_HOST", "localhost"),
            port=int(os.getenv("QDRANT_PORT", 6333))
        )
        self.collection_name = "fruit_products"

    def ensure_collection(self):
     
        if not self.client.collection_exists(self.collection_name):
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=768, 
                    distance=Distance.COSINE
                )
            )
            print(f"Đã tạo collection: {self.collection_name}")
        else:
            print(f"Collection {self.collection_name} đã sẵn sàng.")

    def search_similar(self, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar products"""
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit
        )

        return [
            {
                "product_name": hit.payload.get("product_name"),
                "grade": hit.payload.get("grade"),
                "price": hit.payload.get("price"),
                "score": hit.score
            }
            for hit in results
        ]

    def add_products(self, products: List[Dict[str, Any]], vectors: List[List[float]]):
        """Add products with their vectors"""
        points = []
        for i, (product, vector) in enumerate(zip(products, vectors)):
            points.append(PointStruct(
                id=i,
                vector=vector,
                payload=product
            ))

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )