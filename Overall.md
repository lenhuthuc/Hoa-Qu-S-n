# HOA QUẢ SƠN 

---

## TỔNG QUAN DỰ ÁN
Nền tảng thương mại điện tử nông sản "Hoa Quả Sơn".
Kết nối nông hộ Việt Nam với người tiêu dùng đô thị.

---

## CẤU TRÚC THƯ MỤC
hoa-qua-son/
│
├── docker-compose.yml            ← [Qdrant] & [MediaMTX] nằm ở đây (Docker Image)
│
├── vendor/
│   └── mediamtx/
│       └── mediamtx.yml          ← [MediaMTX] File config duy nhất cần tải về
│
├── services/
│   ├── spring-service/           ← (Code cũ của ông để nguyên đây, refactor sau)
│   │
│   ├── gateway/                  ← (Node.js Express - Định tuyến & Socket.io)
│   │
│   └── fastapi-service/          ← [LangGraph] & [Qdrant Client] nằm ở đây
│       ├── requirements.txt      ← Thêm: langgraph, qdrant-client, google-generativeai
│       ├── main.py               ← Khởi tạo FastAPI
│       └── chatbot/
│           └── agent.py          ← Code LangGraph Agent Executor ở đây
│
└── frontend/                     ← [Next.js Template] & [hls.js] nằm ở đây
    ├── package.json              ← Thêm: hls.js, lucide-react, tailwindcss...
    ├── src/
    │   ├── app/                  ← Pages (product list, cart, checkout)
    │   └── components/
    │       └── LivePlayer.tsx    ← [hls.js] Code player gắn thẳng vào component này
---

## SERVICES & PORTS

| Service          | Tech              | Port | Trạng thái  |
|------------------|-------------------|------|-------------|
| gateway          | Node.js Express   | 3000 | BUILD MỚI   |
| spring-service   | Java Spring Boot  | 8080 | CÓ SẴN      |
| fastapi-service  | Python FastAPI    | 8000 | BUILD MỚI   |
| frontend         | Next.js 14        | 3001 | BUILD MỚI   |
| mediamtx         | Go (binary)       | 1935 (RTMP), 8888 (HLS), 9997 (HTTP API) | DOCKER IMAGE |
| postgres         | PostgreSQL 16     | 5432 | DOCKER IMAGE |
| mongodb          | MongoDB 7         | 27017| DOCKER IMAGE |
| redis            | Redis 7           | 6379 | DOCKER IMAGE |
| qdrant           | Qdrant            | 6333 | DOCKER IMAGE |

---

## CODE CŨ — JAVA SPRING (services/spring-service)

### Đã có sẵn (KHÔNG viết lại):
- Auth: login, register, JWT
- Product: CRUD cơ bản
- Order/Cart: tạo đơn, giỏ hàng
- Payment: MoMo, VNPAY webhook

### Cần thêm vào Spring (KHÔNG sửa file cũ, chỉ ADD):
- ShippingValidationService: so sánh shelf-life vs ETD từ GHN API
- FarmingJournalController: lưu ảnh nhật ký canh tác vào MongoDB
- TraceabilityController: aggregate journal theo batchId, gen QR code
- InternalOrderController: nhận order từ gateway khi livestream

---

## SERVICES MỚI CẦN BUILD

### Gateway (Node.js Express)
Nhiệm vụ: Auth middleware, reverse proxy, socket.io, livestream room management
Cần build:
- JWT verify middleware (gọi Spring /auth/verify)
- Proxy routes → spring-service, fastapi-service
- Socket.io: live chat, live order events trong stream
- Redis Pub/Sub: sync socket events across instances
- Livestream routes: tạo/xóa room trên MediaMTX HTTP API

### FastAPI Service (Python)
Nhiệm vụ: Toàn bộ AI và ML
Cần build:
- POST /ai/generate-post: Gemini 1.5 Flash → sinh title, description, suggested_price từ ảnh
- POST /search/embed-product: embed product → lưu Qdrant
- GET /search/semantic?q=: tìm kiếm ngữ nghĩa qua Qdrant
- POST /chatbot/message: LangGraph agent + LLaMA 3.1 70B via Groq

### Frontend (Next.js 14 App Router)
Cần build:
- Trang seller: đăng sản phẩm với AI generate, dashboard doanh thu
- Trang buyer: tìm kiếm semantic, xem sản phẩm, đặt hàng
- Livestream page: HLS.js player + live chat + đặt hàng trong stream
- QR scan page: hiển thị timeline truy xuất nguồn gốc

---

## DATABASE SCHEMA

### PostgreSQL (spring-service dùng)
```sql
Thiết kế tối ưu.
```

### MongoDB (fastapi + spring dùng)
farming_logs collection:
{ _id, batch_id, seller_id, image_url, note, gps_lat, gps_lng, captured_at, created_at }
chat_messages collection:
{ _id, room_id, sender_id, content, type, created_at }
### Redis keys
---

## ENVIRONMENT VARIABLES

### Chung (docker-compose.env)
POSTGRES_URL=postgresql://postgres:password@postgres:5432/hoaquason
MONGO_URL=mongodb://mongodb:27017/hoaquason
REDIS_URL=redis://redis:6379
QDRANT_HOST=qdrant
QDRANT_PORT=6333
### Gateway (.env)
PORT=3000
JWT_SECRET=hoaquason_secret
SPRING_URL=http://spring-service:8080
FASTAPI_URL=http://fastapi-service:8000
MEDIAMTX_API=http://mediamtx:9997
### FastAPI (.env)
GEMINI_API_KEY=
GROQ_API_KEY=
QDRANT_HOST=qdrant
MONGO_URL=mongodb://mongodb:27017/hoaquason
### Spring (.env / application.properties)
### Spring (.env / application.properties)
GHN_TOKEN=
GHN_SHOP_ID=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
CLOUDFLARE_R2_ENDPOINT=
---

## LUỒNG CHÍNH

### Luồng đăng bán với AI
Seller upload ảnh (Frontend)
→ POST /ai/generate-post (FastAPI)
→ Gemini Flash phân tích ảnh
→ Trả về title, description, price
→ Seller confirm → POST /products (Spring)
→ POST /search/embed-product (FastAPI) để index Qdrant
### Luồng livestream
Seller bấm "Bắt đầu live" (Frontend)
→ POST /livestream/start (Gateway)
→ Gateway tạo streamKey, gọi MediaMTX API tạo path
→ Trả về {rtmpUrl, hlsUrl} cho Frontend
→ Browser WebRTC → MediaMTX → FFmpeg transcode → LL-HLS
→ Viewer xem qua HLS.js
→ Chat/Order qua Socket.io → Redis Pub/Sub
### Luồng truy xuất nguồn gốc
Seller chụp ảnh vườn hàng ngày
→ POST /farming-journal (Spring)
→ Lưu MongoDB + extract GPS từ EXIF
→ Khi thu hoạch: POST /traceability/{batchId}/generate-qr (Spring)
→ Aggregate tất cả logs theo batchId
→ Gen QR PNG → upload S3 → trả qrUrl
→ Buyer quét QR → GET /traceability/{batchId} → xem timeline
---

## RULES — ĐỌC KỸ

1. KHÔNG rewrite file có sẵn trong spring-service từ đầu
2. Khi thêm vào Spring: tạo file mới, KHÔNG sửa file cũ trừ khi cần add @Bean hoặc import
3. Mỗi task chỉ làm 1 service tại một thời điểm
4. Sau mỗi thay đổi: liệt kê rõ file nào bị sửa, test command là gì
5. Internal service calls dùng hostname trong Docker network (spring-service, fastapi-service...). Tất cả services chạy chung trên một custom bridge network tên là hoaquason_network
6. KHÔNG dùng localhost trong service-to-service calls
7. Windows path: dùng forward slash trong docker-compose volumes
8. Mọi endpoint mới phải có error handling và trả về {success, data, error} format
9. Có thể xóa nếu không cần thiết hoặc vô dụng.
---
