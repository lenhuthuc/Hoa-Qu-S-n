require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");

const { initSocket } = require("./socket");
const authMiddleware = require("./middleware/auth");
const livestreamRoutes = require("./routes/livestream");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);
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

// ─── Middleware (non-body-consuming) ───
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(morgan("short"));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true });
app.use(limiter);

// ─── Health Check ───
app.get("/health", (_req, res) => res.json({ success: true, data: { service: "gateway", status: "ok" } }));

// ─── Proxies BEFORE body parsing so raw stream is intact ───

// Proxy to Spring Service
const springProxy = createProxyMiddleware({
  target: process.env.SPRING_URL || "http://localhost:8080",
  changeOrigin: true,
  pathFilter: [
    "/api/user/**",
    "/api/products/**",
    "/api/cart/**",
    "/api/orders/**",
    "/api/invoices/**",
    "/api/reviews/**",
    "/api/payments/**",
    "/api/admin/**",
    "/api/interactions/**",
    "/api/farming-journal/**",
    "/api/traceability/**",
    "/api/shipping/**",
    "/api/market-prices/**",
    "/api/categories/**",
    "/api/coins/**",
    "/api/messages/**",
    "/api/notifications/**",
    "/api/returns/**",
    "/api/wishlist/**",
    "/api/vouchers/**",
    "/api/stories/**",
    "/api/shop/**",
    "/api/seller/**",
    "/api/trust-score/**",
  ],
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.headers.authorization) {
        proxyReq.setHeader("Authorization", req.headers.authorization);
      }
    },
    error: (err, _req, res) => {
      console.error("Spring proxy error:", err.message);
      res.status(502).json({ success: false, error: "Spring service unavailable" });
    },
  },
});
app.use(springProxy);

// Proxy to FastAPI Service
const fastapiProxy = createProxyMiddleware({
  target: process.env.FASTAPI_URL || "http://localhost:8000",
  changeOrigin: true,
  pathFilter: ["/api/ai/**", "/api/search/**", "/api/chatbot/**"],
  on: {
    error: (err, _req, res) => {
      console.error("FastAPI proxy error:", err.message);
      res.status(502).json({ success: false, error: "AI service unavailable" });
    },
  },
});
app.use(fastapiProxy);

// ─── Body parsing for gateway-owned routes only ───
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Gateway-owned routes ───
const { optionalAuth } = require("./middleware/auth");

// ── Livestream auth webhook (MediaMTX gọi — KHÔNG cần JWT) ──
// MediaMTX gọi khi publisher kết nối/ngắt để xác thực stream key
app.post("/api/livestream/auth/publish", (req, res, next) => {
  req.url = "/auth/publish";
  livestreamRoutes(req, res, next);
});
app.post("/api/livestream/auth/unpublish", (req, res, next) => {
  req.url = "/auth/unpublish";
  livestreamRoutes(req, res, next);
});

// ── Livestream public routes (không cần auth) ──
app.get("/api/livestream/active", optionalAuth, (req, res, next) => {
  req.url = "/active";
  livestreamRoutes(req, res, next);
});
// Xem chi tiết phòng live (public)
app.get("/api/livestream/:streamKey", optionalAuth, (req, res, next) => {
  req.url = `/${req.params.streamKey}`;
  livestreamRoutes(req, res, next);
});
// Lấy lịch sử chat (public)
app.get("/api/livestream/:streamKey/chat-history", optionalAuth, (req, res, next) => {
  req.url = `/${req.params.streamKey}/chat-history`;
  livestreamRoutes(req, res, next);
});

// ── Livestream protected routes (cần JWT) ──
app.use("/api/livestream", authMiddleware, livestreamRoutes);
app.use("/api/upload", authMiddleware, uploadRoutes);

// ─── 404 ───
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// ─── Socket.io ───
initSocket(server);

// ─── Start ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`));

module.exports = { app, server };
