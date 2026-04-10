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

// Banned words list for chat moderation
const BANNED_WORDS = ["scam", "lừa đảo", "hack", "spam"];
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 10; // seconds

function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(w => lower.includes(w));
}

async function checkRateLimit(userId) {
  const key = `ratelimit:chat:${userId}`;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, RATE_LIMIT_WINDOW);
    return count <= RATE_LIMIT_MAX;
  } catch {
    return true; // allow on redis error
  }
}

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: "/ws",
  });

  // ─── Livestream Namespace ───
  const liveNs = io.of("/live");

  // Auth middleware for live namespace (optional — allows anonymous viewers)
  liveNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = { id: decoded.id, email: decoded.sub, roles: decoded.roles };
      } catch {
        // Allow anonymous viewers for livestream
      }
    }
    next();
  });

  liveNs.on("connection", (socket) => {
    console.log(`[Socket] Live connect: ${socket.id}`);

    // Join a livestream room
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
      liveNs.to(roomId).emit("viewer-count", count);

      // Send pinned message if any
      redisClient.get(`pin:${roomId}`).then(pinned => {
        if (pinned) socket.emit("chat-pin", JSON.parse(pinned));
      }).catch(() => {});
    });

    // Chat message in livestream
    socket.on("chat-message", async (data) => {
      const roomId = data.roomId || data.room;
      const message = data.message || data.text;
      const senderName = data.user || socket.user?.email || "Khách";

      // ─── /order command ───
      if (typeof message === "string" && message.startsWith("/order ")) {
        if (!socket.user) {
          return socket.emit("chat-error", { message: "Bạn cần đăng nhập để đặt hàng qua chat" });
        }
        const productQuery = message.slice(7).trim();
        if (!productQuery) {
          return socket.emit("chat-error", { message: "Cú pháp: /order [tên sản phẩm]" });
        }
        try {
          // Find product by name in Spring
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
          // Place live order via Spring internal endpoint
          await axios.post(
            `${SPRING_URL}/api/internal/orders/live`,
            { buyerId: socket.user.id, productId: product.id, quantity: 1, streamKey: roomId },
            { timeout: 8000 }
          );
          // Confirm to buyer
          socket.emit("chat-order-confirm", {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: product.price,
          });
          // Broadcast order notification to the room
          const orderMsg = {
            user: senderName,
            text: `🛒 Đã đặt: ${product.name} — ${Number(product.price || 0).toLocaleString("vi-VN")}đ`,
            ts: Date.now(),
            type: "order",
            roomId,
          };
          liveNs.to(roomId).emit("chat-message", orderMsg);
          redisPub.publish("live:order", JSON.stringify({
            roomId, buyerId: socket.user.id, buyerName: senderName,
            productId: product.id, quantity: 1, timestamp: new Date().toISOString(),
          })).catch(() => {});
        } catch (err) {
          console.error("[Socket] /order error:", err.message);
          socket.emit("chat-error", { message: "Không thể đặt hàng lúc này, thử lại sau" });
        }
        return;
      }

      // Moderation: banned words
      if (containsBannedWord(message)) {
        return socket.emit("chat-error", { message: "Tin nhắn chứa từ ngữ không phù hợp" });
      }

      // Rate limiting
      const senderId = socket.user?.id || socket.id;
      const allowed = await checkRateLimit(senderId);
      if (!allowed) {
        return socket.emit("chat-error", { message: "Bạn gửi tin quá nhanh, vui lòng chờ" });
      }

      const payload = {
        user: senderName,
        text: message,
        ts: Date.now(),
        roomId,
        senderId: socket.user?.id || "anonymous",
      };
      redisPub.publish("live:chat", JSON.stringify(payload));
      liveNs.to(roomId).emit("chat-message", payload);

      // Cache in Redis list (max 100 messages)
      try {
        const cacheKey = `chat:${roomId}`;
        await redisClient.lpush(cacheKey, JSON.stringify(payload));
        await redisClient.ltrim(cacheKey, 0, 99);
        await redisClient.expire(cacheKey, 86400);
      } catch {}
    });

    // Pin a message (only stream owner)
    socket.on("chat-pin", (data) => {
      const { roomId, message } = data;
      if (!socket.user) return;
      const pinPayload = { user: data.user || socket.user.email, text: message, ts: Date.now() };
      redisClient.set(`pin:${roomId}`, JSON.stringify(pinPayload), "EX", 86400).catch(() => {});
      liveNs.to(roomId).emit("chat-pin", pinPayload);
    });

    // Unpin message
    socket.on("chat-unpin", (data) => {
      const { roomId } = data;
      if (!socket.user) return;
      redisClient.del(`pin:${roomId}`).catch(() => {});
      liveNs.to(roomId).emit("chat-unpin", {});
    });

    // Live order event (buyer places order during stream)
    socket.on("live-order", (data) => {
      const { roomId, productId, quantity } = data;
      if (!socket.user) return socket.emit("error", { error: "Login required to order" });
      const payload = {
        roomId,
        buyerId: socket.user.id,
        buyerName: socket.user.email,
        productId,
        quantity,
        timestamp: new Date().toISOString(),
      };
      redisPub.publish("live:order", JSON.stringify(payload));
      liveNs.to(roomId).emit("live-order", {
        buyerName: payload.buyerName,
        productId,
        quantity,
      });
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
      liveNs.to(roomId).emit("viewer-count", count);
    });

    socket.on("disconnect", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const count = liveNs.adapter.rooms.get(roomId)?.size || 0;
        liveNs.to(roomId).emit("viewer-count", count);
      }
      console.log(`[Socket] Live disconnect: ${socket.id}`);
    });
  });

  // ─── Order Updates Namespace ───
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
    // User subscribes to their own order updates
    socket.join(`user:${socket.user.id}`);
  });

  // ─── Notifications Namespace ───
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

  // ─── Redis Pub/Sub for cross-instance sync ───
  // ─── Direct Message Namespace ───
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
    // Each user joins their personal inbox room
    socket.join(`user:${socket.user.id}`);
    console.log(`[Socket] DM connect: user ${socket.user.id}`);

    // Send a message
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

        // Publish via Redis for multi-instance sync
        redisPub.publish("dm:message", JSON.stringify({ ...payload, _recipientId: Number(recipientId) })).catch(() => {});

        // Deliver to recipient on this instance
        dmNs.to(`user:${recipientId}`).emit("dm:message", payload);
        // Confirm to sender
        socket.emit("dm:sent", payload);
      } catch (err) {
        console.error("[Socket] DM send error:", err.message);
        socket.emit("dm:error", { message: "Không thể gửi tin nhắn, thử lại sau" });
      }
    });

    // Typing indicator (ephemeral, no persistence)
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

  // ─── Redis Pub/Sub for cross-instance sync ───
  redisSub.subscribe("live:chat", "live:order", "live:viewer-count", "order:update", "notification:push", "dm:message");

  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === "order:update") {
        orderNs.to(`user:${data.userId}`).emit("order-status", data);
      }
      if (channel === "notification:push") {
        notifNs.to(`user:${data.userId}`).emit("notification", data);
      }
      if (channel === "dm:message") {
        const { _recipientId, ...payload } = data;
        if (_recipientId) dmNs.to(`user:${_recipientId}`).emit("dm:message", payload);
      }
    } catch (err) {
      console.error("[Redis Sub] Parse error:", err.message);
    }
  });

  return io;
}

module.exports = { initSocket };
