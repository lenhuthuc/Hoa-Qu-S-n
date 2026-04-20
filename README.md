# 🍊 Hoa Quả Sơn — Sàn Thương Mại Nông Sản Thông Minh

Nền tảng thương mại điện tử nông sản Việt Nam thế hệ mới.

---

## 📁 Kiến trúc dự án

```bash
HoaQuaSon/
├── Ecommerce/             # Spring Boot (Java 17) — Core API & Business Logic
├── services/
│   ├── gateway/           # Node.js Express — API Gateway & Realtime (Socket.io)
│   └── fastapi-service/   # Python FastAPI — AI Engine (Gemini, LLaMA 3.1)
├── frontend/              # Next.js 14 — User Interface (Light Mode)
├── vendor/mediamtx/       # MediaMTX — Livestreaming Relay Server
└── docker-compose.yml     # Container Orchestration
```

---

## 🎯 Hai Chế Độ Vận Hành

Hệ thống có **2 cách chạy**, dùng cho **mục đích khác nhau**. Đừng nhầm lẫn:

| Chế độ | Mục đích | URL | Ai chạy? |
|---|---|---|---|
| **Dev Local** | Code, test, debug trên máy cá nhân | `http://localhost:3001` | Bất kỳ team member nào |
| **Public Demo** | Giám khảo / tester truy cập từ internet | `https://haquason.uk` | **CHỈ owner laptop** (xem cảnh báo bên dưới) |

---

# PHẦN A — DEV LOCAL (cho team member)

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

Bạn có thể chạy hệ thống theo một trong hai cách dưới đây:

### Cách 1: Vận hành nhanh bằng Docker (Khuyên dùng)

Dùng để chạy toàn bộ hệ thống ngay lập tức trong môi trường Container.

1. **Cấu hình `.env`**: `cp .env.example .env` (Điền các API KEY cần thiết — xem phần 🔑 bên dưới).
2. **Khởi chạy lần đầu** (có build):
   ```bash
   # Nếu chỉ muốn chạy LOCAL (Frontend gọi localhost:3000):
   docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build frontend
   docker compose up -d

   # Nếu muốn chuẩn bị PUBLIC (Frontend gọi api.haquason.uk):
   docker compose up -d --build
   ```
3. **Các lần sau** (không cần build lại):
   ```bash
   docker compose up -d
   ```
4. **Truy cập**: [http://localhost:3001](http://localhost:3001)

### Cách 2: Khởi chạy từng bước (Development Mode)

Dùng khi bạn muốn chạy hạ tầng bằng Docker và chạy code ứng dụng cục bộ để phát triển (hot reload nhanh hơn).

1. **Chạy hạ tầng (DB, Redis, MediaMTX)**:
   ```bash
   docker compose up -d postgres mongodb redis qdrant mediamtx
   ```
2. **Khởi chạy các Service cục bộ**:
   - **Backend**: `cd Ecommerce && ./mvnw spring-boot:run`
   - **Gateway**: `cd services/gateway && npm install && npm run dev`
   - **FastAPI**: `cd services/fastapi-service && uvicorn main:app --reload`
   - **Frontend**: `cd frontend && npm install && npm run dev`

---

## 🔑 File `.env`

Hệ thống sử dụng hai file `.env` riêng biệt:

### 1️⃣ Root `.env` (tổng hợp — nếu chạy toàn bộ container)
```bash
cp .env.example .env
```

### 2️⃣ FastAPI Service `.env` (services/fastapi-service/.env)
```bash
cd services/fastapi-service
cp .env.example .env
```

**Chứa**: AI API keys (Gemini, Groq, OpenRouter), Vector DB config...

### 📋 Các API Keys bắt buộc:

| Service | Lấy từ | Ghi chú |
|---------|--------|--------|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Bắt buộc — nhận diện ảnh + text gen |
| **Groq** | [console.groq.com](https://console.groq.com) | Bắt buộc — LLaMA 3.3 text generation |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Tùy chọn — fallback vision model |

### ⚠️ Quy tắc xử lý `.env`

**Team member cần `.env`**:
- Liên hệ owner qua kênh private (Discord DM, Zalo) để xin file
- **KHÔNG** share file này ra ngoài nhóm
- **KHÔNG** paste nội dung `.env` vào ChatGPT/Claude/public chat
- **KHÔNG** đính kèm `.env` vào email/Slack không được bảo mật

**Owner/CI**:
- Lưu `.env` an toàn (1Password, Vault, GitHub Secrets)
- Update `.env.example` chỉ phần không-sensitive (ví dụ: REDIS_PASSWORD=redis123 là dev default)

---

# PHẦN B — PUBLIC DEMO (CHỈ OWNER)

> Tài liệu này dành cho **demo WDA2026**. Hệ thống được expose ra internet qua **Cloudflare Tunnel** từ máy dev của owner, **không phải deploy VPS thật**.

## ⚠️ CẢNH BÁO QUAN TRỌNG — ĐỌC TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ

### 🔴 Chỉ được chạy trên 1 máy tại 1 thời điểm

Cloudflare Tunnel được cấu hình trên **1 laptop cụ thể** (laptop của owner). Tunnel credentials (file `.json` trong `~/.cloudflared/`) chỉ có trên máy đó.

**Hệ quả**:
- ❌ **KHÔNG** clone tunnel config sang máy khác để chạy song song — sẽ bị conflict routing, cả 2 máy đều fail
- ❌ **KHÔNG** chạy `cloudflared tunnel run` trên máy thứ 2 khi máy 1 đang chạy
- ❌ **KHÔNG** chạy `docker compose up` phục vụ domain `haquason.uk` trên nhiều máy cùng lúc — dữ liệu test sẽ loạn, session token xung đột
- ✅ Nếu muốn chuyển máy chạy: **tắt hoàn toàn máy cũ trước**, mới bật máy mới

*Lưu ý: Team member vẫn có thể chạy dev local (`localhost:3001`) trên máy riêng bình thường. Cảnh báo này chỉ áp dụng cho **public URL** `haquason.uk`.*

### 🔴 Laptop chạy server phải luôn online

- URL `https://haquason.uk` chỉ hoạt động khi laptop owner đang chạy Docker + Tunnel
- Laptop sleep / tắt / mất mạng = website chết toàn phần
- **Trước giờ demo / lúc giám khảo chấm**: phải đảm bảo laptop cắm sạc, tắt sleep mode, mạng ổn định

### 🔴 Không rebuild frontend nếu không thật sự cần

Frontend được build với URL hardcode (`https://api.haquason.uk`, `https://stream.haquason.uk`, etc.) qua biến `NEXT_PUBLIC_*` ở build time. URL đã cố định theo domain Cloudflare.

**Chỉ rebuild frontend khi**:
- Code React/Next.js thay đổi
- URL tunnel thay đổi (không xảy ra nếu dùng Named Tunnel như hiện tại)

Rebuild không cần thiết = tốn 3-5 phút + rủi ro lỗi build.

---

## 📋 Yêu Cầu Máy (chỉ owner)

- **Windows 10/11** (hoặc macOS/Linux — các lệnh tương tự)
- **Docker Desktop** — https://www.docker.com/products/docker-desktop
- **cloudflared** — https://github.com/cloudflare/cloudflared/releases
- **Git**
- **RAM tối thiểu 8GB** (16GB khuyến nghị do stack có Postgres + MongoDB + Qdrant + MinIO)
- **Ổ đĩa còn trống >= 10GB**

---

## 🏗️ Kiến Trúc Hệ Thống (Public Demo)

```
Internet
   │
   ▼
Cloudflare Edge (HTTPS, WAF)
   │
   ▼
Cloudflare Tunnel (cloudflared trên laptop)
   │
   ├─── haquason.uk         → localhost:3001 (Next.js Frontend)
   ├─── api.haquason.uk     → localhost:3000 (Node Gateway)
   ├─── hls.haquason.uk     → localhost:8888 (MediaMTX HLS)
   └─── stream.haquason.uk  → localhost:8889 (MediaMTX WHIP/WHEP)

Docker Compose (trên laptop):
   ├── hqs-frontend      :3001         Next.js
   ├── hqs-gateway       :3000         Node Express (API Gateway)
   ├── hqs-spring        :8080         Spring Boot (auth/product/order/payment)
   ├── hqs-fastapi       :8000         Python FastAPI (AI/ML)
   ├── hqs-mediamtx      :8888 (HLS/TCP)
   │                     :8889 (WHIP/TCP)
   │                     :8189/udp (WebRTC ICE)
   ├── hqs-postgres      :5432
   ├── hqs-mongodb       :27017
   ├── hqs-redis         :6379
   ├── hqs-qdrant        :6333
   └── hqs-minio         :9000
```

---

## 🚀 Khởi Chạy Hằng Ngày

### Bước 1 — Start Docker stack

```powershell
cd C:\path\to\hoaquason
docker compose up -d
```

Chờ ~2-3 phút cho tất cả service healthy. Kiểm tra:

```powershell
docker compose ps
```

Tất cả phải ở trạng thái **`Up`** và cột `STATUS` có **`(healthy)`**. Nếu có service nào `Exit` hoặc `unhealthy`:

```powershell
docker compose logs <tên-service> --tail=50
```

### Bước 2 — Start Cloudflare Tunnel

**Chỉ làm 1 trong 2 cách dưới đây, KHÔNG làm cả hai** (sẽ conflict):

**Cách A — Manual (nếu CHƯA cài Windows Service):**

Mở PowerShell terminal riêng biệt (không tắt suốt thời gian demo):

```powershell
cloudflared tunnel run hqs-demo
```

Đợi thấy 4 dòng log liên tiếp:

```
Registered tunnel connection connIndex=0 ...
Registered tunnel connection connIndex=1 ...
Registered tunnel connection connIndex=2 ...
Registered tunnel connection connIndex=3 ...
```

→ Tunnel đã sẵn sàng.

**Cách B — Service tự chạy (nếu ĐÃ cài Windows Service):**

Không cần làm gì. Tunnel đã chạy ngầm. Verify:

```powershell
Get-Service cloudflared   # Status phải là "Running"
```

### Bước 3 — Verify

Mở trình duyệt trên **điện thoại dùng 4G** (không dùng WiFi cùng laptop để test thật), truy cập:

- `https://haquason.uk` → trang chủ load OK
- `https://api.haquason.uk/health` → trả về 200 OK

Xong. Hệ thống đã public.

---

## 🛑 Tắt Hệ Thống

```powershell
# 1. Tắt tunnel
#    - Nếu chạy Cách A: Ctrl+C trong terminal cloudflared
#    - Nếu chạy Cách B: Stop-Service cloudflared

# 2. Tắt Docker stack
docker compose down
```

Nếu muốn **giữ dữ liệu** (database, MinIO): chỉ `down`, **không** thêm cờ `-v`.

Nếu muốn **xóa sạch (reset toàn bộ data)**:

```powershell
docker compose down -v
```

⚠️ Cảnh báo: `-v` xóa **TẤT CẢ** volume (Postgres, Mongo, Redis, Qdrant, MinIO). Dùng cẩn thận.

---

## 🔧 Setup Lần Đầu (chỉ owner, làm 1 lần)

> Phần này chỉ dành cho owner setup tunnel lần đầu tiên. Team member khác không cần đọc.

### 1. Cài Cloudflared

```powershell
winget install --id Cloudflare.cloudflared
```

### 2. Login + Authorize

```powershell
cloudflared tunnel login
```

Browser mở → chọn domain `haquason.uk` → Authorize.

### 3. Tạo Tunnel

```powershell
cloudflared tunnel create hqs-demo
```

Copy UUID từ output.

### 4. Config File

Tạo `C:\Users\<your-user>\.cloudflared\config.yml`:

```yaml
tunnel: <UUID>
credentials-file: C:\Users\<your-user>\.cloudflared\<UUID>.json

ingress:
  - hostname: haquason.uk
    service: http://localhost:3001
  - hostname: www.haquason.uk
    service: http://localhost:3001
  - hostname: api.haquason.uk
    service: http://localhost:3000
  - hostname: hls.haquason.uk
    service: http://localhost:8888
  - hostname: stream.haquason.uk
    service: http://localhost:8889
  - service: http_status:404
```

### 5. Trỏ DNS

```powershell
cloudflared tunnel route dns hqs-demo haquason.uk
cloudflared tunnel route dns hqs-demo www.haquason.uk
cloudflared tunnel route dns hqs-demo api.haquason.uk
cloudflared tunnel route dns hqs-demo hls.haquason.uk
cloudflared tunnel route dns hqs-demo stream.haquason.uk
```

### 6. (Khuyến nghị) Cài Cloudflared làm Windows Service

Để tunnel tự chạy khi laptop bật, không cần mở terminal:

```powershell
# PowerShell as Administrator
cloudflared service install
```

Từ đó:
- Laptop boot → tunnel tự start
- Không cần chạy `cloudflared tunnel run` mỗi lần
- Chỉ còn cần `docker compose up -d`

⚠️ **Sau khi cài Service, đừng chạy `cloudflared tunnel run hqs-demo` thủ công nữa** — sẽ có 2 instance tranh nhau.

### 7. Docker Desktop Auto-Start

Mở **Docker Desktop → Settings → General** → tick:
- ☑ Start Docker Desktop when you sign in

Kết hợp với `restart: unless-stopped` đã có sẵn trong `docker-compose.yml`, containers sẽ auto-up khi laptop bật.

---

## 🔥 Troubleshooting

### 502 Bad Gateway

**Nguyên nhân**: Cloudflare không reach được service local.

**Check**:
```powershell
# 1. Docker services có chạy không?
docker compose ps

# 2. Service cụ thể có reachable không?
curl http://localhost:3001    # frontend
curl http://localhost:3000    # gateway

# 3. Tunnel có connect không?
cloudflared tunnel list
# → CONNECTIONS phải > 0
```

**Fix thường gặp**:
- Service chưa up → `docker compose up -d <service>`
- Port mapping sai trong `config.yml` → check lại frontend là `3001`, không phải `3000`
- Dùng `127.0.0.1` thay `localhost` trong `config.yml` nếu vẫn fail

### CORS Error

Check CORS config đã allow domain `haquason.uk`:
- Gateway Node: `services/gateway/src/index.ts` (hoặc tương tự)
- Spring Boot: class `CorsConfig` / `WebConfig`

### VNPAY IPN không về

```powershell
docker compose logs -f spring-service | Select-String "ipn"
```

Nếu không thấy log IPN khi thanh toán test:
- Check `VNPAY_IPN_URL` trong `.env` = `https://api.haquason.uk/api/payment/vnpay/ipn`
- Check endpoint IPN có reachable từ ngoài: `curl https://api.haquason.uk/api/payment/vnpay/ipn` (phải ra response, không phải 502)

### Livestream không có tiếng

Đây là **vấn đề đã biết**: khi test **2 tab cùng 1 máy** (streamer + viewer), AEC (echo cancellation) của browser nuốt mic.

**Fix**: test bằng **2 thiết bị khác nhau** — laptop stream, điện thoại xem. Không test cùng 1 máy.

### WebRTC Viewer không work, chỉ thấy HLS

Expected behavior. Cloudflare Tunnel không proxy UDP → WebRTC playback fallback sang HLS (latency 4-8s). Không sửa được trừ khi deploy VPS thật với UDP public.

### Docker out of memory

```powershell
docker stats
```

Nếu RAM máy thiếu:
- Tăng RAM Docker Desktop: Settings → Resources → Memory → >= 6GB
- Tắt các app không cần (Chrome nhiều tab, IDE, Slack, v.v.)

---

## 📞 Liên Hệ Khẩn Cấp

- **Owner laptop**: liên hệ qua kênh private nội bộ team (Discord / Zalo)
- Chi tiết liên hệ xem trong nhóm chat nội bộ — **không public trong repo**

---

## 📝 Checklist Trước Demo

- [ ] Laptop cắm sạc, pin đầy
- [ ] Tắt sleep mode: `powercfg /change standby-timeout-ac 0`
- [ ] Kết nối mạng ổn định (ưu tiên LAN nếu venue có)
- [ ] `docker compose ps` → tất cả healthy
- [ ] `cloudflared tunnel list` → CONNECTIONS > 0
- [ ] Mở `https://haquason.uk` từ điện thoại 4G → load OK
- [ ] Login test → OK
- [ ] Tạo order test + thanh toán VNPAY sandbox → IPN về
- [ ] Livestream test từ 2 thiết bị → có hình + tiếng
- [ ] Video demo backup đã record
- [ ] Screenshot các màn hình chính đã lưu

---

## 🎬 Domain & URL Mapping

### 📱 Chia sẻ lên mạng xã hội 
  * **Facebook Share Dialog:** Chia sẻ sản phẩm lên Facebook với rich preview (hình ảnh, giá, mô tả).
  * **Open Graph Tags:** Tích hợp OG tags tự động để Facebook crawl thông tin sản phẩm.
  * **Hashtags tự động:** Thêm hashtags `#hoaquason #nongsan #fresh #vietnam` vào mỗi bài chia sẻ.

-----
| URL Public | Service | Port Local |
|---|---|---|
| `https://haquason.uk` | Frontend Next.js | 3001 |
| `https://www.haquason.uk` | Frontend Next.js | 3001 |
| `https://api.haquason.uk` | Gateway Node | 3000 |
| `https://hls.haquason.uk` | MediaMTX HLS | 8888 |
| `https://stream.haquason.uk` | MediaMTX WHIP/WHEP | 8889 |

---

## 📄 Các File Cấu Hình Liên Quan

- `docker-compose.yml` — orchestration các service
- `.env` — biến môi trường (⚠️ không commit lên Git)
- `frontend/Dockerfile` — Dockerfile Next.js với `ARG NEXT_PUBLIC_*`
- `vendor/mediamtx/mediamtx.yml` — config MediaMTX
- `C:\Users\<user>\.cloudflared\config.yml` — config Cloudflare Tunnel
- `C:\Users\<user>\.cloudflared\<UUID>.json` — credentials tunnel (⚠️ bí mật, không share)

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
---

_Last updated: 2026-04-19_
© 2026 Hoa Quả Sơn Team
