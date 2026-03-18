const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "NO_TOKEN" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [Number(payload.sub)],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: "USER_NOT_FOUND" });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }

  req.user = payload; // { sub: userId, email }
  return next();
}

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "NO_TOKEN" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch (e) {
    return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
  }

  try {
    const result = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [Number(req.user.sub)],
    );
    if (result.rowCount === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}

// 토큰이 있으면 req.user 세팅, 없어도 통과 (공개 조회용)
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type === "Bearer" && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    } catch { /* 토큰 만료/오류 시 무시 */ }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
