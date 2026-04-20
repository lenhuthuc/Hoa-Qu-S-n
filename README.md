# 🍊 Hoa Quả Sơn — Sàn Thương Mại Nông Sản Thông Minh

Nền tảng thương mại điện tử nông sản Việt Nam thế hệ mới, tích hợp **AI Content**, **Semantic Search**, **Livestreaming** và **Truy xuất nguồn gốc QR**.

-----

## 📁 Kiến trúc dự án

```bash
HoaQuaSon/
├── Ecommerce/             # Spring Boot (Java 17) — Core API & Business Logic
├── services/
│   ├── gateway/           # Node.js Express — API Gateway & Realtime (Socket.io)
│   └── fastapi-service/   # Python FastAPI — AI Engine (Gemini, LLaMA 3.1, Qdrant)
├── frontend/              # Next.js 14 — User Interface (App Router)
├── vendor/mediamtx/       # MediaMTX — Livestreaming Relay Server
├── db/                    # SQL scripts & Seed data
└── docker-compose.yml     # Container Orchestration
```

-----

## 🛠 Yêu cầu hệ thống

| Phần mềm | Phiên bản | Công cụ hỗ trợ | Phiên bản |
| :--- | :--- | :--- | :--- |
| **Java JDK** | 17+ | **Docker Desktop** | 4.x+ |
| **Node.js** | 20 LTS | **MySQL** | 8.0+ |
| **Python** | 3.11+ | **Maven** | 3.9+ |

-----

## 🚀 Hướng dẫn cài đặt nhanh

### 1\. Cấu hình môi trường

Clone project và tạo file `.env` từ mẫu:

```bash
git clone <repo-url>
cd HoaQuaSon
cp .env.example .env
```

> **Lưu ý:** Cập nhật các API Key (`GEMINI_API_KEY`, `GROQ_API_KEY`, `JWT_SECRET`) trong file `.env`.

### 2\. Khởi động Cơ sở hạ tầng (Docker)

Chạy các dịch vụ nền tảng:

```bash
docker compose up -d postgres mongodb redis qdrant mediamtx
```

### 3\. Khởi chạy các Service

#### 🟢 Backend (Spring Boot)

```bash
cd Ecommerce
./mvnw spring-boot:run
```

#### 🟡 API Gateway (Node.js)

```bash
cd services/gateway
npm install && npm run dev
```

#### 🐍 AI Service (FastAPI)

```bash
cd services/fastapi-service
python -m venv venv
source venv/bin/activate  # Hoặc venv\Scripts\activate trên Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

#### 🔵 Frontend (Next.js)

```bash
cd frontend
npm install && npm run dev
```

---

## 🐳 Vận hành toàn bộ bằng Docker (Khuyên dùng)

Nếu bạn muốn khởi chạy tất cả các dịch vụ (bao gồm cả App) chỉ với một lệnh duy nhất:

```bash
# Khởi chạy hệ thống ở chế độ background
docker compose up -d --build

# Xem log của tất cả các dịch vụ để debug
docker compose logs -f
```

---

## 🧹 Dọn dẹp & Bảo trì hệ thống

Trong trường hợp hệ thống bị xung đột cache dữ liệu cũ hoặc bạn muốn reset hoàn toàn:

### 1. Dọn dẹp Cache & Container
```bash
# Dừng và xóa tất cả container, network
docker compose down

# Xóa toàn bộ dữ liệu (Volumes) - CẨN THẬN: Mất sạch DB
docker compose down -v
```

### 2. Reset Cache Redis (Nếu đang chạy)
```bash
docker exec -it hoaquason-redis redis-cli FLUSHALL
```

### 3. Reset Database MySQL
Nếu bạn muốn xóa trắng dữ liệu MySQL để seed lại:
```bash
docker compose stop mysql
docker volume rm hoaquason_mysql_data  # Tên volume có thể thay đổi tùy cấu hình
docker compose start mysql
```

---

## 🌟 Tính năng nổi bật

### 🤖 Trợ lý AI Thông minh & Content
  * **AI Auto-Post:** Phân tích hình ảnh nông sản qua **Gemini 2.0 Flash** để tạo mô tả và gợi ý giá.
  * **Chatbot LangGraph:** Trợ lý tư vấn khách hàng chuyên sâu (LLaMA 3.1 70B).

### 🔍 Tìm kiếm ngữ nghĩa (Semantic Search)
  * Sử dụng model `multilingual-e5-base` + **Qdrant Vector DB** để tìm kiếm theo ý nghĩa.

### 🎥 Livestream & Realtime
  * **MediaMTX Integration:** Livestream trực tiếp từ vườn qua WebRTC/HLS.
  * **Realtime Orders:** Thông báo và chat realtime qua Socket.io.

### 🚚 Vận chuyển & Logistics thông minh
  * **Smart Shipping:** Tự động tính khoảng cách địa lý và kiểm tra ETD vs hạn sử dụng nông sản.

### 🚜 Minh bạch nguồn gốc
  * **Nhật ký canh tác:** Lưu trữ dữ liệu GPS, hình ảnh EXIF trên MongoDB.
  * **Truy xuất QR:** Quét mã để xem toàn bộ lịch sử lô hàng.

### 📱 Chia sẻ lên mạng xã hội 
  * **Facebook Share Dialog:** Chia sẻ sản phẩm lên Facebook với rich preview (hình ảnh, giá, mô tả).
  * **Open Graph Tags:** Tích hợp OG tags tự động để Facebook crawl thông tin sản phẩm.
  * **Hashtags tự động:** Thêm hashtags `#hoaquason #nongsan #fresh #vietnam` vào mỗi bài chia sẻ.

-----

## 📡 Danh sách Port mặc định

| Service | URL | Công dụng |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:3001` | Giao diện người dùng |
| **Gateway** | `http://localhost:3000` | Cổng API tổng |
| **Spring API** | `http://localhost:8080` | Logic nghiệp vụ chính |
| **FastAPI** | `http://localhost:8000` | Xử lý AI & Search |
| **Qdrant** | `http://localhost:6333` | Vector Database Dashboard |

-----

## Cấu hình Facebook Sharing

### Yêu cầu
1. **Tài khoản Facebook Developer:** Đăng ký tại [developers.facebook.com](https://developers.facebook.com)
2. **App ID:** Tạo ứng dụng Facebook để lấy App ID
3. **Domain:** Thêm domain ngrok hoặc production URL vào danh sách domain được phép

### Cấu hình trong Frontend

1. **Thêm Facebook SDK vào `layout.tsx`:**
```tsx
useEffect(() => {
  window.fbAsyncInit = function() {
    FB.init({
      appId: process.env.NEXT_PUBLIC_FB_APP_ID,
      xfbml: true,
      version: 'v18.0'
    });
  };
  
  // Load SDK script
  const script = document.createElement('script');
  script.src = 'https://connect.facebook.net/en_US/sdk.js';
  script.async = true;
  document.body.appendChild(script);
}, []);
```

2. **Sử dụng Share Dialog trong Component:**
```tsx
import { shareToFacebookDialog } from '@/lib/facebookShare';

const handleShare = async () => {
  const success = await shareToFacebookDialog({
    productId: product.id,
    productName: product.productName,
    productImage: product.imageUrls?.[0]
  });
  if (success) toast.success('Chia sẻ thành công!');
};
```

3. **OG Tags tự động được generate từ `layout.tsx` trong `/product/[id]`:**
   - Ảnh sản phẩm
   - Giá bán
   - Mô tả + hashtags #hoaquason
   - Loại sản phẩm

### Thư mục liên quan
- `frontend/src/lib/facebookShare.ts` — Facebook Share helper
- `frontend/src/app/product/[id]/layout.tsx` — OpenGraph metadata generation
- `frontend/src/app/layout.tsx` — Facebook SDK initialization

-----

## �🔧 Xử lý sự cố thường gặp

  * **Lỗi tải Model:** FastAPI cần tải khoảng 1.1GB model embedding ở lần đầu chạy, hãy đảm bảo kết nối mạng ổn định.
  * **Kết nối DB:** Đảm bảo bạn đã tạo database `ecommerce` trong MySQL trước khi chạy Spring Boot.
  * **CORS:** Nếu gặp lỗi kết nối giữa frontend và backend, kiểm tra cấu hình `ALLOWED_ORIGINS` trong Gateway và Spring Security.  * **Facebook Share không hiển thị ảnh:**
    - Kiểm tra image URL trong OG tags có accessible từ internet không (phải dùng ngrok, không phải localhost).
    - Sử dụng [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing) để test preview.
    - Đảm bảo `NEXT_PUBLIC_FB_APP_ID` được set đúng trong `.env.local`.
  * **Facebook SDK không load:**
    - Kiểm tra browser console có lỗi script không.
    - Đảm bảo domain/URL được thêm vào Facebook App Settings.
    - Clear browser cache và localStorage.