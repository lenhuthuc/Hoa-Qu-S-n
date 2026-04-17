import json
import httpx
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_community.tools import DuckDuckGoSearchResults
from config import get_settings

settings = get_settings()

_ddg_search = DuckDuckGoSearchResults(max_results=3)


@tool
def web_search_price(product_name: str) -> str:
    """Dùng để tìm kiếm giá thị trường hiện tại của nông sản trên mạng Internet. BẠN CHỈ CẦN TRUYỀN VÀO TÊN NÔNG SẢN."""
    

    formatted_query = f"giá bán {product_name} tại Việt Nam"
    
    
    try:

        return _ddg_search.invoke(formatted_query)
    except Exception as e:
        return f"Lỗi tìm kiếm: {str(e)}"


@tool
def get_db_price(product_name: str) -> str:
    """Dùng để truy vấn giá trung bình trong lịch sử của sản phẩm từ cơ sở dữ liệu nội bộ."""
    try:
        response = httpx.get(
            f"{settings.spring_service_url}/api/market-prices/search",
            params={"name": product_name},
            timeout=5.0
        )
        if response.status_code == 200 and response.json().get("data"):
            mp = response.json()["data"]
            return f"Giá DB - Trung bình: {mp.get('avgPrice')}, Thấp nhất: {mp.get('minPrice')}, Cao nhất: {mp.get('maxPrice')} VND/kg"
        return "Không có dữ liệu trong Database nội bộ."
    except Exception as e:
        return f"Lỗi khi kết nối Database: {str(e)}"


tools = [web_search_price, get_db_price]

llm = ChatGroq(
    api_key=settings.groq_api_key, 
    model="llama-3.3-70b-versatile",
    temperature=0.1
)

# 4. Viết Prompt chỉ đạo Agent
prompt = ChatPromptTemplate.from_messages([
    ("system", """Bạn là Chuyên gia Định giá Nông sản Việt Nam. 
    Nhiệm vụ của bạn là đưa ra một mức giá bán đề xuất hợp lý (VNĐ/kg) cho sản phẩm mà người dùng cung cấp.
    Bạn BẮT BUỘC phải dùng công cụ 'get_db_price' để xem giá lịch sử, và 'web_search_price' để xem tin tức giá hôm nay.
    Bạn BẮT BUỘC phải trả về tên tiếng việt của loại hoa quả đó nếu có thể.
    QUAN TRỌNG: Bạn BẮT BUỘC phải trả về kết quả cuối cùng dưới định dạng JSON hợp lệ, tuân thủ chính xác cấu trúc sau:

    {{
        "suggested_price": 85000,
        "reason": "Dựa trên giá DB là 85k và thị trường dao động 80k-90k, mức giá 85k là hợp lý..."
    }}
    Lưu ý: 
    - Trường "suggested_price" CHỈ CHỨA SỐ (ví dụ: 85000, không chứa chữ 'VNĐ' hay dấu phẩy).
    - Không giải thích gì thêm ở bên ngoài khối JSON này."""),
    ("human", "Hãy định giá cho sản phẩm: {product_name}. Tình trạng hiện tại: {freshness}"),
    ("placeholder", "{agent_scratchpad}"),
])


agent = create_tool_calling_agent(llm, tools, prompt)

agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True) 

async def get_smart_pricing(product_name: str, freshness: str) -> dict:
    """Hàm này sẽ được Router gọi để lấy lời khuyên về giá"""
    result = await agent_executor.ainvoke({
        "product_name": product_name,
        "freshness": freshness
    })
    
    raw_output = result["output"]
    
    try:

        parsed_result = json.loads(raw_output)
        
        return {
            "suggested_price_per_kg": parsed_result.get("suggested_price", 0), 
            "price_reasoning": parsed_result.get("reason", "Không có lý do") 
        }
    except json.JSONDecodeError:
        return {
            "suggested_price_per_kg": 0,
            "price_reasoning": raw_output
        }