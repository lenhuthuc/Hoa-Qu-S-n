# 🍊 Hoa Quả Sơn — Sàn thương mại nông sản thông minh

Nền tảng e-commerce nông sản Việt Nam tích hợp AI, livestream, truy xuất nguồn gốc QR.

---

## 📁 Kiến trúc dự án

```
HoaQuaSon/
├── Ecommerce/              # Spring Boot (Java 17) — API chính
├── services/
│   ├── gateway/            # Node.js Express — API Gateway + Socket.io
│   └── fastapi-service/    # Python FastAPI — AI, Search, Chatbot
├── frontend/               # Next.js 14 — Giao diện
├── vendor/mediamtx/        # MediaMTX config — Livestream relay
├── db/                     # SQL scripts (seed data)
├── docker-compose.yml      # Orchestration
└── .env.example            # Biến môi trường mẫu
```

---

## 🛠 Yêu cầu hệ thống

| Phần mềm       | Phiên bản tối thiểu |
|-----------------|---------------------|
| Docker Desktop  | 4.x                 |
| Java JDK        | 17                  |
| Maven           | 3.9+                |
| Node.js         | 20 LTS              |
| Python          | 3.11+               |
| MySQL           | 8.0+                |
| Git             | 2.x                 |

---

## 📦 Toàn bộ thư viện cần cài

### 1. Spring Boot — `Ecommerce/pom.xml`

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `spring-boot-starter-web` | 3.5.7 (managed) | REST API |
| `spring-boot-starter-data-jpa` | managed | ORM, MySQL |
| `spring-boot-starter-security` | managed | Authentication, Authorization |
| `spring-boot-starter-validation` | managed | Input validation |
| `spring-boot-starter-mail` | managed | Email (SMTP) |
| `spring-boot-starter-webflux` | managed | WebClient (GHN API) |
| `spring-boot-starter-data-redis` | managed | Redis cache/session |
| `spring-boot-starter-data-mongodb` | managed | MongoDB (nhật ký canh tác) |
| `spring-boot-devtools` | managed | Hot reload |
| `spring-boot-configuration-processor` | managed | Config metadata |
| `mysql-connector-j` | managed | MySQL driver |
| `jedis` | managed | Redis client |
| `lombok` | managed | Boilerplate reduction |
| `jjwt-api` / `jjwt-impl` / `jjwt-jackson` | 0.13.0 | JWT token |
| `zxing-core` / `zxing-javase` | 3.5.3 | QR code generation |
| `aws-sdk-s3` | 2.28.0 | Cloudflare R2 / S3 storage |
| `slf4j-api` | managed | Logging |
| `spring-boot-starter-test` | managed | Testing |
| `spring-security-test` | managed | Security testing |
| `spring-data-redis` | managed | Redis data |

### 2. API Gateway — `services/gateway/package.json`

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `express` | ^4.21.0 | HTTP server |
| `http-proxy-middleware` | ^3.0.3 | Reverse proxy |
| `socket.io` | ^4.8.0 | WebSocket (chat, live orders) |
| `ioredis` | ^5.4.1 | Redis pub/sub |
| `jsonwebtoken` | ^9.0.2 | JWT verification |
| `cors` | ^2.8.5 | CORS middleware |
| `helmet` | ^8.0.0 | Security headers |
| `morgan` | ^1.10.0 | HTTP logging |
| `express-rate-limit` | ^7.4.1 | Rate limiting |
| `multer` | ^1.4.5-lts.1 | File upload |
| `uuid` | ^10.0.0 | Unique ID generation |
| `axios` | ^1.7.7 | HTTP client (MediaMTX API) |
| `dotenv` | ^16.4.5 | Env vars |
| `exif-parser` | ^0.1.12 | GPS extraction từ ảnh |
| `nodemon` | ^3.1.7 | Dev hot reload |

### 3. FastAPI Service — `services/fastapi-service/requirements.txt`

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `fastapi` | 0.115.0 | Web framework |
| `uvicorn[standard]` | 0.30.6 | ASGI server |
| `python-dotenv` | 1.0.1 | Env vars |
| `python-multipart` | 0.0.12 | Form/file upload |
| `google-generativeai` | 0.8.3 | Gemini 2.0 Flash (AI bài đăng) |
| `groq` | 0.11.0 | Groq API (LLaMA 3.1 70B) |
| `langchain` | 0.3.7 | LLM framework |
| `langchain-groq` | 0.2.1 | LangChain + Groq |
| `langchain-community` | 0.3.7 | Community integrations |
| `langgraph` | 0.2.48 | Agent graph (chatbot) |
| `qdrant-client` | 1.12.1 | Qdrant vector DB client |
| `sentence-transformers` | 3.3.1 | Embedding model (multilingual-e5-base) |
| `motor` | 3.6.0 | MongoDB async driver |
| `redis` | 5.2.1 | Redis client |
| `httpx` | 0.27.2 | Async HTTP client |
| `Pillow` | 11.0.0 | Image processing |
| `pydantic` | 2.10.0 | Data validation |
| `pydantic-settings` | 2.6.1 | Settings management |

### 4. Frontend — `frontend/package.json`

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `next` | 14.2.15 | React framework (App Router) |
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | React DOM |
| `hls.js` | ^1.5.15 | HLS video player (livestream) |
| `socket.io-client` | ^4.8.0 | WebSocket client |
| `lucide-react` | ^0.451.0 | Icons |
| `axios` | ^1.7.7 | HTTP client |
| `zustand` | ^5.0.0 | State management |
| `date-fns` | ^4.1.0 | Date formatting |
| `clsx` | ^2.1.1 | CSS class merging |
| `react-hot-toast` | ^2.4.1 | Toast notifications |
| `typescript` | ^5.6.3 | TypeScript |
| `tailwindcss` | ^3.4.13 | CSS framework |
| `autoprefixer` | ^10.4.20 | PostCSS plugin |
| `postcss` | ^8.4.47 | CSS processing |

### 5. Infrastructure (Docker)

| Service | Image | Port | Mục đích |
|---------|-------|------|----------|
| MySQL | 8.0+ (host) | 3306 | Database chính (Spring Boot) |
| PostgreSQL | `postgres:16-alpine` | 5432 | pgvector, extensions |
| MongoDB | `mongo:7` | 27017 | Nhật ký canh tác, chat |
| Redis | `redis:7-alpine` | 6379 | Cache, session, pub/sub |
| Qdrant | `qdrant/qdrant:latest` | 6333, 6334 | Vector search (semantic) |
| MediaMTX | `bluenviron/mediamtx:latest` | 1935, 8888, 8889, 9997 | Livestream relay (RTMP/HLS/WebRTC) |

---

## 🚀 Hướng dẫn cài đặt & chạy

### Bước 1: Clone & cấu hình env

```bash
git clone <repo-url>
cd HoaQuaSon
cp .env.example .env
```

Mở file `.env` và điền các key thực tế:

```env
GEMINI_API_KEY=<your_key>        # Bắt buộc — tạo tại https://aistudio.google.com/apikey
GROQ_API_KEY=<your_key>          # Bắt buộc — tạo tại https://console.groq.com
GHN_TOKEN=<your_token>           # Tùy chọn — GHN Shipping API
JWT_SECRET=<random_secret>       # Bắt buộc
```

### Bước 2: Khởi động infrastructure (Docker)

```bash
docker compose up -d postgres mongodb redis qdrant mediamtx
```

Kiểm tra tất cả container đã healthy:

```bash
docker compose ps
```

### Bước 3: Cài đặt & chạy MySQL

Đảm bảo MySQL 8.0+ đang chạy trên máy host. Tạo database:

```sql
CREATE DATABASE IF NOT EXISTS ecommerce;
```

Seed dữ liệu giá thị trường (sau khi Spring Boot đã tạo bảng):

```bash
mysql -u root -p ecommerce < db/seed_market_prices.sql
```

### Bước 4: Chạy Spring Boot (Ecommerce)

```bash
cd Ecommerce
./mvnw spring-boot:run
```

> API chạy tại `http://localhost:8080`

### Bước 5: Chạy API Gateway

```bash
cd services/gateway
npm install
npm run dev
```

> Gateway chạy tại `http://localhost:3000`

### Bước 6: Chạy FastAPI Service

```bash
cd services/fastapi-service
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> FastAPI chạy tại `http://localhost:8000`
>
> ⚠️ Lần chạy đầu sẽ tải model embedding (~1.1GB `intfloat/multilingual-e5-base`). Cần internet.

### Bước 7: Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

> Frontend chạy tại `http://localhost:3001`

---

## 🐳 Chạy toàn bộ bằng Docker Compose (thay thế bước 4-7)

```bash
docker compose up -d --build
```

Tất cả services sẽ tự build & start. Truy cập:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Gateway API | http://localhost:3000 |
| Spring API | http://localhost:8080 |
| FastAPI (AI) | http://localhost:8000 |
| FastAPI docs | http://localhost:8000/docs |
| Qdrant dashboard | http://localhost:6333/dashboard |
| MediaMTX API | http://localhost:9997/v3/paths/list |

---

## 🌟 Tính năng chính

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | **AI Tạo bài đăng** | Upload ảnh → Gemini 2.0 Flash phân tích → tự tạo tiêu đề, mô tả, giá đề xuất |
| 3 | **Chatbot AI** | LangGraph + LLaMA 3.1 70B, hỗ trợ khách hàng bằng tiếng Việt, từ chối off-topic |
| 5 | **Livestream bán hàng** | WebRTC ingest → MediaMTX → HLS ABR (720p/480p/360p), chat realtime, đặt hàng nhanh |
| 6 | **Tìm kiếm ngữ nghĩa** | multilingual-e5-base embeddings + Qdrant, tìm sản phẩm bằng ngôn ngữ tự nhiên |
| 7 | **Đặt hàng thông minh** | Kiểm tra hạn sử dụng vs thời gian vận chuyển GHN, cảnh báo hàng dễ hỏng |
| 8 | **Nhật ký canh tác** | Ghi nhận hoạt động trồng trọt (ảnh, GPS, thời tiết) theo từng lô hàng |
| 9 | **Truy xuất nguồn gốc QR** | Quét mã QR → xem timeline canh tác, xuất xứ, quy trình sản xuất |

---

## 📡 API Endpoints tổng quan

### Spring Boot (`/api/`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/products` | Danh sách sản phẩm |
| GET | `/api/market-prices/search?name=` | Tra giá thị trường |
| POST | `/api/farming-journal` | Tạo nhật ký canh tác |
| GET | `/api/farming-journal/batch/{batchId}` | Nhật ký theo lô |
| GET | `/api/traceability/{batchId}` | Truy xuất nguồn gốc |
| POST | `/api/traceability/{batchId}/generate-qr` | Tạo mã QR |
| GET | `/api/shipping/validate` | Kiểm tra vận chuyển |

### FastAPI (`/api/`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/ai/generate-post` | AI tạo bài đăng (multipart) |
| GET | `/api/search/semantic?q=` | Tìm kiếm ngữ nghĩa |
| POST | `/api/search/embed-product` | Index sản phẩm vào Qdrant |
| POST | `/api/chatbot/message` | Chat với AI chatbot |

### Gateway (`/api/`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/livestream/start` | Bắt đầu livestream |
| GET | `/api/livestream/active` | Danh sách phiên live |
| POST | `/api/upload/image` | Upload ảnh + EXIF GPS |

---

## 🔧 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Port đã được sử dụng | `netstat -ano \| findstr :<port>` rồi `taskkill /PID <pid> /F` |
| Qdrant không kết nối | Kiểm tra `docker compose ps qdrant`, đợi healthy |
| Model embedding tải chậm | Lần đầu cần ~1.1GB, kiểm tra internet ổn định |
| MySQL connection refused | Đảm bảo MySQL đang chạy và database `ecommerce` đã tạo |
| MediaMTX không nhận stream | Kiểm tra port 1935 (RTMP) hoặc 8889 (WebRTC) không bị firewall chặn |
| AI trả lời lỗi | Kiểm tra `GEMINI_API_KEY` và `GROQ_API_KEY` trong `.env` |

---

## 📝 Ghi chú

- Spring Boot sử dụng **MySQL** trên máy host (không trong Docker) làm database chính
- MongoDB dùng cho nhật ký canh tác (`farming_logs` collection)
- Redis dùng cho session, cache, và Socket.io pub/sub
- Qdrant dùng cho vector embeddings (tìm kiếm ngữ nghĩa)
- Lần chạy đầu tiên Spring Boot sẽ tự tạo bảng `market_prices` nhờ `ddl-auto=update`
#   H o a - Q u - S - n  
 