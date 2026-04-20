Ok, mình vẽ bức tranh rõ ràng cho bạn. **Một trang duy nhất**, không lan man.

---
## Bức tranh feature: Input → Output

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  FARMER                                                     │
│  ─────                                                      │
│  📸 Upload 3-5 ảnh xoài                                    │
│  📝 Nhập: số lượng, vùng, ngày hái, phương pháp           │
│                          ↓                                  │
│                                                             │
│  AI PIPELINE (30-60 giây)                                  │
│  ────────────                                              │
│  1. Gemma 4 nhìn ảnh → trích 15 features                   │
│  2. Lookup giá tham chiếu + tìm 10 sản phẩm tương tự       │
│  3. Tính giá = rule × multipliers + kNN average            │
│  4. Cerebras Llama viết bài đăng tiếng Việt                │
│                          ↓                                  │
│                                                             │
│  FARMER NHẬN ĐƯỢC                                          │
│  ─────────────                                             │
│  ✅ "Xoài cát Hòa Lộc loại 2, độ tin cậy 87%"             │
│  ✅ Giá đề xuất: 38,000 VND/kg                             │
│     ├─ Giá gốc loại 2: 45,000                              │
│     ├─ × 0.92 (có 1 quả dập)                               │
│     ├─ × 1.10 (VietGAP)                                    │
│     └─ × 0.85 (chính vụ tháng 5)                           │
│  ✅ "8 sản phẩm tương tự bán ~36,000 VND"                  │
│  ✅ Bài đăng đầy đủ title + description + hashtags         │
│  ✅ Nút EDIT từng phần + nút ĐĂNG                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack quyết định cuối (đóng băng, không đổi)

| Layer | Tool | Free? |
|---|---|---|
| Vision LLM | **Gemma 4 26B MoE** qua OpenRouter | ✅ |
| Vision fallback | Gemini 2.5 Flash → Qwen 2.5 VL | ✅ |
| Pricing engine | **Rule-based + kNN** (KHÔNG ML) | ✅ |
| Vector DB | Qdrant local (Docker) | ✅ |
| Embedding | Gemini Embedding | ✅ |
| Text gen | Cerebras Llama 3.3 70B | ✅ |
| Storage | MinIO local | ✅ |
| DB | Postgres | ✅ |
| Orchestration | LangGraph | ✅ |

**Tổng chi phí: 0 đồng.**

---

## Roadmap 4 ngày — KHÓA SCOPE

```
NGÀY 1 — DATA + INFRASTRUCTURE
├── Sáng: Setup FastAPI, Postgres, Qdrant, MinIO (Docker compose)
├── Chiều: Crawl 2-3K sản phẩm từ Foodmap + Postmart
└── Tối: Index Qdrant + seed pricing_kb.yaml (10 sản phẩm)
✅ Done khi: query Qdrant trả về top-10 similar products

NGÀY 2 — VISION + PRICING (CORE)
├── Sáng: VisionProviderChain với 3 fallback providers
├── Chiều: price_calculator với 7 multipliers + kNN
└── Tối: CLI test với 30 ảnh thật
✅ Done khi: chạy `python test.py xoai.jpg` ra full JSON

NGÀY 3 — LANGGRAPH + POST GEN
├── Sáng: Wire 8 nodes vào LangGraph + conditional routing
├── Chiều: post_generator + validator (retry logic)
└── Tối: End-to-end test 10 ảnh
✅ Done khi: graph chạy đủ pipeline trả về draft

NGÀY 4 — API + UI + DEMO
├── Sáng: FastAPI endpoints + Node Gateway forward
├── Chiều: Next.js form + draft preview với breakdown
└── Tối: Demo prep + record video backup
✅ Done khi: demo flow hoạt động end-to-end qua browser
```

---

## Kiến trúc hệ thống

```
┌──────────────┐
│  Next.js 14  │  Upload form + Draft preview UI
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────┐
│ Node Gateway │  Forward + auth check
└──────┬───────┘
       │ HTTP
       ▼
┌─────────────────────────────────────┐
│  Python FastAPI                     │
│  ┌──────────────────────────────┐  │
│  │  LangGraph Pipeline          │  │
│  │  ┌──────────────────────┐   │  │
│  │  │ 1. validate_input    │   │  │
│  │  │ 2. vision_extractor  │───┼──┼──► OpenRouter (Gemma 4)
│  │  │ 3. safety_check      │   │  │  ├─► Gemini (fallback 1)
│  │  │ 4. ┌─ base_price     │   │  │  └─► Qwen VL (fallback 2)
│  │  │    ├─ seasonal      │   │  │
│  │  │    └─ similar (kNN) │───┼──┼──► Qdrant
│  │  │ 5. price_calculator  │   │  │
│  │  │ 6. post_generator    │───┼──┼──► Cerebras (Llama 3.3)
│  │  │ 7. post_validator    │   │  │
│  │  │ 8. save_draft        │───┼──┼──► Postgres
│  │  └──────────────────────┘   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│  MinIO       │  Image storage
│  Postgres    │  Drafts + reference data
│  Qdrant      │  Vector search (~3K products)
└──────────────┘
```

---

## File structure đề xuất

```
ai-service/
├── app/
│   ├── main.py                      # FastAPI entry
│   ├── api/
│   │   └── routes/
│   │       └── post_gen.py          # /generate, /confirm
│   ├── agents/
│   │   ├── graph.py                 # LangGraph build
│   │   ├── state.py                 # PostGenState TypedDict
│   │   └── nodes/
│   │       ├── vision.py            # vision_extractor
│   │       ├── pricing.py           # price_calculator
│   │       ├── post_gen.py          # post_generator
│   │       └── validators.py        # validate_input, post_validator
│   ├── llm/
│   │   ├── providers.py             # VisionProviderChain, TextChain
│   │   └── prompts.py               # VISION_PROMPT, POST_GEN_PROMPT
│   ├── storage/
│   │   ├── postgres.py
│   │   ├── qdrant_client.py
│   │   └── minio_client.py
│   └── data/
│       ├── pricing_kb.yaml          # Seed data
│       └── seasonal_info.yaml
├── scripts/
│   ├── crawl_foodmap.py             # Run trước sprint
│   ├── crawl_postmart.py
│   └── index_qdrant.py
├── tests/
│   └── test_pipeline.py             # CLI test
├── docker-compose.yml               # Postgres + Qdrant + MinIO
├── .env
└── requirements.txt
```

---

## 3 thứ KHÔNG được làm (cám dỗ scope creep)

❌ **Không train ML model** — không có ground truth, để Phase 2

❌ **Không thêm news/weather context** — phase 2

❌ **Không build voice input, AR, multi-language** — sau competition

---

## Định nghĩa "DONE" cho phase 1

Demo cuối phải show được:

1. ✅ Farmer upload 3 ảnh xoài đẹp → AI nhận ra "xoài cát Hòa Lộc loại 1", giá ~55K
2. ✅ Farmer upload ảnh xoài dập → AI nhận ra "loại 3, có dập", giá ~28K
3. ✅ Farmer upload ảnh con mèo → AI từ chối lịch sự "không phải nông sản"
4. ✅ Click "Xem cách tính giá" → hiện full breakdown (×0.85 do dập, ×1.15 do VietGAP)
5. ✅ "8 sản phẩm tương tự bán giá ~47K" (từ Qdrant kNN)
6. ✅ Bài đăng tiếng Việt tự nhiên, có thể edit trước khi đăng

**Có 6 cái này = win demo.**

---

## Hành động NGAY trong 1 giờ tới

```bash
# 1. Setup repo (15 phút)
mkdir hoa-qua-son-ai && cd hoa-qua-son-ai
mkdir -p app/{agents/nodes,llm,storage,data,api/routes} scripts tests
touch docker-compose.yml requirements.txt .env

# 2. Đăng ký API keys (15 phút)
# - OpenRouter: https://openrouter.ai/keys (cho Gemma 4)
# - Gemini: https://aistudio.google.com/apikey (fallback)  
# - Cerebras: https://cloud.cerebras.ai (text gen)

# 3. Docker compose lên Postgres + Qdrant + MinIO (15 phút)
docker compose up -d