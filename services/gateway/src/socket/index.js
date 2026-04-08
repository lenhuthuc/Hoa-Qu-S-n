const { Server } = require("socket.io");
const { redisSub, redisPub } = require("../config/redis");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "hoaquason_secret_key_2026";

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: ["http://localhost:3001", "http://localhost:3000"], credentials: true },
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
    });

    // Chat message in livestream
    socket.on("chat-message", (data) => {
      const roomId = data.roomId || data.room;
      const message = data.message || data.text;
      const senderName = data.user || socket.user?.email || "Khách";
      const payload = {
        user: senderName,
        text: message,
        ts: Date.now(),
        roomId,
        senderId: socket.user?.id || "anonymous",
      };
      redisPub.publish("live:chat", JSON.stringify(payload));
      liveNs.to(roomId).emit("chat-message", payload);
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
      // Emit updated viewer count for all rooms this socket was in
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue; // skip the default self-room
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

  // ─── Redis Pub/Sub for cross-instance sync ───
  redisSub.subscribe("live:chat", "live:order", "live:viewer-count", "order:update");

  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === "order:update") {
        orderNs.to(`user:${data.userId}`).emit("order-status", data);
      }
    } catch (err) {
      console.error("[Redis Sub] Parse error:", err.message);
    }
  });

  return io;
}

module.exports = { initSocket };
