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

// ─── Middleware (non-body-consuming) ───
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ["http://localhost:3001", "http://localhost:3000"], credentials: true }));
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
app.get("/api/livestream/active", optionalAuth, (req, res, next) => {
  req.url = "/active";
  livestreamRoutes(req, res, next);
});
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
