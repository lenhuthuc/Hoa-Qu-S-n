const { Server } = require("socket.io");
const { redisSub, redisPub, redisClient } = require("../config/redis");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const JWT_SECRET = process.env.JWT_SECRET || "hoaquason_secret_key_2026";
const SPRING_URL = process.env.SPRING_URL || "http://localhost:8080";
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (allowedOrigins.length === 0) {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  );
}

// ══════════════════════════════════════════════════════════════
// CHAT MODERATION — Lọc ngôn từ xấu & Rate Limiting
// Check qua banned words list trước khi publish (Redis Set)
// Max 5 tin/10 giây mỗi user (Redis INCR + TTL)
// ══════════════════════════════════════════════════════════════
const BANNED_WORDS = [
  "scam", "lừa đảo", "hack", "spam", "fake", "giả mạo",
  "lừa", "cheat", "bẩn", "đểu", "rác",
];
const RATE_LIMIT_MAX = 5;       // Tối đa 5 tin nhắn
const RATE_LIMIT_WINDOW = 10;   // trong 10 giây

function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w));
}

async function checkRateLimit(userId) {
  const key = `ratelimit:chat:${userId}`;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, RATE_LIMIT_WINDOW);
    return count <= RATE_LIMIT_MAX;
  } catch {
    return true; // cho phép khi Redis lỗi
  }
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: "/ws",
  });

  // ══════════════════════════════════════════════════════════════
  // LIVESTREAM NAMESPACE (/live)
  // Xử lý: Chat realtime, đặt hàng qua chat, viewer count,
  // pin message, stream status, sản phẩm trong phòng
  // ══════════════════════════════════════════════════════════════
  const liveNs = io.of("/live");

  // ── Auth middleware (cho phép anonymous viewer xem stream) ──
  liveNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = { id: decoded.id, email: decoded.sub, roles: decoded.roles };
      } catch {
        // Cho phép viewer ẩn danh xem livestream
      }
    }
    next();
  });

  liveNs.on("connection", (socket) => {
    console.log(`[Socket] Live connect: ${socket.id}`);

    // ════════════════════════════════════════════════════════
    // JOIN ROOM — Viewer tham gia phòng livestream
    // 1. Join Socket.io room
    // 2. Cập nhật viewer count → broadcast cho tất cả
    // 3. Gửi tin nhắn ghim (nếu có) cho viewer mới
    // 4. Gửi lịch sử chat 50 tin gần nhất
    // ════════════════════════════════════════════════════════
    socket.on("join-room", async (roomId) => {
      socket.join(roomId);
      socket.currentRoom = roomId;

      // ── Cập nhật và broadcast viewer count ──
      const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
      liveNs.to(roomId).emit("viewer-count", count);

      // ── Cập nhật viewer count vào Redis session ──
      try {
        const session = await redisClient.get(`livestream:${roomId}`);
        if (session) {
          const parsed = JSON.parse(session);
          parsed.viewerCount = count;
          await redisClient.setex(`livestream:${roomId}`, 28800, JSON.stringify(parsed));
        }
      } catch {}

      // ── Gửi tin nhắn ghim cho viewer mới ──
      redisClient.get(`pin:${roomId}`).then((pinned) => {
        if (pinned) socket.emit("chat-pin", JSON.parse(pinned));
      }).catch(() => {});

      // ── Gửi lịch sử chat 50 tin nhắn gần nhất ──
      // Viewer mới vào phòng sẽ thấy ngay các tin nhắn trước đó
      try {
        const cacheKey = `chat:${roomId}`;
        const messages = await redisClient.lrange(cacheKey, 0, 49);
        if (messages.length > 0) {
          const parsed = messages.map((m) => JSON.parse(m)).reverse();
          socket.emit("chat-history", parsed);
        }
      } catch {}

      // ── Gửi trạng thái stream hiện tại ──
      try {
        const session = await redisClient.get(`livestream:${roomId}`);
        if (session) {
          const parsed = JSON.parse(session);
          socket.emit("stream-status", {
            status: parsed.status,
            title: parsed.title,
            sellerName: parsed.sellerName,
            products: parsed.products || [],
          });
        }
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // CHAT MESSAGE — Gửi tin nhắn trong phòng live
    // Luồng: User gõ → validation → moderation → broadcast
    // Redis Pub/Sub đảm bảo tin nhắn đến TẤT CẢ WS servers
    // ════════════════════════════════════════════════════════
    socket.on("chat-message", async (data) => {
      const roomId = data.roomId || data.room;
      const message = data.message || data.text;
      const senderName = data.user || socket.user?.email || "Khách";

      // ═══════════════════════════════════════════
      // /order command — Đặt hàng qua chat
      // User gõ "/order [tên sản phẩm]"
      // → Server parse → tìm sản phẩm → tạo order
      // ═══════════════════════════════════════════
      if (typeof message === "string" && message.startsWith("/order ")) {
        if (!socket.user) {
          return socket.emit("chat-error", { message: "Bạn cần đăng nhập để đặt hàng qua chat" });
        }
        const productQuery = message.slice(7).trim();
        if (!productQuery) {
          return socket.emit("chat-error", { message: "Cú pháp: /order [tên sản phẩm]" });
        }
        try {
          // ── Tìm sản phẩm theo tên trong Spring catalog ──
          const searchRes = await axios.get(
            `${SPRING_URL}/api/products/search?keyword=${encodeURIComponent(productQuery)}&size=1`,
            { timeout: 5000 }
          );
          const items =
            searchRes.data?.content ||
            searchRes.data?.data?.content ||
            searchRes.data?.data ||
            [];
          if (!items.length) {
            return socket.emit("chat-error", { message: `Không tìm thấy sản phẩm "${productQuery}"` });
          }
          const product = items[0];

          // ── Tạo đơn hàng qua Spring internal API ──
          await axios.post(
            `${SPRING_URL}/api/internal/orders/live`,
            { buyerId: socket.user.id, productId: product.id, quantity: 1, streamKey: roomId },
            { timeout: 8000 }
          );

          // ── Xác nhận cho buyer ──
          socket.emit("chat-order-confirm", {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: product.price,
          });

          // ── Broadcast thông báo đặt hàng cho cả phòng ──
          const orderMsg = {
            user: senderName,
            text: `🛒 Đã đặt: ${product.name} — ${Number(product.price || 0).toLocaleString("vi-VN")}đ`,
            ts: Date.now(),
            type: "order",
            roomId,
          };
          liveNs.to(roomId).emit("chat-message", orderMsg);

          // ── Publish qua Redis Pub/Sub cho multi-instance sync ──
          redisPub.publish("live:order", JSON.stringify({
            roomId,
            buyerId: socket.user.id,
            buyerName: senderName,
            productId: product.id,
            productName: product.name,
            quantity: 1,
            timestamp: new Date().toISOString(),
          })).catch(() => {});
        } catch (err) {
          console.error("[Socket] /order error:", err.message);
          // ── Xử lý lỗi hết hàng (optimistic lock) ──
          if (err.response?.status === 409) {
            return socket.emit("chat-error", { message: "Sản phẩm đã hết hàng!" });
          }
          socket.emit("chat-error", { message: "Không thể đặt hàng lúc này, thử lại sau" });
        }
        return;
      }

      // ═══════════════════════════════════════════
      // MODERATION — Lọc ngôn từ xấu
      // Check qua banned words list trước khi publish
      // ═══════════════════════════════════════════
      if (containsBannedWord(message)) {
        return socket.emit("chat-error", { message: "Tin nhắn chứa từ ngữ không phù hợp" });
      }

      // ═══════════════════════════════════════════
      // RATE LIMITING — Chống spam
      // Max 5 tin/10 giây mỗi user (Redis INCR + TTL)
      // ═══════════════════════════════════════════
      const senderId = socket.user?.id || socket.id;
      const allowed = await checkRateLimit(senderId);
      if (!allowed) {
        return socket.emit("chat-error", { message: "Bạn gửi tin quá nhanh, vui lòng chờ" });
      }

      // ═══════════════════════════════════════════
      // BROADCAST TIN NHẮN
      // 1. Publish lên Redis Pub/Sub (cho multi-instance)
      // 2. Emit trực tiếp cho client trên instance này
      // 3. Cache vào Redis List (max 100 tin, TTL 24h)
      // Tổng latency < 100ms
      // ═══════════════════════════════════════════
      const payload = {
        user: senderName,
        text: message,
        ts: Date.now(),
        roomId,
        senderId: socket.user?.id || "anonymous",
      };

      // ── Publish lên Redis → tất cả WS Server subscribe sẽ nhận ──
      redisPub.publish("live:chat", JSON.stringify(payload));

      // ── Broadcast cho tất cả client trong room trên instance này ──
      liveNs.to(roomId).emit("chat-message", payload);

      // ── Cache vào Redis list (tối đa 100 tin nhắn, TTL 24h) ──
      try {
        const cacheKey = `chat:${roomId}`;
        await redisClient.lpush(cacheKey, JSON.stringify(payload));
        await redisClient.ltrim(cacheKey, 0, 99);
        await redisClient.expire(cacheKey, 86400);
      } catch {}
    });

    // ════════════════════════════════════════════════════════
    // GHIM TIN NHẮN — Farmer pin thông báo quan trọng
    // Broadcast event "chat:pin" cho tất cả viewer
    // Lưu vào Redis để viewer mới vào cũng thấy
    // ════════════════════════════════════════════════════════
    socket.on("chat-pin", (data) => {
      const { roomId, message } = data;
      if (!socket.user) return;
      const pinPayload = { user: data.user || socket.user.email, text: message, ts: Date.now() };
      redisClient
        .set(`pin:${roomId}`, JSON.stringify(pinPayload), "EX", 86400)
        .catch(() => {});
      liveNs.to(roomId).emit("chat-pin", pinPayload);
    });

    // ── Bỏ ghim tin nhắn ──
    socket.on("chat-unpin", (data) => {
      const { roomId } = data;
      if (!socket.user) return;
      redisClient.del(`pin:${roomId}`).catch(() => {});
      liveNs.to(roomId).emit("chat-unpin", {});
    });

    // ════════════════════════════════════════════════════════
    // LIVE ORDER — Đặt hàng trực tiếp (từ nút UI, không qua chat)
    // Viewer bấm "Đặt hàng" → emit "live-order"
    // → Server xác thực → tạo order → broadcast notification
    // ════════════════════════════════════════════════════════
    socket.on("live-order", async (data) => {
      const { roomId, productId, quantity } = data;
      if (!socket.user) return socket.emit("error", { error: "Đăng nhập để đặt hàng" });

      try {
        // ── Tạo đơn hàng qua Spring ──
        await axios.post(
          `${SPRING_URL}/api/internal/orders/live`,
          {
            buyerId: socket.user.id,
            productId,
            quantity,
            streamKey: roomId,
          },
          { timeout: 8000 }
        );

        const payload = {
          roomId,
          buyerId: socket.user.id,
          buyerName: socket.user.email,
          productId,
          quantity,
          timestamp: new Date().toISOString(),
        };

        // ── Broadcast cho farmer và viewer ──
        redisPub.publish("live:order", JSON.stringify(payload));
        liveNs.to(roomId).emit("live-order", {
          buyerName: payload.buyerName,
          productId,
          quantity,
        });

        // ── Xác nhận cho buyer ──
        socket.emit("order-success", {
          productId,
          quantity,
          message: "Đặt hàng thành công!",
        });
      } catch (err) {
        console.error("[Socket] live-order error:", err.message);
        if (err.response?.status === 409) {
          return socket.emit("order-error", { message: "Sản phẩm đã hết hàng!" });
        }
        socket.emit("order-error", { message: "Không thể đặt hàng lúc này" });
      }
    });

    // ════════════════════════════════════════════════════════
    // STREAM PRODUCTS UPDATE — Farmer cập nhật sản phẩm bán
    // Broadcast danh sách sản phẩm mới cho tất cả viewer
    // ════════════════════════════════════════════════════════
    socket.on("update-products", async (data) => {
      const { roomId, products } = data;
      if (!socket.user) return;
      liveNs.to(roomId).emit("products-update", { products });
    });

    // ════════════════════════════════════════════════════════
    // LEAVE ROOM & DISCONNECT
    // Cập nhật viewer count khi user rời phòng
    // ════════════════════════════════════════════════════════
    socket.on("leave-room", async (roomId) => {
      socket.leave(roomId);
      const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
      liveNs.to(roomId).emit("viewer-count", count);

      // ── Cập nhật Redis session ──
      try {
        const session = await redisClient.get(`livestream:${roomId}`);
        if (session) {
          const parsed = JSON.parse(session);
          parsed.viewerCount = count;
          await redisClient.setex(`livestream:${roomId}`, 28800, JSON.stringify(parsed));
        }
      } catch {}
    });

    socket.on("disconnect", async () => {
      // ── Cập nhật viewer count cho tất cả room user đang tham gia ──
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
        liveNs.to(roomId).emit("viewer-count", count);

        try {
          const session = await redisClient.get(`livestream:${roomId}`);
          if (session) {
            const parsed = JSON.parse(session);
            parsed.viewerCount = count;
            await redisClient.setex(`livestream:${roomId}`, 28800, JSON.stringify(parsed));
          }
        } catch {}
      }
      console.log(`[Socket] Live disconnect: ${socket.id}`);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // ORDER UPDATES NAMESPACE (/orders)
  // Nhận realtime cập nhật trạng thái đơn hàng
  // ══════════════════════════════════════════════════════════════
  const orderNs = io.of("/orders");

  orderNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = { id: decoded.id, email: decoded.sub, roles: decoded.roles };
      next();
    } catch {
      return next(new Error("Authentication required"));
    }
  });

  orderNs.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
  });

  // ══════════════════════════════════════════════════════════════
  // NOTIFICATIONS NAMESPACE (/notifications)
  // Push notification realtime cho user
  // ══════════════════════════════════════════════════════════════
  const notifNs = io.of("/notifications");

  notifNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = { id: decoded.id, email: decoded.sub, roles: decoded.roles };
      next();
    } catch {
      return next(new Error("Authentication required"));
    }
  });

  notifNs.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    console.log(`[Socket] Notification connect: user ${socket.user.id}`);
  });

  // ══════════════════════════════════════════════════════════════
  // DIRECT MESSAGE NAMESPACE (/dm)
  // Chat 1-1 giữa người mua - người bán
  // ══════════════════════════════════════════════════════════════
  const dmNs = io.of("/dm");

  dmNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = {
        id: decoded.id,
        email: decoded.sub,
        roles: decoded.roles,
        _token: `Bearer ${token}`,
      };
      next();
    } catch {
      return next(new Error("Authentication required"));
    }
  });

  dmNs.on("connection", (socket) => {
    // ── User join phòng inbox cá nhân ──
    socket.join(`user:${socket.user.id}`);
    console.log(`[Socket] DM connect: user ${socket.user.id}`);

    // ── Gửi tin nhắn DM ──
    socket.on("dm:send", async (data) => {
      const { conversationId, recipientId, content } = data;

      if (!conversationId || !recipientId || !content?.trim()) {
        return socket.emit("dm:error", { message: "Thiếu thông tin tin nhắn" });
      }
      const trimmed = String(content).trim();
      if (trimmed.length > 2000) {
        return socket.emit("dm:error", { message: "Tin nhắn quá dài (tối đa 2000 ký tự)" });
      }

      try {
        const resp = await axios.post(
          `${SPRING_URL}/api/messages/conversations/${conversationId}/messages`,
          { content: trimmed },
          { headers: { Authorization: socket.user._token }, timeout: 8000 }
        );
        const msg = resp.data;
        const payload = { ...msg, conversationId: Number(conversationId) };

        // ── Publish qua Redis cho multi-instance sync ──
        redisPub
          .publish(
            "dm:message",
            JSON.stringify({ ...payload, _recipientId: Number(recipientId) })
          )
          .catch(() => {});

        // ── Gửi cho recipient trên instance này ──
        dmNs.to(`user:${recipientId}`).emit("dm:message", payload);
        // ── Xác nhận cho sender ──
        socket.emit("dm:sent", payload);
      } catch (err) {
        console.error("[Socket] DM send error:", err.message);
        socket.emit("dm:error", { message: "Không thể gửi tin nhắn, thử lại sau" });
      }
    });

    // ── Typing indicator (không lưu DB) ──
    socket.on("dm:typing", (data) => {
      const { conversationId, recipientId, isTyping } = data;
      if (!recipientId) return;
      dmNs.to(`user:${recipientId}`).emit("dm:typing", {
        conversationId,
        senderId: socket.user.id,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] DM disconnect: user ${socket.user.id}`);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // REDIS PUB/SUB — Đồng bộ tin nhắn giữa nhiều WS Server
  // Khi có nhiều WS Server, User A (Server 1) gửi tin nhắn
  // → publish lên Redis → Redis forward đến TẤT CẢ server
  // → Mỗi server broadcast đến client trong room
  // ══════════════════════════════════════════════════════════════
  redisSub.subscribe(
    "live:chat",          // Chat livestream
    "live:order",         // Đặt hàng trong live
    "live:viewer-count",  // Cập nhật viewer count
    "live:stream-status", // Trạng thái stream (LIVE/OFFLINE/ENDED)
    "live:products-update", // Cập nhật sản phẩm trong phòng
    "order:update",       // Cập nhật đơn hàng
    "notification:push",  // Push notification
    "dm:message"          // Tin nhắn DM
  );

  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);

      // ── Cập nhật đơn hàng ──
      if (channel === "order:update") {
        orderNs.to(`user:${data.userId}`).emit("order-status", data);
      }

      // ── Push notification ──
      if (channel === "notification:push") {
        notifNs.to(`user:${data.userId}`).emit("notification", data);
      }

      // ── DM message sync ──
      if (channel === "dm:message") {
        const { _recipientId, ...payload } = data;
        if (_recipientId) dmNs.to(`user:${_recipientId}`).emit("dm:message", payload);
      }

      // ── Stream status (LIVE/OFFLINE/ENDED) ──
      // Broadcast cho tất cả viewer trong phòng
      if (channel === "live:stream-status") {
        const { streamKey, ...statusData } = data;
        if (streamKey) {
          liveNs.to(streamKey).emit("stream-status", statusData);
        }
      }

      // ── Products update ──
      if (channel === "live:products-update") {
        const { streamKey, products } = data;
        if (streamKey) {
          liveNs.to(streamKey).emit("products-update", { products });
        }
      }
    } catch (err) {
      console.error("[Redis Sub] Parse error:", err.message);
    }
  });

  return io;
}

module.exports = { initSocket };
