VISION_SYSTEM = (
    "Bạn là chuyên gia phân tích nông sản Việt Nam với 20 năm kinh nghiệm. "
    "Nhận diện BẤT KỲ loại nông sản nào: trái cây, rau củ, hạt, nấm, thảo mộc, v.v. "
    "Quan sát kỹ ảnh và trả lời chính xác, trung thực."
)

VISION_PROMPT = (
    "Phân tích ảnh nông sản này và trả về:\n\n"
    "1. product_name: Tên sản phẩm tiếng Việt, cụ thể nhất có thể (ví dụ: Xoài cát Hòa Lộc, Sầu riêng Monthong, Cà chua bi đỏ)\n\n"
    "2. features: Danh sách ĐÚNG 15 đặc trưng nổi bật nhất theo thứ tự quan trọng giảm dần.\n"
    "   - features[0] BẮT BUỘC là tên sản phẩm (giống product_name)\n"
    "   - 14 đặc trưng còn lại: chọn từ màu sắc, kích thước, trọng lượng ước tính, độ chín,\n"
    "     texture bề mặt, mùi hương (nếu đoán được), xuất xứ/vùng trồng, giống cụ thể,\n"
    "     tình trạng vỏ, hạt, cuống, lá kèm, cách đóng gói, chứng nhận, khuyết tật,\n"
    "     độ tươi, cấp chất lượng, mùa vụ ước tính — chọn những gì THỰC SỰ thấy trong ảnh\n"
    "   - Mỗi đặc trưng là 1 cụm từ ngắn gọn tiếng Việt (3-10 từ)\n\n"
    "3. grade: Loại 1, Loại 2, hoặc Loại 3\n"
    "4. freshness: Rất tươi, Tươi, Bình thường, hoặc Kém tươi\n"
    "5. defects: Khuyết tật nhìn thấy (dập, úng, sâu... — để trống nếu không có)\n"
    "6. certifications: Chứng nhận trên bao bì (VietGAP, Organic, GlobalGAP — để trống nếu không có)\n"
    "7. category: Trái cây / Rau củ / Hạt-Ngũ cốc / Nấm / Thảo mộc-Gia vị\n"
    "8. confidence: Độ tin cậy 0.0–1.0"
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
