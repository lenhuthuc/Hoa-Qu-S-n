const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { redis, redisPub } = require("../config/redis");

const router = express.Router();
const MEDIAMTX_API = process.env.MEDIAMTX_API || "http://localhost:9997";
const SPRING_URL = process.env.SPRING_URL || "http://localhost:8080";

// POST /api/livestream/start — Seller starts a livestream
router.post("/start", async (req, res) => {
  try {
    const { title } = req.body;
    const sellerId = req.user.id;

    // Validate title
    const safeTitle = (title || "Livestream").slice(0, 200).trim();

    const streamKey = `live-${sellerId}-${uuidv4().slice(0, 8)}`;

    // Create path in MediaMTX via HTTP API
    await axios.post(`${MEDIAMTX_API}/v3/config/paths/add/${streamKey}`, {
      source: "publisher",
    }).catch(() => {
      // Path may already exist or auto-created — not fatal
    });

    // Store session in Redis (TTL 8 hours)
    const session = {
      streamKey,
      sellerId,
      title: safeTitle,
      status: "CREATED",
      createdAt: new Date().toISOString(),
    };
    await redis.setex(`livestream:${streamKey}`, 28800, JSON.stringify(session));

    res.json({
      success: true,
      data: {
        streamKey,
        rtmpUrl: `rtmp://localhost:1935/${streamKey}`,
        webrtcUrl: `http://localhost:8889/${streamKey}`,
        hlsUrl: `http://localhost:8888/${streamKey}/index.m3u8`,
        viewerUrl: `/live/${streamKey}`,
      },
    });
  } catch (err) {
    console.error("[Livestream] Start error:", err.message);
    res.status(500).json({ success: false, error: "Failed to start livestream" });
  }
});

// GET /api/livestream/active — List all active streams
router.get("/active", async (_req, res) => {
  try {
    const keys = await redis.keys("livestream:*");
    const sessions = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) sessions.push(JSON.parse(data));
    }
    res.json({
      success: true,
      data: sessions.filter((s) => s.status !== "ENDED"),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/livestream/stop — Seller stops their stream
router.post("/stop", async (req, res) => {
  try {
    const { streamKey } = req.body;
    const session = await redis.get(`livestream:${streamKey}`);
    if (!session) return res.status(404).json({ success: false, error: "Stream not found" });

    const parsed = JSON.parse(session);
    if (parsed.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not your stream" });
    }

    parsed.status = "ENDED";
    parsed.endedAt = new Date().toISOString();
    await redis.setex(`livestream:${streamKey}`, 3600, JSON.stringify(parsed));

    // Remove path from MediaMTX
    await axios.delete(`${MEDIAMTX_API}/v3/config/paths/delete/${streamKey}`).catch(() => {});

    res.json({ success: true, data: { message: "Stream ended" } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/livestream/:streamKey/order — Quick add to cart/order during stream
router.post("/:streamKey/order", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { streamKey } = req.params;
    const buyerId = req.user.id;
    const buyerName = req.user.email;

    if (!productId || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
      return res.status(400).json({ success: false, error: "Invalid productId" });
    }
    if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || Number(quantity) > 99) {
      return res.status(400).json({ success: false, error: "Invalid quantity (1-99)" });
    }

    // Call Internal Spring Order API
    await axios.post(`${SPRING_URL}/api/internal/orders/live`, {
      buyerId,
      productId,
      quantity,
      streamKey
    });

    // Notify chat & stream overlay via Redis Pub/Sub
    const payload = {
      roomId: streamKey,
      buyerId,
      buyerName,
      productId,
      quantity,
      timestamp: new Date().toISOString(),
    };
    if (redisPub) {
      redisPub.publish("live:order", JSON.stringify(payload));
    }

    res.json({ success: true, data: { message: "Order processed successfully" } });
  } catch (err) {
    console.error("[Livestream] Live Order Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
