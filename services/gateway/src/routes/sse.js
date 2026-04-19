const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "hoaquason_secret_key_2026";

// userId (string) → Set<Response>
const clients = new Map();

// Gửi event đến 1 user cụ thể
function sendToUser(userId, event, data) {
  const uid = String(userId);
  clients.get(uid)?.forEach((res) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// GET /api/sse — client kết nối, giữ connection mở
// EventSource không gửi được header → chấp nhận token qua query param
router.get("/", (req, res) => {
  // Ưu tiên Authorization header, fallback về ?token=
  let userId;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = String(decoded.id);
    } catch {
      return res.status(401).end();
    }
  } else if (req.query.token) {
    try {
      const decoded = jwt.verify(req.query.token, JWT_SECRET);
      userId = String(decoded.id);
    } catch {
      return res.status(401).end();
    }
  } else if (req.user?.id) {
    userId = String(req.user.id);
  } else {
    return res.status(401).end();
  }

  const origin = req.headers.origin;
  const allowed = (process.env.CORS_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) {
    allowed.push("http://localhost:3000", "http://localhost:3001",
      "https://haquason.uk", "https://www.haquason.uk");
  }
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);

  // Heartbeat 25s để giữ connection qua proxy/load-balancer
  const heartbeat = setInterval(() => res.write(":ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.get(userId)?.delete(res);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
  });
});

module.exports = { router, sendToUser };
