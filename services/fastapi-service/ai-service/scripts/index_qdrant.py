#!/usr/bin/env python3
"""
Index crawled products into Qdrant vector database
"""

import json
import os
from app.storage.qdrant_client import QdrantClientWrapper
from app.storage.postgres import PostgresClient
import asyncio


async def index_products():
    """Load products and index them in Qdrant"""

    # Load crawled data
    data_file = "scripts/crawled_products.json"
    if not os.path.exists(data_file):
        print("No crawled data found. Run crawl scripts first.")
        return

    with open(data_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products")

    # Initialize clients
    qdrant_client = QdrantClientWrapper()
    qdrant_client.ensure_collection()

    postgres_client = PostgresClient()
    await postgres_client.connect()

    # Create embeddings (placeholder - use Gemini Embedding API)
    vectors = []
    for product in products:
        # In real implementation, generate embeddings from product descriptions
        # For now, use random vectors
        import numpy as np
        vector = np.random.rand(768).tolist()  # Gemini embedding size
        vectors.append(vector)

    # Index in Qdrant
    qdrant_client.add_products(products, vectors)

    # Save to Postgres reference table
    for product in products:
        await postgres_client.save_product_reference(product)

    await postgres_client.disconnect()

    print(f"Indexed {len(products)} products in Qdrant")


if __name__ == "__main__":
    asyncio.run(index_products())