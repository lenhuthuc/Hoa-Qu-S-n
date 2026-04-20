const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "hoaquason_jwt_secret_key_2026_stable!";

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or invalid token" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.sub,
      roles: decoded.roles || [],
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Token expired or invalid" });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.sub, roles: decoded.roles || [] };
    } catch {
      // token invalid — continue without user
    }
  }
  next();
}

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
