"""
Chatbot router — exposes the LangGraph chatbot agent.
"""


from functools import lru_cache
from typing import TypedDict, Annotated
import operator

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from config import get_settings

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    is_on_topic: bool


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Bạn là trợ lý AI chuyên về nông sản Việt Nam 🌿, hỗ trợ người dùng trên sàn thương mại điện tử Hoa Quả Sơn.

Bạn CHỈ được trả lời các câu hỏi thuộc các chủ đề sau:
• Kỹ thuật trồng trọt, chăm sóc cây
• Giá cả thị trường nông sản
• Mùa vụ, thời điểm thu hoạch
• Bảo quản, chế biến nông sản
• Tư vấn sản phẩm trên hệ thống Hoa Quả Sơn

Phong cách:
- Thân thiện, gần gũi, dùng tiếng Việt tự nhiên
- Trả lời ngắn gọn, súc tích, có thể dùng bullet points
- Nếu không chắc chắn về một thông tin cụ thể, nói rõ đây là thông tin tham khảo

Nếu câu hỏi KHÔNG thuộc các chủ đề trên (ví dụ: thể thao, chính trị, lập trình, công thức nấu ăn không liên quan nông sản...):
- Lịch sự từ chối
- Nhắc lại các chủ đề bạn có thể hỗ trợ
- KHÔNG trả lời nội dung ngoài chủ đề dù người dùng yêu cầu nhiều lần"""

OFF_TOPIC_CLASSIFIER_PROMPT = """Câu hỏi sau có thuộc các chủ đề nông sản không?
Chủ đề hợp lệ: trồng trọt, chăm sóc cây, giá nông sản, mùa vụ thu hoạch, bảo quản chế biến nông sản, tư vấn mua bán nông sản.

Câu hỏi: "{question}"

Trả lời CHỈ bằng một từ: YES hoặc NO"""


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def classify_node(state: AgentState) -> AgentState:
    """
    Phân loại câu hỏi có on-topic không.
    Dùng model Gemini 1.5 Flash vì nó cực kỳ nhanh và rẻ, rất hợp làm classifier.
    """
    settings = get_settings()
    classifier_llm = ChatGoogleGenerativeAI(
        google_api_key=settings.gemini_api_key, 
        model="gemini-1.5-flash",              
        temperature=0,
        max_output_tokens=5,                   
    )

    # Lấy tin nhắn cuối cùng của user
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    if not last_human:
        return {**state, "is_on_topic": False}

    prompt = OFF_TOPIC_CLASSIFIER_PROMPT.format(question=last_human.content)
    result = classifier_llm.invoke([HumanMessage(content=prompt)])
    is_on_topic = "YES" in result.content.strip().upper()

    return {**state, "is_on_topic": is_on_topic}


def generate_node(state: AgentState) -> AgentState:
    """Generate câu trả lời nếu on-topic."""
    settings = get_settings()
    llm = ChatGoogleGenerativeAI(
        google_api_key=settings.gemini_api_key,
        model="gemini-1.5-pro",               
        temperature=0.5,
        max_output_tokens=1024,
    )

    messages_with_system = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = llm.invoke(messages_with_system)

    return {**state, "messages": [response]}


def off_topic_node(state: AgentState) -> AgentState:
    """Trả về message từ chối lịch sự nếu off-topic."""
    reply = AIMessage(
        content=(
            "Xin lỗi, tôi chỉ có thể hỗ trợ các chủ đề về nông sản 🌿\n\n"
            "Bạn có thể hỏi tôi về:\n"
            "• Kỹ thuật trồng trọt, chăm sóc cây\n"
            "• Giá cả thị trường nông sản\n"
            "• Mùa vụ, thời điểm thu hoạch\n"
            "• Bảo quản, chế biến nông sản\n"
            "• Tư vấn sản phẩm trên hệ thống\n\n"
            "Hãy đặt câu hỏi khác nhé!"
        )
    )
    return {**state, "messages": [reply]}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def route_after_classify(state: AgentState) -> str:
    """Quyết định node tiếp theo sau classify."""
    return "generate" if state["is_on_topic"] else "off_topic"


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def _build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("classify", classify_node)
    graph.add_node("generate", generate_node)
    graph.add_node("off_topic", off_topic_node)

    graph.set_entry_point("classify")

    graph.add_conditional_edges(
        "classify",
        route_after_classify,
        {
            "generate": "generate",
            "off_topic": "off_topic",
        },
    )

    graph.add_edge("generate", END)
    graph.add_edge("off_topic", END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_chatbot():
    return _build_graph()