"""
Chatbot router — exposes the LangGraph chatbot agent.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from chatbot.agent import get_chatbot
from config import get_settings

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None  # [{"role": "user"|"assistant", "content": "..."}]


class ChatResponse(BaseModel):
    reply: str
    on_topic: bool


@router.post("/message", response_model=dict)
async def chat_message(body: ChatRequest):
    """Send a message to the seller chatbot."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    # Build message history
    messages = []
    if body.history:
        for msg in body.history[-10:]:  # Keep last 10 messages for context
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                from langchain_core.messages import AIMessage
                messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=body.message))

    try:
        chatbot = get_chatbot()
        result = chatbot.invoke({"messages": messages, "is_on_topic": True})

        reply = result["messages"][-1].content
        on_topic = result.get("is_on_topic", True)

        return {
            "success": True,
            "data": {
                "reply": reply,
                "on_topic": on_topic,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")
