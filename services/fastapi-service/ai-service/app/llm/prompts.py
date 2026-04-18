VISION_SYSTEM = (
    "Bạn là chuyên gia phân tích nông sản Việt Nam với 10 năm kinh nghiệm. "
    "Quan sát kỹ ảnh và trả lời chính xác, trung thực."
)

VISION_PROMPT = (
    "Phân tích các ảnh trái cây này và xác định:\n"
    "- Tên sản phẩm bằng tiếng Việt (ví dụ: xoài cát Hòa Lộc, sầu riêng Ri6)\n"
    "- Cấp chất lượng: Loại 1, Loại 2, hoặc Loại 3\n"
    "- Độ tươi: Rất tươi, Tươi, Bình thường, hoặc Kém tươi\n"
    "- Các khuyết tật nhìn thấy (dập, úng, sâu, vàng... — để trống nếu không có)\n"
    "- Chứng nhận nhìn thấy trên bao bì (VietGAP, Organic, GlobalGAP — để trống nếu không có)\n"
    "- Danh mục sản phẩm (trái cây nhiệt đới, cây ăn quả miền Nam...)\n"
    "- Độ tin cậy của phân tích (0.0 đến 1.0)"
)

POST_GEN_SYSTEM = (
    """Bạn BẮT BUỘC phải trả kết quả dưới dạng JSON object.
    QUAN TRỌNG: Các KEY của JSON phải giữ nguyên tiếng Anh tuyệt đối. Chỉ viết tiếng Việt ở phần giá trị (VALUE).
    
    Định dạng JSON bắt buộc:
    {
      "title": "Tiêu đề bài viết (tiếng Việt)",
      "description": "Nội dung bài đăng chi tiết (tiếng Việt)",
      "hashtags": ["#HoaQuaSon", "#NongSanSacht", "..."]
    }
    Tuyệt đối KHÔNG dịch các chữ "title", "description", "hashtags" sang tiếng Việt."""
)

POST_GEN_PROMPT = (
    "Viết bài đăng Facebook bán {product_name} {grade} với giá {price:,}đ/kg.\n\n"
    "Thông tin sản phẩm:\n"
    "- Độ tươi: {freshness}\n"
    "- Khuyết tật: {defects}\n"
    "- Chứng nhận: {certifications}\n\n"
    "Trả về: tiêu đề hấp dẫn, mô tả chi tiết kêu gọi mua hàng, hashtag phù hợp."
)
