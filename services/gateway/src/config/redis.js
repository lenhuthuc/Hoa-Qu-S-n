const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://:redis123@localhost:6379";
const redis = new Redis(redisUrl);
const redisSub = new Redis(redisUrl);
const redisPub = new Redis(redisUrl);

redis.on("error", (err) => console.error("[Redis] Connection error:", err.message));
redis.on("connect", () => console.log("[Redis] Connected"));

module.exports = { redis, redisSub, redisPub };
