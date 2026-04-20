## TỔNG QUAN KIẾN TRÚC

Dự án được xây dựng theo mô hình **Microservices hybrid**, kết hợp Java Spring (Nghiệp vụ), Python FastAPI (AI) và Node.js Express (Gateway).

```mermaid
graph TD
    User((Người dùng)) -->|Next.js 14| Frontend[Frontend UI]
    Frontend -->|REST/WS| Gateway[API Gateway - Node.js]
    
    subgraph "Core Backend"
        Gateway -->|Proxy| Spring[Spring Boot Core]
        Spring -->|JDBC| MySQL[(MySQL - Cổng chính)]
    end
    
    subgraph "AI & Analytics"
        Gateway -->|Internal| FastAPI[FastAPI - AI Service]
        FastAPI -->|Vector Search| Qdrant[(Qdrant Vector DB)]
        FastAPI -->|LLM| Groq[[Groq - LLaMA 3.1]]
        FastAPI -->|Vision| Gemini[[Gemini 2.0 Flash]]
    end
    
    subgraph "Satellite Databases"
        Spring -->|JPA| Postgres[(PostgreSQL - Analytics)]
        Spring -->|NoSQL| MongoDB[(MongoDB - Logging)]
        Gateway -->|Sub/Pub| Redis[(Redis - Cache/RT)]
    end
    
    Spring -.->|Internal Call| FastAPI
    Gateway -->|Stream Control| MediaMTX[[MediaMTX - HLS/WebRTC]]
```

## CẤU TRÚC THƯ MỤC

```
hoa-qua-son/
│
├── docker-compose.yml            ← [Qdrant] & [MediaMTX] nằm ở đây (Docker Image)
│
├── vendor/
│   └── mediamtx/
│       └── mediamtx.yml          ← [MediaMTX] File config duy nhất cần tải về
│
├── services/
│   ├── spring-service/           ← (Code cũ — để nguyên, refactor sau)
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
```

---

## SERVICES & PORTS

| Service        | Tech              | Port                                   | Trạng thái   |
|----------------|-------------------|----------------------------------------|--------------|
| gateway        | Node.js Express   | 3000                                   | Vận hành     |
| spring-service | Java Spring Boot  | 8080                                   | Vận hành     |
| fastapi-service| Python FastAPI    | 8000                                   | Vận hành     |
| frontend       | Next.js 14        | 3001                                   | Vận hành     |
| mediamtx       | Go binary         | 1935 (RTMP), 8888 (HLS), 9997 (API)    | Vận hành     |
| mysql          | MySQL 8.0         | 3306                                   | Vận hành     |
| postgres       | PostgreSQL 16     | 5432                                   | Vận hành     |
| mongodb        | MongoDB 7         | 27017                                  | Vận hành     |
| redis          | Redis 7           | 6379                                   | Vận hành     |
| qdrant         | Qdrant            | 6333                                   | Vận hành     |

---

## CODE CŨ — JAVA SPRING (`services/spring-service`)

### Đã có sẵn (KHÔNG viết lại):
- Auth: login, register, JWT
- Product: CRUD cơ bản
- Order/Cart: tạo đơn, giỏ hàng
- Payment: MoMo, VNPAY webhook

### Cần thêm vào Spring (KHÔNG sửa file cũ, chỉ ADD):
- `ShippingValidationService` — so sánh shelf-life vs ETD từ GHN API
- `FarmingJournalController` — lưu ảnh nhật ký canh tác vào MongoDB
- `TraceabilityController` — aggregate journal theo batchId, gen QR code
- `InternalOrderController` — nhận order từ gateway khi livestream

---

## SERVICES MỚI CẦN BUILD

### Gateway (Node.js Express)
**Nhiệm vụ:** Auth middleware, reverse proxy, socket.io, livestream room management

Cần build:
- JWT verify middleware (gọi Spring `/auth/verify`)
- Proxy routes → spring-service, fastapi-service
- Socket.io: live chat, live order events trong stream
- Redis Pub/Sub: sync socket events across instances
- Livestream routes: tạo/xóa room trên MediaMTX HTTP API

### FastAPI Service (Python)
**Nhiệm vụ:** Toàn bộ AI và ML

Cần build:
- `POST /ai/generate-post` — Gemini 1.5 Flash → sinh title, description, suggested_price từ ảnh
- `POST /search/embed-product` — embed product → lưu Qdrant
- `GET /search/semantic?q=` — tìm kiếm ngữ nghĩa qua Qdrant
- `POST /chatbot/message` — LangGraph agent + LLaMA 3.1 70B via Groq

### Frontend (Next.js 14 App Router)
Cần build:
- Trang seller: đăng sản phẩm với AI generate, dashboard doanh thu
- Trang buyer: tìm kiếm semantic, xem sản phẩm, đặt hàng
- Livestream page: HLS.js player + live chat + đặt hàng trong stream
- QR scan page: hiển thị timeline truy xuất nguồn gốc

---

## DATABASE SCHEMA (POLYGLOT PERSISTENCE)

Hệ thống sử dụng mô hình lưu trữ đa dạng để tối ưu cho từng loại nghiệp vụ.

### 1. Sơ đồ Thực thể (ER Diagram)

```mermaid
erDiagram
    USER ||--o{ PRODUCT : "sở hữu"
    USER ||--o{ ORDER : "đặt hàng"
    USER ||--o{ VOUCHER : "sử dụng"
    PRODUCT ||--o{ ORDER_ITEM : "nằm trong"
    ORDER ||--o{ ORDER_ITEM : "bao gồm"
    PRODUCT ||--o{ SHIPPING_RULE : "áp dụng"
    PRODUCT ||--o{ PRODUCT_EMBEDDING : "ánh xạ tìm kiếm"
    SELLER ||--o{ FARMING_BATCH : "canh tác"
    FARMING_BATCH ||--o{ FARMING_LOG : "có nhật ký"
    LIVESTREAM ||--|| USER : "tổ chức bởi"
```

### 2. Cấu trúc chi tiết

### Các bảng PostgreSQL chính

| Bảng     | Các cột chính                                              | Quan hệ                          |
|----------|------------------------------------------------------------|----------------------------------|
| users    | id, name, role (FARMER/BUYER), phone, address, created_at  | 1 farmer có nhiều rooms          |
| rooms    | id, stream_key, farmer_id, status (PENDING/LIVE/ENDED)     | 1 room có nhiều orders, messages |
| products | id, farmer_id, name, price, stock, unit                    | 1 product thuộc 1 farmer         |
| orders   | id, room_id, buyer_id, product_id, quantity, status        | Nhiều orders trong 1 room        |
| messages | id (UUID), room_id, sender_id, text, sent_at, is_pinned    | Phần lớn dùng Redis cache        |

### Redis Keys

| Vai trò           | Cách dùng              | Chi tiết                                            |
|-------------------|------------------------|-----------------------------------------------------|
| Message Broker    | Redis Pub/Sub          | Đồng bộ tin nhắn giữa nhiều WS Server instance      |
| Chat History Cache| Redis List (LPUSH/LRANGE) | Cache 100 tin nhắn gần nhất mỗi phòng            |
| Session Store     | Redis String/Hash      | Lưu session token, tránh query PostgreSQL mỗi request |
| Rate Limiting     | Redis Counter + TTL    | Giới hạn spam chat: max 5 tin/giây mỗi user         |
| Online Counter    | Redis HyperLogLog      | Đếm số viewer đang xem theo phòng (approximate)     |

---

## ENVIRONMENT VARIABLES

### Chung (`docker-compose.env`)
```env
POSTGRES_URL=postgresql://postgres:password@postgres:5432/hoaquason
MONGO_URL=mongodb://mongodb:27017/hoaquason
REDIS_URL=redis://redis:6379
QDRANT_HOST=qdrant
QDRANT_PORT=6333
```

### Gateway (`.env`)
```env
PORT=3000
JWT_SECRET=hoaquason_secret
SPRING_URL=http://spring-service:8080
FASTAPI_URL=http://fastapi-service:8000
MEDIAMTX_API=http://mediamtx:9997
```

### FastAPI (`.env`)
```env
GEMINI_API_KEY=
GROQ_API_KEY=
QDRANT_HOST=qdrant
MONGO_URL=mongodb://mongodb:27017/hoaquason
```

### Spring (`application.properties`)
```env
GHN_TOKEN=
GHN_SHOP_ID=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
CLOUDFLARE_R2_ENDPOINT=
```

---

## LUỒNG CHÍNH

### Luồng đăng bán Sản phẩm (Hybrid)
```
[Cách 1: AI Flow]
Seller upload ảnh (Frontend)
→ POST /ai/generate-post (FastAPI)
→ Gemini Flash phân tích ảnh → Trả về title, description, price
→ Seller kiểm tra & nhập số lượng (mặc định 100kg)
→ POST /api/user/products (Spring)

[Cách 2: Manual Flow]
Seller nhập tay thông tin trực tiếp (Frontend) 
→ Upload ảnh sản phẩm (Bắt buộc)
→ POST /api/user/products (Spring)

[Hậu xử lý]
→ Spring lưu DB MySQL 
→ Gọi POST /search/embed-product (FastAPI) để index vector vào Qdrant
```

### Luồng livestream
```
Seller bấm "Bắt đầu live" (Frontend)
→ POST /livestream/start (Gateway)
→ Gateway tạo streamKey, gọi MediaMTX API tạo path
→ Trả về {rtmpUrl, hlsUrl} cho Frontend
→ Browser WebRTC → MediaMTX → FFmpeg transcode → LL-HLS
→ Viewer xem qua HLS.js
→ Chat/Order qua Socket.io → Redis Pub/Sub
```

### Luồng truy xuất nguồn gốc
```
Seller chụp ảnh vườn hàng ngày
→ POST /farming-journal (Spring)
→ Lưu MongoDB + extract GPS từ EXIF
→ Khi thu hoạch: POST /traceability/{batchId}/generate-qr (Spring)
→ Aggregate tất cả logs theo batchId
→ Gen QR PNG → upload S3 → trả qrUrl
→ Buyer quét QR → GET /traceability/{batchId} → xem timeline
```

---

## RULES — ĐỌC KỸ

1. KHÔNG rewrite file có sẵn trong `spring-service` từ đầu
2. Khi thêm vào Spring: tạo file mới, KHÔNG sửa file cũ trừ khi cần add `@Bean` hoặc import
3. Mỗi task chỉ làm 1 service tại một thời điểm
4. Sau mỗi thay đổi: liệt kê rõ file nào bị sửa, test command là gì
5. Internal service calls dùng hostname trong Docker network (`spring-service`, `fastapi-service`...). Tất cả services chạy chung trên một custom bridge network tên là `hoaquason_network`
6. KHÔNG dùng `localhost` trong service-to-service calls
7. Windows path: dùng forward slash trong docker-compose volumes
8. Mọi endpoint mới phải có error handling và trả về `{success, data, error}` format
9. Có thể xóa nếu không cần thiết hoặc vô dụng

---

# PHẦN 2 — CHỨC NĂNG CHI TIẾT: NGƯỜI BÁN (LHP)

## Chức năng 1: Dashboard Đơn & Doanh thu

### Dữ liệu đầu vào (Input)

- **Dữ liệu đơn hàng:** Trạng thái đơn (Thành công, Đang giao, Đã hủy, Đang khiếu nại), Ngày giờ tạo đơn
- **Dữ liệu dòng tiền:** Giá trị đơn hàng, Phí vận chuyển, Phí sàn (nếu có), Chiết khấu/Voucher đã áp dụng
- **Dữ liệu truy cập (Traffic):** Lượt xem trang cửa hàng, lượt click vào từng sản phẩm cụ thể

### Luồng xử lý (Flow)

1. **Trích xuất & Lọc dữ liệu (Data Extraction):** Dựa vào bộ lọc thời gian người bán chọn (Hôm nay, 7 ngày qua, 30 ngày qua, hoặc tùy chỉnh), hệ thống query dữ liệu tương ứng từ Database.
2. **Xử lý tính toán (Metric Calculation):**
   - Tính tổng doanh thu gộp và doanh thu thực nhận (sau khi trừ phí nền tảng)
   - Tính tỷ lệ chuyển đổi (Conversion Rate) = Tổng số đơn / Tổng lượt truy cập
   - Tính tỷ lệ hủy đơn/hoàn hàng để đánh giá rủi ro
3. **Chuẩn bị dữ liệu trực quan (Data Rendering):** Chuyển đổi các con số thô thành cấu trúc dữ liệu mảng/JSON để đưa vào các thư viện vẽ biểu đồ ở phía Frontend.

### Dữ liệu trả về (Output)

- **Bảng thống kê tổng quan:** Các thẻ (Card) hiển thị Doanh thu, Số đơn mới, Tỷ lệ hủy/hoàn
- **Biểu đồ trực quan:** Line chart theo dõi xu hướng doanh thu, Pie chart phân bổ trạng thái đơn hàng
- **Danh sách "Top sản phẩm":** Hiển thị những loại nông sản mang lại doanh thu cao nhất để nông hộ có kế hoạch gieo trồng/nhập thêm

---

## Chức năng 2: Quản lý danh sách Sản phẩm

### Dữ liệu đầu vào (Input)

- **Hành động (Action):** Thêm mới (Create), Sửa (Update), Xóa (Delete), Ẩn/Hiện (Toggle Visibility)
- **Dữ liệu sản phẩm:** Tên nông sản, Hình ảnh thực tế, Giá bán, Trọng lượng/Quy cách đóng gói, Số lượng tồn kho, Hạn sử dụng/Shelf-life

### Luồng xử lý (Flow)

1. **Tiếp nhận và Xác thực (Validation):** Kiểm tra tính hợp lệ (Giá bán > 0, Hình ảnh đúng định dạng/dung lượng, Tồn kho không âm)
2. **Xử lý Logic Ràng buộc (Business Rules Check):**
   - Nếu thao tác là **Sửa/Ẩn:** Cập nhật ngay lập tức trạng thái trên cửa hàng người mua
   - Nếu thao tác là **Xóa:** Hệ thống kiểm tra sản phẩm có đang nằm trong các đơn hàng "Chờ xử lý" hoặc "Đang giao" hay không
     - *Nếu có:* Cảnh báo lỗi và từ chối xóa, chỉ cho phép "Ẩn" (Soft Delete)
     - *Nếu không:* Thực thi xóa vĩnh viễn (Hard Delete)
3. **Cập nhật Kho (Inventory Sync):** Lưu thay đổi vào Database và tự động vô hiệu hóa nút "Thêm vào giỏ" nếu tồn kho về 0

### Dữ liệu trả về (Output)

- **Bảng danh sách sản phẩm mới nhất (Data Grid):** Hiển thị các sản phẩm đã được cập nhật kèm trạng thái thực tế
- **Thông báo hệ thống (Toast/Alert):** Báo cáo kết quả thao tác

---

## Chức năng 3: Quản lý vận chuyển

### Dữ liệu đầu vào (Input)

- **Xác nhận từ người bán:** Lệnh "Đã chuẩn bị hàng xong" cho một `OrderID` cụ thể
- **Thông tin lấy hàng:** Tọa độ, địa chỉ kho/vườn xuất phát của nông hộ, số điện thoại liên hệ
- **Thông số thực tế:** Khối lượng/Kích thước chốt sau khi đóng gói

### Luồng xử lý (Flow)

1. **Xác nhận đóng gói:** Hệ thống chuyển trạng thái đơn từ "Chờ xác nhận" sang "Đang chuẩn bị hàng / Chờ lấy hàng"
2. **Giao tiếp với Đối tác vận chuyển (Booking API):** Hệ thống tự động đóng gói dữ liệu (Điểm A, Điểm B, Khối lượng, Ghi chú giao hàng tươi sống) và gọi API tạo đơn đến các đối tác (Ahamove, GHN, Viettel Post...)
3. **Xử lý chứng từ:**
   - Nhận API Response chứa Mã vận đơn
   - Tự động Generate Phiếu giao hàng dạng PDF hoặc ảnh chứa Mã vạch/QR
4. **Khởi chạy Tracking:** Mở luồng lắng nghe Webhook từ đối tác để liên tục cập nhật vị trí shipper và trạng thái giao hàng

### Dữ liệu trả về (Output)

- **Mã vận đơn (Tracking Code):** Để cả người bán và người mua cùng theo dõi
- **Phiếu giao hàng điện tử:** File để nông hộ in ra dán lên thùng carton/túi hàng
- **Trạng thái Real-time:** "Chờ Shipper đến lấy" → "Đang trung chuyển" → "Giao thành công"

---

## Chức năng 4: Uy tín người bán

### Dữ liệu đầu vào (Input)

- **Đánh giá trực tiếp:** Số sao (Rating) và nội dung review từ người mua
- **Chỉ số vận hành:** Tỷ lệ giao hàng đúng hạn, Tỷ lệ đơn bị hủy do lỗi người bán
- **Chỉ số khiếu nại:** Số lượng khiếu nại hoàn tiền thành công do hàng dập nát/hư hỏng

### Luồng xử lý (Flow)

1. **Lắng nghe sự kiện (Event Listener):** Mỗi khi một đơn hàng hoàn tất hoặc một khiếu nại được giải quyết, hệ thống kích hoạt trigger thu thập điểm số
2. **Thuật toán chấm điểm (Trust Scoring Logic):** Tính điểm uy tín trung bình dựa trên trọng số (VD: Review 5 sao cộng điểm, 1 khiếu nại dập nát trừ điểm gấp 3 lần)
3. **Quản lý Huy hiệu (Badge Management):**
   - *Thăng cấp:* Điểm > 4.8 sao và tỷ lệ hủy < 2% trong 30 ngày → Cấp huy hiệu "Nông Hộ Tiêu Biểu" hoặc "Freeship Extra"
   - *Hạ cấp:* Điểm giảm hoặc bị report nhiều → Gửi cảnh báo, tước huy hiệu tạm thời, giảm thứ hạng hiển thị
4. **Đồng bộ Profile:** Đẩy toàn bộ thay đổi ra Trang cá nhân của nông hộ

### Dữ liệu trả về (Output)

- **Điểm uy tín hệ thống (Trust Score):** Con số tổng hợp được cập nhật liên tục
- **Huy hiệu bảo chứng (Badges):** Hiển thị trực quan trên gian hàng và trang sản phẩm
- **Khuyến nghị cải thiện:** Thông báo gợi ý hành động cải thiện chỉ số

---

# PHẦN 3 — CHỨC NĂNG CHI TIẾT: NGƯỜI MUA (webdev_task)

## Chức năng 1: Đặt hàng và Thanh toán

### Dữ liệu đầu vào (Input)

- **Thông tin sản phẩm:** ProductID, Quantity, Shelf-life/Expiry Days, Mã giảm giá
- **Thông tin người nhận:** Họ và tên, Số điện thoại liên hệ
- **Địa chỉ chi tiết:** Tỉnh/Thành phố, Quận/Huyện, Phường/Xã (cả người mua và người bán để tính khoảng cách)
- **Tuỳ chọn giao hàng:** Giao tiêu chuẩn / Hỏa tốc
- **Phương thức thanh toán:** COD hoặc Online

### Luồng xử lý (Flow)

1. **Xác thực nghiệp vụ cơ bản:** Truy vấn DB kiểm tra tồn kho và tính hợp lệ mã giảm giá
2. **Xác thực khả năng vận chuyển nông sản tươi:**
   - Gọi API đối tác vận chuyển để lấy ETD (Estimated Time of Delivery) và khoảng cách địa lý
   - *Giao tiêu chuẩn:* Nếu ETD > Shelf-life → cảnh báo và vô hiệu hóa tùy chọn này
   - *Giao Hỏa Tốc:* Nếu khoảng cách > 30km hoặc khác Tỉnh/Thành → ẩn/vô hiệu hóa tùy chọn
3. **Tính toán chi phí (Pricing Engine):** Tổng = (Đơn giá × Số lượng) + Phí vận chuyển - Số tiền giảm giá
4. **Xử lý thanh toán (Payment Gateway):**
   - *Nhánh COD:* Tạo đơn ngay
   - *Nhánh Online:* Chuyển hướng sang cổng thanh toán → chờ Webhook kết quả
5. **Khởi tạo đơn hàng:** Tạo bản ghi trong DB, trừ tồn kho
6. **Thông báo:** Gửi xác nhận cho người mua và báo "Có đơn hàng mới" đến Dashboard nông hộ

### Dữ liệu trả về (Output)

- **Mã đơn hàng (Order ID):** VD: `ORD-20260327-001`
- **Trạng thái real-time:** Chờ xác nhận → Đóng gói → Đang giao → Đã nhận → Hoàn thành
- **Biên lai điện tử:** Chi tiết thanh toán, thông tin giao hàng và thời gian nhận hàng dự kiến

---

## Chức năng 2: Kiểm hàng và Trả hàng/Hoàn tiền

### Dữ liệu đầu vào (Input)

- **Mã đơn hàng (OrderID):** Hệ thống chỉ hiển thị các đơn có trạng thái "Đã nhận"
- **Hình ảnh/Video thực tế:** Ảnh chụp cận cảnh vết dập nát, video unboxing quay rõ mã vận đơn
- **Lý do hoàn hàng (Reason Code):** Hàng bị dập nát do vận chuyển, không đúng mô tả, giao thiếu số lượng, hàng biến chất

### Luồng xử lý (Flow)

1. **Kiểm tra "Thời gian vàng":** Nút khiếu nại chỉ có hiệu lực trong **24h** từ lúc Shipper cập nhật "Giao hàng thành công"
2. **Phân tích bằng chứng (Evidence Analysis):** Kiểm tra Metadata ảnh — đảm bảo ảnh được chụp tại đúng tọa độ giao hàng và đúng thời điểm phát sinh khiếu nại
3. **Thông báo và Phản hồi từ Người bán:** Nông hộ có tối đa 24 giờ để:
   - Chấp nhận: Đồng ý hoàn tiền ngay
   - Từ chối: Đưa ra lý lẽ phản hồi
   - Đề xuất mới: Thương lượng hoàn tiền một phần
4. **Quyết định cuối cùng:**
   - Hai bên thống nhất → thực thi lệnh hoàn tiền
   - Tranh chấp → Admin sàn làm trọng tài dựa trên bằng chứng video
5. **Thực thi hoàn tiền:** Áp dụng chính sách **"Hoàn tiền - Không thu hồi hàng"** (người mua không cần gửi trả bó rau hỏng)

### Dữ liệu trả về (Output)

- **Mã phiếu khiếu nại (TicketID):** Dùng để theo dõi tiến độ xử lý
- **Trạng thái khiếu nại:** Đã gửi yêu cầu → Nông hộ đang xem xét → Đang thương lượng → Hoàn tiền thành công / Bị từ chối
- **Thông báo kết quả:** Gửi qua App/SMS cho cả hai bên
- **Cập nhật uy tín:** Nếu lỗi thuộc về người bán quá nhiều lần → hạ điểm Trust Score tự động

---

## Chức năng 3: Đánh giá & Trang cá nhân

### Dữ liệu đầu vào (Input)

Form đánh giá chỉ mở khi đơn hàng chuyển sang trạng thái "Hoàn thành":
- **Mã định danh:** OrderID và ProductID
- **Mức độ hài lòng (Rating):** Hệ thống sao (1–5 sao)
- **Nội dung (Text):** Nhận xét chi tiết của người mua
- **Bằng chứng trực quan (Media):** Ảnh/Video

### Luồng xử lý (Flow)

1. **Xác thực "Người mua thật" (Verified Purchase):** Kiểm tra chéo UserID và OrderID — chỉ tài khoản thực sự phát sinh giao dịch thành công mới được review (chặn buff đơn ảo, review giả)
2. **Cập nhật dữ liệu & Tính toán Trust Score:** Tính lại điểm đánh giá trung bình của sản phẩm và toàn bộ cửa hàng nông hộ
3. **Trích xuất dữ liệu ra Trang cá nhân:**
   - Đẩy về Trang Sản phẩm: Review được ghim dưới sản phẩm
   - Đẩy về Trang Nông hộ: Cập nhật vào hồ sơ thương hiệu
   - Đẩy về Trang Người mua: Lưu vào lịch sử hoạt động
4. **Trả thưởng (Gamification):** Cộng xu (Agri-Coin)

### Dữ liệu trả về (Output)

- **Hiển thị Review:** Xuất hiện công khai trên trang sản phẩm
- **Trang cá nhân Nông hộ:** Hiển thị tổng số sản phẩm đã bán, tỷ lệ 5 sao, feedback thực tế
- **Trang cá nhân Người mua:** Hiển thị "Lịch sử đánh giá", cấp bậc khách hàng (Người dùng uy tín, Chuyên gia ẩm thực xanh)

---

## Chức năng 4: Truy xuất Nguồn gốc & Trợ lý Nhắc nhở Thông minh

### Dữ liệu đầu vào (Input)

- **Mã định danh khu vực (Batch ID):** Tên gọi thân thiện do nông hộ thiết lập (VD: "Luống Xà Lách - Tháng 3")
- **Thuộc tính sinh học:** Chu kỳ sinh trưởng dự kiến (VD: rau ăn lá ~30 ngày, củ cải ~45 ngày)
- **Dữ liệu Hình ảnh/Video:** Bằng chứng sinh trưởng thực tế
- **Dữ liệu Môi trường & Định vị (Auto-fetched):** Tọa độ GPS (từ EXIF) + dữ liệu Thời tiết từ API

### Luồng xử lý & Logic Ràng buộc (Flow)

1. **Khởi tạo Đợt trồng (T=0):** Nông dân chọn "Tạo luống mới" → hệ thống tự động tạo BatchID duy nhất và bắt đầu đếm ngược chu kỳ sống
2. **Quy định Cột mốc tối thiểu:** Bắt buộc tối thiểu 3–4 cột mốc sinh trưởng cốt lõi:
   - Mốc 1: Xuống giống
   - Mốc 2 & 3: Giai đoạn phát triển / Chăm sóc
   - Mốc 4: Cận ngày thu hoạch
3. **Trợ lý Nhắc nhở Tự động (Push Notifications):** Hệ thống tự động chia đều thời gian để nhắc nhở (VD: Luống xà lách 30 ngày → thông báo ngày thứ 10 và 20). Thông báo thân thiện: *"Chú Ba ơi, luống xà lách gieo được 10 ngày rồi, chú ra vườn chụp 1 tấm ảnh nhé!"*
4. **Lọc Gian lận (Anti-Fraud Check):** Khi ảnh được tải lên, Backend trích xuất GPS và đối chiếu với tọa độ vườn đã đăng ký. Nếu sai lệch → cảnh báo và từ chối cập nhật

### Dữ liệu trả về (Output — Trải nghiệm Người mua)

Khi người mua quét mã QR trên bao bì:
- **Hành trình Sinh trưởng (Growth Story):** Timeline xuyên suốt 4 cột mốc (VD: "Ngày 15/03 - 14:00 - Trời nắng gắt 35°C - Chú Ba đang che bạt cho luống xà lách")
- **Bản đồ Vị trí:** GPS của khu vườn trên nền tảng bản đồ số

### Data Sync Flow: Nhật ký canh tác ↔ Truy xuất nguồn gốc

**Góc nhìn Nông dân (Frontend):** Chỉ là đăng Story với Dropdown bắt buộc chọn BatchID (Gắn thẻ luống trồng).

**Góc nhìn Hệ thống (Backend):** Khi nút "Đăng" được bấm, Backend nhận gói dữ liệu và thực hiện **2 luồng song song:**

- **Luồng 1 (Marketing):** Đẩy ảnh và dòng trạng thái ra Trang cá nhân Nông hộ — hiển thị như Story Facebook/Zalo để tạo tương tác và niềm tin
- **Luồng 2 (Minh bạch dữ liệu):** Âm thầm bóc tách GPS, gọi API Thời tiết, lưu vĩnh viễn vào Database map chặt với BatchID → đến ngày thu hoạch, gom tất cả ảnh thuộc BatchID để đúc thành mã QR truy xuất

---

# PHẦN 4 — CHỨC NĂNG ĐẶC THÙ

## Đăng bài và Kiểm duyệt

### 1. Đăng bài + Đồng bộ Facebook

Người bán phải cấp quyền cho app qua **Facebook Login (OAuth 2.0)**, yêu cầu scope `pages_manage_posts` + `pages_read_engagement`. Sau khi xác thực, Facebook trả về Page Access Token — mã hóa token này và lưu vào DB gắn theo từng shop.

Khi người bán bấm "Đăng bài cùng Facebook", backend gọi `POST /v19.0/{page-id}/feed` với payload gồm message (nội dung + giá) và link trỏ về trang sản phẩm. Nếu có ảnh thì upload trước qua `/photos?published=false` để lấy `photo_id`, rồi đính kèm vào bài post.

> **Lưu ý:** Cả hai thao tác — lưu DB và gọi Facebook — nên chạy song song để tiết kiệm thời gian, và nếu một bên lỗi thì báo riêng, không chặn bên kia.

### 2. Kiểm duyệt sản phẩm — Xác minh giấy chứng nhận OCOP

Bộ NN&PTNT có cổng `ocop.gov.vn` công khai danh sách sản phẩm OCOP. Xây một **crawler định kỳ hàng ngày** để tải về danh sách này, lưu vào database nội bộ, rồi khi admin duyệt thì tự động so khớp tên sản phẩm + tên cơ sở với dữ liệu đã tải:

- Nếu khớp → hiển thị "Xác nhận tồn tại trong CSDL OCOP quốc gia"
- Nếu không khớp → cảnh báo admin kiểm tra kỹ hơn

---

# PHẦN 5 — AI WORKFLOW

## Nhiệm vụ 1: Tự động định giá sản phẩm và tạo danh sách

**Đầu vào:** Hình ảnh sản phẩm, tên sản phẩm, nơi trồng  
**Đầu ra:** Đề xuất mức giá, mô tả và tiêu đề để đăng lên các chợ trực tuyến

### Giai đoạn 1: Chuẩn bị dữ liệu thị trường (JSON tham chiếu)

Tạo tệp JSON tiêu chuẩn chứa dữ liệu giá cả của đối thủ cạnh tranh. Mỗi mục bao gồm tên sản phẩm, nơi trồng (nguồn gốc) và giá của đối thủ.

Cách tạo dữ liệu:
- Tạo thủ công tệp JSON giả lập với 5–10 ví dụ thực tế để kiểm tra logic/demo
- Triển khai công cụ quét web để tự động trích xuất dữ liệu và cập nhật định kỳ *(định hướng phát triển tương lai)*

### Giai đoạn 2: Thu thập đầu vào

Hệ thống thu thập 3 thông tin đầu vào bắt buộc:
- **Hình ảnh sản phẩm:** Ảnh rõ nét (AI dùng để đánh giá bao bì, chất lượng trực quan)
- **Tên sản phẩm:** Tên thô/nội bộ (VD: Hạt cà phê Robusta)
- **Nơi trồng:** Nguồn gốc xuất xứ (VD: Đắk Lắk, Việt Nam)

### Giai đoạn 3: Tích hợp API AI (Gemini Flash)

Gửi gói dữ liệu đa phương thức tới API (hình ảnh + thông tin người dùng + JSON tham chiếu).

Prompt yêu cầu AI đóng vai **chuyên gia phân tích giá cả thương mại điện tử**:
- Phân tích trực quan hình ảnh
- Đối chiếu tên sản phẩm và nơi trồng với dữ liệu thị trường JSON
- Tính toán mức giá cạnh tranh dựa trên đối chiếu và chất lượng ảnh
- Soạn tiêu đề chuẩn SEO và mô tả làm nổi bật nguồn gốc sản phẩm

> **Kiểm soát đầu ra:** Cấu hình API để bắt buộc trả về JSON nghiêm ngặt (chỉ các trường thông tin cần thiết, không tạo ra câu chữ dư thừa)

### Giai đoạn 4: Kết quả

- **Giá đề xuất:** Mức giá được tính toán dựa trên dữ liệu
- **Tiêu đề:** Tiêu đề sản phẩm thu hút, phù hợp thị trường
- **Mô tả:** Đoạn mô tả chi tiết và có tính thuyết phục cao

---

## Nhiệm vụ 2: Chatbot Hỗ trợ Nông dân (RAG)

### Giai đoạn 1: Cơ sở kiến thức (JSON)

Tổng hợp tất cả bài hướng dẫn canh tác, chu kỳ sinh trưởng, cách làm đất và phương pháp kiểm soát sâu bệnh vào một tệp JSON có cấu trúc. Tệp này là nguồn duy nhất chứa thông tin thực tế mà chatbot được phép truy cập.

### Giai đoạn 2: Nhúng và Lập chỉ mục

Sử dụng Embedding Model đọc dữ liệu JSON và chuyển đổi văn bản thành các vector toán học, lưu trữ trong Cơ sở dữ liệu Vector (Qdrant).

### Giai đoạn 3: Truy xuất bằng Embedding tiếng Việt

Khi người nông dân đặt câu hỏi, câu hỏi được chuyển đổi thành vector. Hệ thống tìm kiếm sự tương đồng trong Vector DB, trích xuất các kết quả có độ trùng khớp cao nhất.

### Giai đoạn 4: Tạo phản hồi (LLaMA 3.1 70B via Groq)

LLM nhận câu hỏi gốc + hướng dẫn vừa truy xuất + bộ quy tắc hệ thống:
- **Rào chắn bảo vệ:** Chặn các yêu cầu không liên quan đến nông nghiệp (thể thao, công thức nấu ăn, v.v.)
- **Thực thi:** Nếu câu hỏi liên quan đến nông nghiệp → đọc JSON đã truy xuất và tạo câu trả lời hữu ích, thân thiện

---

## Nhiệm vụ 3: Hệ thống Tìm kiếm Ngữ nghĩa

### Giai đoạn 1: Chuẩn bị và Lưu trữ Dữ liệu

1. Thu thập toàn bộ dữ liệu văn bản sản phẩm (tên, danh mục, mô tả ngắn)
2. Tải Embedding Model (giống chatbot)
3. Vector hóa từng đoạn văn bản sản phẩm → chuỗi số liệu dày đặc (dense vector)
4. Lưu trữ toàn bộ vector vào Qdrant

### Giai đoạn 2: Tìm kiếm và Truy xuất Real-time

1. Người dùng nhập từ khóa
2. Nhúng từ khóa qua cùng Embedding Model → tạo vector truy vấn
3. Tính toán độ tương đồng (cosine similarity) với tất cả vector sản phẩm trong Qdrant
4. Trả về **5 kết quả hàng đầu** có điểm tương đồng cao nhất

---

# PHẦN 6 — KIẾN TRÚC LIVESTREAM & CHAT

## Tổng quan kiến trúc

Hệ thống được chia thành hai pipeline độc lập chạy song song: **Video Pipeline** (xử lý stream video) và **Chat Pipeline** (xử lý tin nhắn realtime).

### Stack công nghệ tổng thể

| Layer      | Chức năng                             | Công nghệ sử dụng              |
|------------|---------------------------------------|--------------------------------|
| Ingest     | Nhận stream video từ farmer           | RTMP Protocol — port 1935      |
| Processing | Transcode video, tạo ABR              | MediaMTX + FFmpeg              |
| Delivery   | Phân phối video đến hàng nghìn viewer | HLS + CDN Cloudflare           |
| Realtime   | Chat & đồng bộ tin nhắn              | WebSocket + Redis Pub/Sub      |
| API        | Xác thực JWT, quản lý phòng, đơn hàng | Node.js Express / Python FastAPI |
| Database   | Lưu trữ users, rooms, sản phẩm, đơn  | PostgreSQL + Redis Cache       |
| Client     | Giao diện người dùng                  | React + HLS.js + Socket.io     |

### Luồng dữ liệu End-to-end

```
Farmer (RTMP) → MediaMTX (Nhận & transcode) → CDN HLS (Cache & phân phối) → Viewer (Xem + đặt hàng)

Viewer/Farmer (Gửi tin) → WS Server (Nhận & publish) → Redis Pub/Sub (Broadcast) → Tất cả User (Nhận realtime)
```

---

## Chức năng 1 — Livestream Bán Hàng (Farmer)

### Bước 1 — Xác thực & Tạo phòng

- Farmer gửi `POST /api/rooms/create` kèm JWT token
- Express xác thực JWT → kiểm tra quyền tạo phòng
- Tạo record Room trong PostgreSQL với trạng thái `PENDING`
- Server trả về `stream_key` và RTMP URL: `rtmp://server/live/farm-abc123`

### Bước 2 — Farmer đẩy stream (RTMP Ingest)

| Thông số    | Giá trị ví dụ              | Ghi chú                     |
|-------------|----------------------------|-----------------------------|
| RTMP URL    | rtmp://media.agri.vn/live  | Địa chỉ MediaMTX server      |
| Stream Key  | farm-abc123                | Định danh phòng, từ API trả về |
| Video Codec | H.264 (libx264)            | Codec phổ biến, tương thích tốt |
| Audio Codec | AAC                        | Chuẩn âm thanh cho HLS       |
| Bitrate     | 2500–4000 kbps             | Tùy chất lượng mạng farmer   |
| Keyframe    | 2 giây                     | Quan trọng cho HLS chunk alignment |

### Bước 3 — Transcode & Adaptive Bitrate (FFmpeg)

| Chất lượng     | Resolution | Video Bitrate | Audio Bitrate | Phù hợp mạng       |
|----------------|------------|---------------|---------------|--------------------|
| Cao (HD)       | 1280×720p  | 2000 kbps     | 128 kbps      | WiFi, 4G LTE tốt   |
| Trung bình (SD)| 854×480p   | 800 kbps      | 96 kbps       | 4G bình thường, 3G tốt |
| Thấp (LD)      | 640×360p   | 300 kbps      | 64 kbps       | 3G yếu, vùng sâu xa |

```bash
ffmpeg -i rtmp://localhost/live/farm-abc123 \
  -vf scale=1280:720 -b:v 2000k -c:v libx264 \
  -vf scale=854:480 -b:v 800k -c:v libx264 \
  -vf scale=640:360 -b:v 300k -c:v libx264 \
  -hls_time 4 -hls_list_size 10 -hls_flags delete_segments \
  -f hls /hls/farm-abc123/index.m3u8
```

### Bước 4 — Phân phối qua CDN (Cloudflare)

| Tình huống                   | Không có CDN                      | Có CDN (Cloudflare)              |
|------------------------------|-----------------------------------|----------------------------------|
| 1,000 viewer xem cùng lúc    | 1,000 request/giây đến origin     | ~10 request/giây (cache hit ~99%)|
| Viewer ở xa server           | Latency ~100–200ms                | Latency ~20–40ms từ edge gần nhất|
| Origin server bị quá tải     | Stream bị gián đoạn               | CDN tiếp tục serve từ cache      |

### Bước 5 — Đặt hàng trong phòng Live

```
Viewer bấm "Đặt hàng"
→ POST /api/orders { productId, quantity, roomId, sessionToken }
→ Express xác thực token → tạo order PENDING
→ Emit WebSocket event "new_order" đến farmer
→ Farmer xác nhận → order CONFIRMED → viewer nhận notification
```

---

## Chức năng 2 — Chat Người mua — Bán (Real-time)

### Tại sao cần WebSocket?

| Cách tiếp cận    | Cơ chế                                | Phù hợp cho    |
|------------------|---------------------------------------|----------------|
| HTTP Short Polling | Client hỏi server mỗi 1 giây         | Không phù hợp chat |
| HTTP Long Polling  | Client giữ request                   | Chat không critical |
| **WebSocket**    | Kết nối TCP 2 chiều liên tục, server push | ✅ Chat realtime |
| Server-Sent Events | Server push 1 chiều                 | Notification đơn giản |

### Kiến trúc Redis Pub/Sub (giải quyết vấn đề scale)

**Vấn đề:** Khi có nhiều WS Server, User A (Server 1) gửi tin nhắn chỉ được broadcast trong Server 1 — User B (Server 2) KHÔNG nhận được.

**Giải pháp:** Tất cả WS Server cùng subscribe một channel trên Redis. Khi một server nhận tin nhắn, nó publish lên Redis, Redis tự động forward đến TẤT CẢ server đang subscribe.

### Luồng một tin nhắn Chat (End-to-End, < 100ms)

1. User A gõ tin nhắn → Socket.io client emit `chat:message`
2. WS Server 1 nhận event → xác thực user trong phòng
3. Server 1 lưu vào Redis List: `LPUSH chat:farm-abc123`
4. Server 1 publish lên Redis: `PUBLISH room:farm-abc123`
5. Redis forward đến tất cả WS Server đang SUBSCRIBE
6. Mỗi WS Server broadcast đến tất cả client trong room
7. React app nhận event → render tin nhắn mới trong chat box

### Chat moderation & tính năng đặt hàng qua Chat

| Tính năng              | Cơ chế thực hiện                                         |
|------------------------|----------------------------------------------------------|
| Lọc ngôn từ xấu        | Check qua banned words list trước khi publish (Redis Set) |
| Ghim tin nhắn quan trọng | Farmer pin → broadcast event `chat:pin`                |
| Đặt hàng qua chat      | User gõ `/order [sản phẩm]` → server parse → tạo order  |
| Rate limiting chống spam | Max 5 tin/10 giây mỗi user (Redis INCR + TTL)          |

---

## Chức năng 3 — Xem Livestream (Viewer / Người mua)

### Hai kết nối song song của Viewer App

| Kết nối 1: HLS.js → CDN            | Kết nối 2: Socket.io → WS Server        |
|-------------------------------------|-----------------------------------------|
| Giao thức: HTTP (GET requests)      | Giao thức: WebSocket (persistent TCP)   |
| Dùng để: tải video chunks (.ts)     | Dùng để: gửi/nhận chat, notifications  |
| Tần suất: mỗi 4 giây tải 1 chunk mới | Tần suất: liên tục, push theo sự kiện |
| Đặc điểm: Stateless, cacheable      | Đặc điểm: Stateful, persistent, realtime |

### Khởi động HLS Player (HLS.js)

1. Tải `master.m3u8` → parse để biết có 3 quality variants (720p, 480p, 360p)
2. Đo bandwidth hiện tại (ABR algorithm) → chọn quality phù hợp ban đầu
3. Tải `index.m3u8` → lấy danh sách chunks hiện tại
4. Download chunk 1, 2, 3 vào buffer → bắt đầu phát khi đủ buffer (~8–12 giây)
5. Mỗi 4 giây: tải manifest mới → kiểm tra có chunk mới → download liên tục
6. Nếu bandwidth giảm → ABR tự động switch xuống quality thấp hơn

### Xử lý tình huống đặc biệt

| Tình huống                     | Cơ chế xử lý                               | Kết quả cho User                    |
|--------------------------------|--------------------------------------------|-------------------------------------|
| Viewer mất mạng giữa chừng     | HLS.js tự retry, Socket.io auto-reconnect   | Tiếp tục xem sau vài giây           |
| Stream bị gián đoạn (farmer mất mạng) | MediaMTX phát hiện RTMP disconnect → emit `stream:offline` | Viewer thấy "Stream đang gián đoạn" |
| Nhiều người đặt cùng 1 sản phẩm hết hàng | Optimistic lock PostgreSQL | Người đặt sau nhận "Sản phẩm đã hết hàng" |
| Viewer vùng mạng yếu (3G)      | HLS ABR tự chuyển xuống 360p               | Video vẫn phát ổn, chất lượng thấp hơn |
| Stream key bị lộ               | Webhook auth khi RTMP connect, invalid key bị reject | Kẻ xâm nhập không thể push stream |

---

## Kiến trúc API Layer

| Service          | Tech              | Port | Trách nhiệm chính                                 |
|------------------|-------------------|------|---------------------------------------------------|
| API Gateway/Auth | Node.js Express   | 3000 | JWT auth, quản lý phòng, WebSocket server, routing |
| Agri Business API| Python FastAPI    | 8000 | Quản lý sản phẩm, đơn hàng, farmer profile, inventory |
| ML/AI Services   | Python FastAPI    | 8001 | Dự đoán giá (Prophet), sentiment chat, recommendation |
| Media Server     | MediaMTX          | 1935 (RTMP), 8080 (HLS) | Ingest RTMP, transcode HLS, serve stream |
| Cache/Broker     | Redis             | 6379 | Pub/Sub, session, chat history, rate limit       |
| Database         | PostgreSQL        | 5432 | Persistent storage: users, rooms, orders, products |

---

*Tài liệu tổng hợp từ: LHP.docx · webdev_task.docx · thucln.docx · AI_workflow.docx · Đăng_bài_và_kiểm_duyệt.docx · project overview (thucln)*