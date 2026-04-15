const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { redis, redisPub } = require("../config/redis");

const router = express.Router();
const MEDIAMTX_API = process.env.MEDIAMTX_API || "http://localhost:9997";
const SPRING_URL = process.env.SPRING_URL || "http://localhost:8080";

// ══════════════════════════════════════════════════════════════
// BƯỚC 1 — Xác thực & Tạo phòng Live
// Farmer gửi POST /api/livestream/start kèm JWT token
// Server xác thực → tạo room trạng thái PENDING → trả stream_key + URLs
// ══════════════════════════════════════════════════════════════
router.post("/start", async (req, res) => {
  try {
    const { title, products } = req.body;
    const sellerId = req.user.id;
    const sellerName = req.user.email;

    // ── Validate tiêu đề ──
    const safeTitle = (title || "Livestream").slice(0, 200).trim();

    // ── Tạo stream key duy nhất (format: live-{sellerId}-{uuid8}) ──
    const streamKey = `live-${sellerId}-${uuidv4().slice(0, 8)}`;

    // ── Không cần tạo path trước qua API ──
    // MediaMTX sẽ tự động tạo path khi có kết nối WHIP/RTMP 
    // và áp dụng các quy tắc trong 'all_others' (bao gồm xác thực & transcode)
    /*
    await axios.post(`${MEDIAMTX_API}/v3/config/paths/add/${streamKey}`, {
      source: "publisher",
    }).catch(() => {});
    */

    // ── Lưu session vào Redis (TTL 8 tiếng) ──
    // Trạng thái ban đầu: PENDING (chờ farmer bắt đầu push stream)
    const session = {
      streamKey,
      sellerId,
      sellerName,
      title: safeTitle,
      status: "PENDING",           // PENDING → LIVE → ENDED
      viewerCount: 0,
      products: products || [],     // Danh sách sản phẩm bán trong phòng live
      createdAt: new Date().toISOString(),
    };
    await redis.setex(`livestream:${streamKey}`, 28800, JSON.stringify(session));

    // ── Trả về stream_key và các URL để farmer kết nối ──
    const whipBase = process.env.NEXT_PUBLIC_WHIP_URL || "http://localhost:8889";
    const hlsBase = process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888";
    
    res.json({
      success: true,
      data: {
        streamKey,
        rtmpUrl: `rtmp://localhost:1935/${streamKey}`,
        webrtcUrl: `${whipBase}/${streamKey}/whip`,
        hlsUrl: `${hlsBase}/${streamKey}/index.m3u8`,
        viewerUrl: `/live/${streamKey}`,
      },
    });
  } catch (err) {
    console.error("[Livestream] Start error:", err.message);
    res.status(500).json({ success: false, error: "Failed to start livestream" });
  }
});

// ══════════════════════════════════════════════════════════════
// BƯỚC 2 — Webhook xác thực Stream Key khi RTMP/WHIP connect
// MediaMTX gọi endpoint này để verify stream key hợp lệ
// Ngăn kẻ xâm nhập push stream với key giả
// ══════════════════════════════════════════════════════════════
router.post("/auth/publish", async (req, res) => {
  try {
    const { path, action, ip } = req.body || {};
    // path = tên stream key từ MediaMTX (vd: "live-5-abc12345" hoặc "live-5-abc12345-aac")
    let streamKey = (path || "").replace(/^\//, "");

    // Nếu là luồng transcode, lấy key gốc để check
    const originalKey = streamKey.replace(/-(opus|aac)$/, "");

    // ── Read actions: luôn cho phép — stream có tồn tại hay không là việc của MediaMTX ──
    // Viewer HLS/WebRTC không cần xác thực; luồng không tồn tại → MediaMTX tự trả 404.
    if (action === "read") {
      return res.status(200).send();
    }

    console.log(`[Livestream Auth] Publish request: key=${streamKey}, ip=${ip}`);

    // ── Kiểm tra stream key tồn tại trong Redis (chỉ cho publish) ──
    const session = await redis.get(`livestream:${originalKey}`);
    if (!session) {
      console.warn(`[Livestream Auth] REJECTED — Stream key not found: ${originalKey}`);
      return res.status(401).send();
    }

    const parsed = JSON.parse(session);

    // ── Kiểm tra quyền Publish ──
    if (action === "publish") {
      if (parsed.status === "ENDED") {
        console.warn(`[Livestream Auth] REJECTED — Stream already ended: ${originalKey}`);
        return res.status(403).send();
      }

      // Chỉ cập nhật trạng thái và broadcast nếu là luồng gốc (farmer)
      // FFmpeg (luồng -aac) không cần cập nhật lại status
      if (streamKey === originalKey) {
        parsed.status = "LIVE";
        parsed.startedAt = parsed.startedAt || new Date().toISOString();
        await redis.setex(`livestream:${originalKey}`, 28800, JSON.stringify(parsed));

        // Broadcast sự kiện stream:online
        redisPub.publish("live:stream-status", JSON.stringify({
          streamKey: originalKey,
          status: "LIVE",
          title: parsed.title,
          sellerId: parsed.sellerId,
        })).catch(() => {});
        
        console.log(`[Livestream Auth] ACCEPTED — Publisher (Farmer) is LIVE: ${originalKey}`);
      } else {
        console.log(`[Livestream Auth] ACCEPTED — Transcoder is publishing: ${streamKey}`);
      }
    }

    // ── Chấp nhận yêu cầu (200 OK cho cả publish và read) ──
    res.status(200).send();
  } catch (err) {
    console.error("[Livestream Auth] Error:", err.message);
    res.status(500).send();
  }
});

// ══════════════════════════════════════════════════════════════
// Webhook khi stream disconnect (farmer mất mạng / ngắt OBS)
// MediaMTX gọi khi publisher ngắt kết nối
// ══════════════════════════════════════════════════════════════
router.post("/auth/unpublish", async (req, res) => {
  try {
    const { path } = req.body;
    const streamKey = (path || "").replace(/^\//, "");

    console.log(`[Livestream] Publisher disconnected: ${streamKey}`);

    const session = await redis.get(`livestream:${streamKey}`);
    if (session) {
      const parsed = JSON.parse(session);
      // ── Phát hiện RTMP disconnect → emit stream:offline ──
      // Viewer sẽ thấy "Stream đang gián đoạn"
      parsed.status = "OFFLINE";
      parsed.offlineAt = new Date().toISOString();
      await redis.setex(`livestream:${streamKey}`, 28800, JSON.stringify(parsed));

      redisPub.publish("live:stream-status", JSON.stringify({
        streamKey,
        status: "OFFLINE",
        message: "Farmer đã mất kết nối",
      })).catch(() => {});
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Livestream] Unpublish webhook error:", err.message);
    res.status(200).json({ ok: true });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/livestream/active — Danh sách phòng live đang hoạt động
// Viewer truy cập trang /live để xem các phòng đang phát sóng
// ══════════════════════════════════════════════════════════════
router.get("/active", async (_req, res) => {
  try {
    const keys = await redis.keys("livestream:*");
    const sessions = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        // ── Chỉ trả về stream đang LIVE hoặc PENDING (không trả ENDED) ──
        if (parsed.status !== "ENDED") {
          sessions.push(parsed);
        }
      }
    }
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/livestream/:streamKey — Lấy thông tin chi tiết phòng live
// Bao gồm: tiêu đề, trạng thái, sản phẩm, số lượng viewer
// ══════════════════════════════════════════════════════════════
router.get("/:streamKey", async (req, res) => {
  try {
    const { streamKey } = req.params;
    const session = await redis.get(`livestream:${streamKey}`);
    if (!session) {
      return res.status(404).json({ success: false, error: "Stream not found" });
    }
    res.json({ success: true, data: JSON.parse(session) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PUT /api/livestream/:streamKey/products — Cập nhật sản phẩm trong phòng live
// Farmer có thể thêm/bớt sản phẩm đang bán trong khi phát sóng
// ══════════════════════════════════════════════════════════════
router.put("/:streamKey/products", async (req, res) => {
  try {
    const { streamKey } = req.params;
    const { products } = req.body;  // Array of { id, name, price, image, quantity }

    const session = await redis.get(`livestream:${streamKey}`);
    if (!session) return res.status(404).json({ success: false, error: "Stream not found" });

    const parsed = JSON.parse(session);
    // ── Chỉ chủ phòng mới được cập nhật sản phẩm ──
    if (parsed.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not your stream" });
    }

    parsed.products = products || [];
    await redis.setex(`livestream:${streamKey}`, 28800, JSON.stringify(parsed));

    // ── Broadcast danh sách sản phẩm mới đến tất cả viewer ──
    redisPub.publish("live:products-update", JSON.stringify({
      streamKey,
      products: parsed.products,
    })).catch(() => {});

    res.json({ success: true, data: { products: parsed.products } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/livestream/stop — Farmer kết thúc phiên live
// Cập nhật trạng thái → ENDED, xóa path trên MediaMTX
// ══════════════════════════════════════════════════════════════
router.post("/stop", async (req, res) => {
  try {
    const { streamKey } = req.body;
    const session = await redis.get(`livestream:${streamKey}`);
    if (!session) return res.status(404).json({ success: false, error: "Stream not found" });

    const parsed = JSON.parse(session);
    // ── Xác thực quyền: chỉ chủ phòng mới được dừng ──
    if (parsed.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not your stream" });
    }

    // ── Cập nhật trạng thái ENDED ──
    parsed.status = "ENDED";
    parsed.endedAt = new Date().toISOString();
    await redis.setex(`livestream:${streamKey}`, 3600, JSON.stringify(parsed));

    // ── Xóa path trên MediaMTX ──
    await axios.delete(`${MEDIAMTX_API}/v3/config/paths/delete/${streamKey}`).catch(() => {});

    // ── Broadcast stream:ended cho tất cả viewer ──
    redisPub.publish("live:stream-status", JSON.stringify({
      streamKey,
      status: "ENDED",
      message: "Phiên live đã kết thúc",
    })).catch(() => {});

    res.json({ success: true, data: { message: "Stream ended" } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BƯỚC 5 — Đặt hàng trong phòng Live
// Viewer bấm "Đặt hàng" → POST /api/livestream/:streamKey/order
// Express xác thực token → tạo order PENDING
// Emit WebSocket event "new_order" đến farmer
// Sử dụng optimistic lock PostgreSQL để xử lý nhiều người đặt cùng lúc
// ══════════════════════════════════════════════════════════════
router.post("/:streamKey/order", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { streamKey } = req.params;
    const buyerId = req.user.id;
    const buyerName = req.user.email;

    // ── Validate input ──
    if (!productId || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
      return res.status(400).json({ success: false, error: "Invalid productId" });
    }
    if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || Number(quantity) > 99) {
      return res.status(400).json({ success: false, error: "Invalid quantity (1-99)" });
    }

    // ── Kiểm tra phòng live còn hoạt động ──
    const session = await redis.get(`livestream:${streamKey}`);
    if (!session) {
      return res.status(404).json({ success: false, error: "Stream not found" });
    }
    const parsed = JSON.parse(session);
    if (parsed.status === "ENDED") {
      return res.status(400).json({ success: false, error: "Stream has ended" });
    }

    // ── Gọi Spring Order API để tạo đơn hàng ──
    // Spring backend xử lý optimistic lock cho inventory
    // Nếu sản phẩm hết hàng → trả lỗi "Sản phẩm đã hết hàng"
    const orderRes = await axios.post(`${SPRING_URL}/api/internal/orders/live`, {
      buyerId,
      productId,
      quantity,
      streamKey,
    });

    // ── Broadcast sự kiện đặt hàng qua Redis Pub/Sub ──
    // Farmer nhận notification, viewer thấy overlay "Có người vừa đặt hàng"
    const payload = {
      roomId: streamKey,
      buyerId,
      buyerName,
      productId,
      quantity,
      orderId: orderRes.data?.orderId,
      timestamp: new Date().toISOString(),
    };
    redisPub.publish("live:order", JSON.stringify(payload)).catch(() => {});

    res.json({ success: true, data: { message: "Đặt hàng thành công!", orderId: orderRes.data?.orderId } });
  } catch (err) {
    console.error("[Livestream] Live Order Error:", err.message);
    // ── Xử lý lỗi hết hàng từ Spring backend ──
    if (err.response?.status === 409) {
      return res.status(409).json({ success: false, error: "Sản phẩm đã hết hàng" });
    }
    res.status(500).json({ success: false, error: "Không thể đặt hàng lúc này" });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/livestream/:streamKey/chat-history — Lấy lịch sử chat
// Trả về 50 tin nhắn gần nhất từ Redis cache
// ══════════════════════════════════════════════════════════════
router.get("/:streamKey/chat-history", async (req, res) => {
  try {
    const { streamKey } = req.params;
    const cacheKey = `chat:${streamKey}`;
    // ── Lấy 50 tin nhắn mới nhất từ Redis List ──
    const messages = await redis.lrange(cacheKey, 0, 49);
    // Messages được lưu theo thứ tự mới nhất trước (LPUSH)
    // Reverse lại để hiển thị đúng thứ tự thời gian
    const parsed = messages.map((m) => JSON.parse(m)).reverse();
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
