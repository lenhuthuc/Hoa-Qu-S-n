from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # AI APIs
    gemini_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    cerebras_api_key: str = ""

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "products"

    # MongoDB
    mongo_url: str = "mongodb://localhost:27017/hoaquason"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Spring service
    spring_service_url: str = "http://localhost:8080"

    # Embedding model
    embedding_model: str = "intfloat/multilingual-e5-base"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
