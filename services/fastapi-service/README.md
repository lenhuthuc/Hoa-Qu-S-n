# 🚀 FastAPI Service — AI Engine

Tâm mạnh của hệ thống: **nhận diện nông sản, sinh nội dung, định giá thông minh**.

---

## 📦 Kiến trúc

```
fastapi-service/
├── main.py                 # Khởi chạy FastAPI app
├── config.py               # Cấu hình & settings
├── models.py               # Pydantic schemas
├── requirements.txt        # Python dependencies
├── .env.example             # Template cho API keys
├── .env                     # Secrets (KHÔNG commit)
├── core/
│   ├── pipeline.py         # Xử lý luồng ảnh → giá → nội dung
│   ├── vision_chain.py     # Gemini + OpenRouter vision
│   ├── pricing.py          # Định giá dựa market data
│   ├── pricing_agent.py    # Groq LLM + agent định giá
│   ├── post_generator.py   # Tạo bài đăng
│   └── vision_chain.py     # Gemini + OpenRouter
├── routers/
│   ├── ai_post.py          # /api/ai/generate-post
│   ├── chatbot.py          # Chatbot endpoint
│   └── semantic_search.py  # Tìm kiếm sản phẩm tương tự
├── services/
│   ├── embedding_service.py # Vector embedding
│   └── ...
└── chatbot/
    └── agent.py            # LLM agent cho chatbot
```

---

## 🔧 Setup & Khởi Chạy

### 1. Tạo file `.env`

```bash
cp .env.example .env
```

**Điền các API keys bắt buộc** (xem bảng dưới):

| Biến | Bắt buộc | Lấy từ |
|------|----------|--------|
| `GEMINI_API_KEY` | ✅ | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | ✅ | [console.groq.com](https://console.groq.com) |
| `OPENROUTER_API_KEY` | ❌ | [openrouter.ai/keys](https://openrouter.ai/keys) (fallback) |
| `MONGO_URL` | ✅ | Localhost hoặc Atlas |
| `QDRANT_HOST` | ✅ | Localhost hoặc Qdrant Cloud |
| `SPRING_SERVICE_URL` | ✅ | Backend Java (http://localhost:8080) |

### 2. Chạy bằng Docker (Recommended)

```bash
# Từ thư mục root
docker compose up -d fastapi-service
```

### 3. Chạy cục bộ (Development)

```bash
# 1. Đảm bảo hạ tầng chạy
docker compose up -d postgres mongodb redis qdrant

# 2. Cài đặt dependencies
pip install -r requirements.txt

# 3. Khởi chạy
uvicorn main:app --reload --port 8000
```

**Kiểm tra**: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)

---

## 🔌 API Endpoints

### Tạo bài đăng từ ảnh (AI Vision + Pricing + Text Gen)

```bash
POST /api/ai/generate-post
Content-Type: multipart/form-data

# Body: images (1-5 file)
# Response:
{
  "success": true,
  "draft_id": "uuid",
  "data": {
    "product_name": "Xoài cát Hòa Lộc",
    "category": "Trái cây",
    "suggested_price_per_kg": 38000,
    "price_reasoning": "Dựa trên 12 mẫu thị trường...",
    "title": "🥭 Xoài cát Hòa Lộc ngon, tươi, giá cạnh tranh",
    "description": "...",
    "hashtags": ["#xoài", "#hoquason", ...]
  }
}
```

### Semantic Search

```bash
GET /api/search/similar?product_name=Xoài&limit=5

# Response: Danh sách sản phẩm tương tự từ Vector DB
```

### Chatbot

```bash
POST /api/chatbot
Content-Type: application/json

{
  "message": "Giá cam hiện nay bao nhiêu?",
  "user_id": "123",
  "conversation_id": "abc"
}

# Response: Trả lời từ LLM agent
```

---

## 🤖 AI Providers & Fallback

### Vision (Nhận diện ảnh)

**Priority**: Gemini 2.0 Flash → Gemini 1.5 Flash → OpenRouter Gemma

```python
# Cơ chế thử lại:
for model in ["gemini-2.0-flash", "gemini-1.5-flash"]:
    try:
        result = genai.GenerativeModel(model).generate_content(parts)
        if result:
            return parse_json(result.text)
    except RateLimitError:
        # Chuyển model tiếp theo
        continue
```

Nếu cả hai lỗi → OpenRouter (gemma-3-27b-it)
Nếu tất cả fail → `"Tất cả vision providers đều thất bại"`

### Text Generation (Tạo nội dung)

**Priority**: Groq Llama 3.3 70B → Gemini (fallback)

```bash
GROQ_API_KEY=gsk_xxx  # Chạy model mạnh, free credits
```

### Pricing (Định giá)

1. **Tìm giá thị trường**: DuckDuckGo + Database nội bộ
2. **Tính trung bình KNN**: Từ 30 kết quả search
3. **Nếu không đủ dữ liệu**: Gemini fallback để suy luận

---

## 🐛 Troubleshooting

### Lỗi: "Tất cả vision providers đều thất bại"

**Nguyên nhân**: API keys không được cấu hình hoặc provider trả lỗi

**Cách sửa**:
1. Kiểm tra `.env`:
   ```bash
   echo $GEMINI_API_KEY  # Phải không trống
   echo $GROQ_API_KEY
   ```

2. Kiểm tra API key hợp lệ:
   - Gemini: Test tại [aistudio.google.com](https://aistudio.google.com)
   - Groq: Test tại [console.groq.com](https://console.groq.com)

3. Kiểm tra rate limit:
   - Gemini free tier: 15 requests/phút
   - Groq free tier: Hạn chế tuỳ thuộc model

4. Xem logs:
   ```bash
   docker logs hqs-fastapi -f
   ```

### Lỗi: "QDRANT_HOST not reachable"

```bash
# Đảm bảo Qdrant chạy:
docker compose ps | grep qdrant

# Nếu chưa chạy:
docker compose up -d qdrant
```

### Lỗi: "SPRING_SERVICE_URL connection refused"

```bash
# Kiểm tra Backend Java chạy chưa:
docker compose ps | grep spring-service

# Nếu Dev local:
cd Ecommerce && ./mvnw spring-boot:run
```

---

## 📊 Performance & Optimization

### Vision Analysis
- **Latency**: 3-8s (Gemini 2.0 Flash)
- **Concurrent**: ~10 request/s trên instance 1
- **Retry logic**: Automatic fallback nếu timeout

### Pricing Lookup
- **Latency**: 1-3s (KNN từ 30 mẫu)
- **Cache**: Redis 1 giờ

### Text Generation
- **Latency**: 2-5s (Groq Llama)
- **Max tokens**: 1024 per request

### Scaling
Nếu load cao:
1. Deploy multiple FastAPI instances
2. Đặt Load Balancer (Nginx/Traefik) trước
3. Tăng connection pool MongoDB/Redis

---

## 📚 Resources

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Google Gemini API](https://ai.google.dev/)
- [Groq Console](https://console.groq.com/)
- [Qdrant Vector DB](https://qdrant.tech/)

---

## 👥 Contributing

**Quy tắc**:
1. Tạo branch từ `main`: `git checkout -b feature/your-feature`
2. Update `.env.example` nếu thêm biến mới
3. Test cục bộ trước khi push
4. Commit message: `[FastAPI] Brief description`

---

**Last Updated**: 2026-04-20  
**Maintainer**: @lenhuthuc
