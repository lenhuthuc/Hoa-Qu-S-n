from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
import logging


from chatbot.agent import get_chatbot_brain 

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str

@router.post("/message")
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint này sẽ có URL đầy đủ là: POST /api/chatbot/message
    (Do main.py đã đặt prefix="/api/chatbot")
    """
    try:

        brain = get_chatbot_brain()

        result = brain.invoke({
            "messages": [HumanMessage(content=request.message)]
        })
        
 
        bot_reply = result["messages"][-1].content
        
        return {
            "success": True,
            "data": {
                "reply": bot_reply
            }
        }
    except Exception as e:
        logger.error(f"Chatbot Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Trợ lý AI đang đi vắng, vui lòng thử lại sau!")