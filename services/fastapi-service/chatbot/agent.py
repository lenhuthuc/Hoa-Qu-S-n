import os
import sys
import operator
from typing import TypedDict, Annotated, Sequence

from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition

from config import get_settings

# ==========================================
# CẤU HÌNH IMPORT TỪ THƯ MỤC CÓ DẤU GẠCH NGANG
# ==========================================
current_dir = os.path.dirname(os.path.abspath(__file__))
ai_service_path = os.path.abspath(os.path.join(current_dir, "../ai-service"))

if ai_service_path not in sys.path:
    sys.path.append(ai_service_path)

try:
    from app.storage.qdrant_client import QdrantClientWrapper
    qdrant_client = QdrantClientWrapper()
except ImportError as e:
    qdrant_client = None

# ==========================================
# TOOL (CÔNG CỤ) TÌM KIẾM SẢN PHẨM
# ==========================================
@tool
def search_products(query: str) -> str:
    """Sử dụng công cụ này để tìm kiếm thông tin, tên, và giá cả sản phẩm nông sản trong kho Hoa Quả Sơn khi người dùng có nhu cầu mua hàng."""
    if not qdrant_client:
        return "Hệ thống tra cứu sản phẩm tạm thời mất kết nối."
    try:
        results = qdrant_client.search(query=query, limit=3)
        if not results:
            return f"Không tìm thấy sản phẩm nào phù hợp với '{query}'."
            
        formatted_result = f"Thông tin kho hàng cho '{query}':\n"
        for item in results:
            name = item.get("product_name", "Nông sản")
            price = item.get("price", "Đang cập nhật")
            formatted_result += f"- {name}: {price} VNĐ\n"
        return formatted_result
    except Exception as e:
        return f"Lỗi truy vấn cơ sở dữ liệu: {e}"

# Khai báo danh sách các công cụ cho LLM
tools_list = [search_products]

# ==========================================
# KNOWLEDGE BASE
# ==========================================
def load_knowledge_from_readme():
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(current_dir, "../../../"))
        readme_path = os.path.join(root_dir, "README.md")
        
        with open(readme_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return """
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

PLATFORM_INFO = load_knowledge_from_readme()

# --- PROMPT GIỮ NGUYÊN BẢN CỦA BẠN ---
SYSTEM_PROMPT = f"""Bạn là trợ lý chuyên gia nông nghiệp của nền tảng Hoa Quả Sơn.
Bạn được phép hỗ trợ khách hàng 2 nhóm chủ đề sau:
1. Kiến thức nông nghiệp: Kỹ thuật trồng trọt, chăm sóc cây trồng, mùa vụ, bảo quản nông sản.
2. Nền tảng Hoa Quả Sơn: Đăng bán, đơn hàng, livestream, thanh toán, truy xuất nguồn gốc.

Nếu câu hỏi KHÔNG thuộc 2 nhóm trên (ví dụ: thể thao, giải trí, toán học...), hãy từ chối lịch sự: "Xin lỗi, tôi chỉ hỗ trợ các câu hỏi về nông nghiệp và nền tảng Hoa Quả Sơn."

Kiến thức về nền tảng (dùng để trả lời nhóm 2):
{PLATFORM_INFO}

Trả lời ngắn gọn, thân thiện, tự nhiên như một chuyên gia bằng tiếng Việt."""


class ChatState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    intent: str  
# ==========================================
# ĐỒ THỊ LANGGRAPH
# ==========================================
def create_chatbot_graph():
    settings = get_settings()

    # 1. Model nhẹ để điều hướng
    classifier_llm = ChatGroq(
        api_key=settings.groq_api_key,
        model_name="llama-3.1-8b-instant",
        temperature=0
    )

    # 2. Model mạnh để trả lời
    generator_llm = ChatGroq(
        api_key=settings.groq_api_key,
        model_name="llama-3.3-70b-versatile",
        temperature=0
    )
    generator_with_tools = generator_llm.bind_tools(tools_list)

    def check_guardrails(state: ChatState):
        last_message = state["messages"][-1]
        
        check_prompt = ChatPromptTemplate.from_messages([
            ("system", """Bạn là chuyên gia phân tích ý định. CHỈ trả về 1 từ khóa duy nhất:
            
            - AGRI: Nếu câu hỏi chứa các từ khóa về hành động: trồng, chăm sóc, bón phân, tưới nước, sâu bệnh, kỹ thuật, mùa vụ (ví dụ: 'cách trồng cam', 'cam bị vàng lá').
            - PRODUCT: Nếu câu hỏi về: giá cả, mua hàng, tìm shop, còn hàng không, phí ship (ví dụ: 'giá cam', 'mua cam ở đâu').
            - FAQ: Nếu hỏi về: đăng bài, tài khoản, livestream, thanh toán trên web.
            - REJECT: Các chủ đề khác.
            """),
            ("human", "{question}"),
        ])
        
        result = classifier_llm.invoke(check_prompt.format_messages(question=last_message.content))
        intent = result.content.strip().upper()
        
        # Logic bóc tách chuỗi an toàn
        if "AGRI" in intent: final_intent = "AGRI"
        elif "PRODUCT" in intent: final_intent = "PRODUCT"
        elif "FAQ" in intent: final_intent = "FAQ"
        else: final_intent = "REJECT"
        
        return {"intent": final_intent}

    def generate_response(state: ChatState):
        intent = state.get("intent", "")
        msgs = list(state["messages"])
        
        if not msgs or not isinstance(msgs[0], SystemMessage):
            msgs = [SystemMessage(content=SYSTEM_PROMPT)] + msgs
            
        if intent == "PRODUCT":

            msgs.append(HumanMessage(content="[HỆ THỐNG]: Khách muốn MUA HÀNG. Hãy dùng tool search_products để báo giá."))
        
        elif intent == "AGRI":

            msgs.append(HumanMessage(content="[HỆ THỐNG]: Khách hỏi KỸ THUẬT TRỒNG TRỌT. Trả lời bằng kiến thức của bạn, TUYỆT ĐỐI KHÔNG dùng tool search_products."))

        response = generator_with_tools.invoke(msgs)
        return {"messages": [response]}

    def reject_query(state: ChatState):

        msg = AIMessage(content="Xin lỗi, tôi chỉ hỗ trợ các câu hỏi liên quan đến nền tảng Hoa Quả Sơn. Bạn có thể hỏi về cách đăng bán, đơn hàng, hoặc kỹ thuật cây trồng.")
        return {"messages": [msg]}

    def route_after_guardrails(state: ChatState):
        intent = state.get("intent", "REJECT")

        if intent in ["FAQ", "PRODUCT", "AGRI"]:
            return "generate"

        else:
            return "reject"


    graph = StateGraph(ChatState)
    graph.add_node("guardrails", check_guardrails)
    graph.add_node("generate", generate_response)
    graph.add_node("reject", reject_query)
    

    graph.add_node("tools", ToolNode(tools_list))

    graph.set_entry_point("guardrails")
    graph.add_conditional_edges("guardrails", route_after_guardrails)
    

    graph.add_conditional_edges("generate", tools_condition)
    

    graph.add_edge("tools", "generate")
    graph.add_edge("reject", END)

    return graph.compile()

_chatbot_graph = None

def get_chatbot_brain(): 
    global _chatbot_graph
    if _chatbot_graph is None:
        _chatbot_graph = create_chatbot_graph()
    return _chatbot_graph