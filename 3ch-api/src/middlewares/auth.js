const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ ok: false, error: "NO_TOKEN" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub: userId, email }
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
  }
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

module.exports = { requireAuth, requireAdmin };
