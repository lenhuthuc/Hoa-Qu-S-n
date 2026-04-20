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
const { router: sseRouter } = require("./routes/sse");

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
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://haquason.uk",
    "https://www.haquason.uk",
    "https://api.haquason.uk"
  );
}

// ─── Middleware (non-body-consuming) ───
app.use(helmet({ crossOriginResourcePolicy: false }));

// Enhanced CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép các yêu cầu không có origin (như mobile apps hoặc curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(morgan("short"));

// ─── Health Check ───
app.get("/health", (_req, res) => res.json({ success: true, data: { service: "gateway", status: "ok" } }));

// ─── MediaMTX Auth Webhooks — TRƯỚC rate limiter ───
// MediaMTX gọi liên tục cho mỗi kết nối RTSP/HLS/WebRTC.
// Nếu để sau rate limiter, IP của MediaMTX sẽ bị 429 → toàn bộ stream sập.
app.post(
  "/api/livestream/auth/publish",
  express.json({ limit: "1mb" }),
  (req, res, next) => { req.url = "/auth/publish"; livestreamRoutes(req, res, next); }
);
app.post(
  "/api/livestream/auth/unpublish",
  express.json({ limit: "1mb" }),
  (req, res, next) => { req.url = "/auth/unpublish"; livestreamRoutes(req, res, next); }
);

// Rate limiting (chỉ cho user-facing routes — auth webhooks đã được xử lý phía trên)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true });
app.use(limiter);

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
    proxyRes: (proxyRes, req) => {

    delete proxyRes.headers["access-control-allow-origin"];
    delete proxyRes.headers["access-control-allow-credentials"];
    delete proxyRes.headers["access-control-allow-methods"];
    delete proxyRes.headers["access-control-allow-headers"];
    delete proxyRes.headers["access-control-expose-headers"];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        proxyRes.headers["access-control-allow-origin"] = origin;
        proxyRes.headers["access-control-allow-credentials"] = "true";
        proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        proxyRes.headers["access-control-allow-headers"] = "Content-Type, Authorization";
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
    proxyRes: (proxyRes, req) => {
      delete proxyRes.headers["access-control-allow-origin"];
      delete proxyRes.headers["access-control-allow-credentials"];
      delete proxyRes.headers["access-control-allow-methods"];
      delete proxyRes.headers["access-control-allow-headers"];
      delete proxyRes.headers["access-control-expose-headers"];
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        proxyRes.headers["access-control-allow-origin"] = origin;
        proxyRes.headers["access-control-allow-credentials"] = "true";
      }
    },
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
app.use("/api/sse", sseRouter); // auth handled inside route (supports ?token= for EventSource)

// ─── 404 ───
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// ─── Socket.io ───
initSocket(server);

// ─── Start ───
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`));

module.exports = { app, server };
