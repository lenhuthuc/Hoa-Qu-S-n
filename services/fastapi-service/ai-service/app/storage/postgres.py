import asyncpg
import os
import json 
from typing import Optional, Dict, Any

class PostgresClient:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(
                os.getenv("POSTGRES_URL", "postgresql://postgres:postgres@localhost:5432/hoaquason")
            )

    async def disconnect(self):
        if self.pool:
            await self.pool.close()


    async def ensure_tables(self):
        """Kiểm tra và tự động tạo bảng nếu chưa có"""
        if not self.pool:
            await self.connect()

        async with self.pool.acquire() as conn:
            # 1. Tạo bảng post_drafts 
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS post_drafts (
                    id SERIAL PRIMARY KEY,
                    vision_result JSONB,
                    pricing_result JSONB,
                    post_result JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)


            await conn.execute("""
                CREATE TABLE IF NOT EXISTS product_references (
                    id SERIAL PRIMARY KEY,
                    product_name VARCHAR(255),
                    grade VARCHAR(50),
                    price NUMERIC,
                    category VARCHAR(100),
                    source VARCHAR(100),
                    UNIQUE(product_name, grade) 
                );
            """)
            print("✅ Đã khởi tạo các bảng PostgreSQL thành công!")

    async def save_draft(self, draft_data: Dict[str, Any]) -> str:
        """Save post draft to database"""
        if not self.pool:
            await self.connect()

        query = """
        INSERT INTO post_drafts (vision_result, pricing_result, post_result, created_at)
        VALUES ($1::jsonb, $2::jsonb, $3::jsonb, NOW())
        RETURNING id
        """

        async with self.pool.acquire() as conn:
            result = await conn.fetchrow(
                query,

                json.dumps(draft_data.get("vision_result", {})),
                json.dumps(draft_data.get("pricing_result", {})),
                json.dumps(draft_data.get("post_result", {}))
            )
            return str(result["id"])

    async def save_product_reference(self, product_data: Dict[str, Any]):
        """Save product reference to database"""
        if not self.pool:
            await self.connect()

        query = """
        INSERT INTO product_references (product_name, grade, price, category, source)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (product_name, grade) DO NOTHING
        """

        async with self.pool.acquire() as conn:
            await conn.execute(query,
                product_data.get("name"),
                product_data.get("grade"),
                product_data.get("price"),
                product_data.get("category"),
                product_data.get("source", "crawl")
            )