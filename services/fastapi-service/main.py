from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from routers import ai_post, semantic_search, chatbot


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown."""
    settings = get_settings()

    # Initialize Qdrant collection on startup
    from services.embedding_service import EmbeddingService
    embedding_svc = EmbeddingService(settings)
    embedding_svc.ensure_collection()
    app.state.embedding_service = embedding_svc

    # Initialize MongoDB connection
    from motor.motor_asyncio import AsyncIOMotorClient
    app.state.mongo_client = AsyncIOMotorClient(settings.mongo_url)
    app.state.mongo_db = app.state.mongo_client["hoaquason"]

    yield

    # Cleanup
    app.state.mongo_client.close()


app = FastAPI(
    title="Hoa Quả Sơn — AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://haquason.uk",
        "https://www.haquason.uk",
        "https://api.haquason.uk",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───
app.include_router(ai_post.router, prefix="/api/ai", tags=["AI"])
app.include_router(semantic_search.router, prefix="/api/search", tags=["Search"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])


@app.get("/health")
async def health():
    return {"success": True, "data": {"service": "fastapi", "status": "ok"}}
