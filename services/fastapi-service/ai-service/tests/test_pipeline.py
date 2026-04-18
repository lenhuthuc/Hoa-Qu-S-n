#!/usr/bin/env python3
"""
Test the AI pipeline with sample images
"""

import asyncio
import os
from app.agents.graph import build_graph
from app.storage.postgres import PostgresClient
from app.storage.qdrant_client import QdrantClientWrapper
from app.storage.minio_client import MinioClientWrapper


async def test_pipeline():
    """Test pipeline with mock data"""

    # Mock image data (in real test, load actual images)
    mock_images = [
        (b"fake_jpeg_data", "image/jpeg"),
        (b"fake_jpeg_data2", "image/jpeg")
    ]

    # Initialize clients
    postgres_client = PostgresClient()
    await postgres_client.connect()

    qdrant_client = QdrantClientWrapper()
    qdrant_client.ensure_collection()

    minio_client = MinioClientWrapper()
    minio_client.ensure_bucket()

    # Build and run graph
    graph = build_graph()

    result = await graph.ainvoke({
        "images": mock_images,
        "postgres_client": postgres_client,
        "qdrant_client": qdrant_client,
        "minio_client": minio_client,
    })

    await postgres_client.disconnect()

    print("Pipeline result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(test_pipeline())