"""
Feature 3: Seller Chatbot
LangGraph state Llama via Groq — RAG from platform FAQ knowledge base
"""

from typing import TypedDict, Annotated, Sequence
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
import operator
from config import get_settings
# ─── FAQ Knowledge Base ───
FAQ_KNOWLEDGE = """
## Hoa Quả Sơn — Câu Hỏi Thường Gặp

### Đăng bán sản phẩm
- Vào "Quản lý sản phẩm" → "Thêm sản phẩm mới"
- Upload ảnh sản phẩm, hệ thống AI sẽ tự động gợi ý tiêu đề, mô tả và giá
- Bạn có thể chỉnh sửa nội dung AI tạo trước khi đăng
- Sản phẩm sẽ được tự động index cho tìm kiếm ngữ nghĩa

### Livestream bán hàng
- Vào "Livestream" → "Bắt đầu phát sóng"
- Cho phép camera/microphone khi trình duyệt yêu cầu
- Người xem có thể đặt hàng trực tiếp trong livestream
- Stream hỗ trợ 3 chất lượng: HD (720p), SD (480p), LD (360p)

### Quản lý đơn hàng
- Trạng thái đơn: PENDING → PAID → SHIPPED → FINISHED
- Đơn hàng COD sẽ tự động tạo hóa đơn
- Đơn VNPay cần chờ xác nhận thanh toán
- Có thể hủy đơn khi trạng thái còn PENDING

### Truy xuất nguồn gốc
- Vào "Nhật ký canh tác" để ghi lại quá trình trồng trọt
- Upload ảnh hàng ngày, hệ thống trích xuất GPS tự động
- Khi thu hoạch, tạo mã QR cho lô hàng
- Người mua quét QR để xem toàn bộ quá trình

### Vận chuyển
- Hỗ trợ GHN và GHTK
- Hệ thống tự động kiểm tra thời gian giao hàng vs hạn sử dụng
- Phương thức vận chuyển không phù hợp sẽ bị ẩn tự động

### Thanh toán
- COD (thanh toán khi nhận hàng)
- VNPay (chuyển khoản online)
- MoMo (ví điện tử)

### Chính sách
- Sản phẩm phải là nông sản thật, có nguồn gốc rõ ràng
- Không bán hàng giả, hàng kém chất lượng
- Đánh giá sản phẩm chỉ khi đã mua hàng
- Vi phạm sẽ bị khóa tài khoản
"""

SYSTEM_PROMPT = f"""Bạn là trợ lý AI của nền tảng Hoa Quả Sơn — sàn thương mại điện tử nông sản Việt Nam.
Bạn chỉ trả lời các câu hỏi liên quan đến:
- Cách sử dụng nền tảng Hoa Quả Sơn
- Đăng bán sản phẩm, quản lý đơn hàng
- Livestream, thanh toán, vận chuyển
- Truy xuất nguồn gốc nông sản

Nếu câu hỏi KHÔNG liên quan đến nền tảng, trả lời: "Xin lỗi, tôi chỉ hỗ trợ các câu hỏi liên quan đến nền tảng Hoa Quả Sơn."

Kiến thức nền tảng:
{FAQ_KNOWLEDGE}

Trả lời ngắn gọn, thân thiện, bằng tiếng Việt."""


class ChatState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    is_on_topic: bool

def create_chatbot_graph():
    settings = get_settings()


    # 1. Model nhẹ để điều hướng (Classify/Guardrails) - Dùng Llama 3.1 8B (Groq)
    classifier_llm = ChatGroq(
        api_key=settings.groq_api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0
    )

    # 2. Model mạnh để trả lời (Generate) - Dùng Llama 3.3 70B (Groq)
    generator_llm = ChatGroq(
        api_key=settings.groq_api_key,
        model_name="llama-3.3-70b-versatile",
        temperature=0.4
    )

    def check_guardrails(state: ChatState):
        last_message = state["messages"][-1]
        
        check_prompt = ChatPromptTemplate.from_messages([
            ("system", "Bạn là bộ lọc. Trả lời 'YES' nếu câu hỏi liên quan đến nông sản hoặc nền tảng thương mại điện tử Hoa Quả Sơn. Ngược lại trả lời 'NO'."),
            ("human", "{question}"),
        ])
        
        result = classifier_llm.invoke(check_prompt.format_messages(question=last_message.content))
        is_on_topic = "YES" in result.content.upper()
        
  
        return {"is_on_topic": is_on_topic}

    def generate_response(state: ChatState):

        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(state["messages"])
        response = generator_llm.invoke(messages)
        return {"messages": [response]}

    def reject_query(state: ChatState):
        msg = AIMessage(content="Xin lỗi, tôi chỉ hỗ trợ các câu hỏi liên quan đến nền tảng Hoa Quả Sơn. Bạn có thể hỏi về cách đăng bán, đơn hàng, hoặc kỹ thuật cây trồng.")
        return {"messages": [msg]}

    def route_after_guardrails(state: ChatState):
        return "generate" if state["is_on_topic"] else "reject"

    graph = StateGraph(ChatState)
    graph.add_node("guardrails", check_guardrails)
    graph.add_node("generate", generate_response)
    graph.add_node("reject", reject_query)

    graph.set_entry_point("guardrails")
    graph.add_conditional_edges("guardrails", route_after_guardrails)
    graph.add_edge("generate", END)
    graph.add_edge("reject", END)

    return graph.compile()

_chatbot_graph = None

def get_chatbot_brain(): 
    global _chatbot_graph
    if _chatbot_graph is None:
        _chatbot_graph = create_chatbot_graph()
    return _chatbot_graph