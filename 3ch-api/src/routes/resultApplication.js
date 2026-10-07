const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middlewares/auth");
const { parseApplication, formatAnswers } = require("../utils/resultApplication");
const router = express.Router();

// Separate application records: these routes never write league or ranking data.
let ready;
async function ensureTable(_req, _res, next) {
  try {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS result_applications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title VARCHAR(200) NOT NULL,
      answers JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
      reply TEXT,
      replied_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await ready;
    next();
  } catch (error) { ready = undefined; next(error); }
}
const detail = (row) => ({ ...row, content: formatAnswers(row.answers) });
const validId = (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))
    return res.status(400).json({ message: "잘못된 신청 번호입니다." });
  next();
};

router.post("/result-applications", requireAuth, ensureTable, async (req, res, next) => {
  let answers;
  try { answers = parseApplication(req.body); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  try {
    const title = `${answers.club_name || '클럽 생성 요청'} · 결과 등록 신청`;
    const result = await pool.query(
      `INSERT INTO result_applications (user_id, title, answers) VALUES ($1, $2, $3) RETURNING id, title, status, created_at`,
      [req.user.sub, title, JSON.stringify(answers)],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});
router.get("/result-applications/my", requireAuth, ensureTable, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, title, status, created_at, replied_at FROM result_applications WHERE user_id = $1 ORDER BY id DESC`, [req.user.sub]);
    res.json({ applications: result.rows });
  } catch (error) { next(error); }
});
router.get("/result-applications/my/:id", requireAuth, validId, ensureTable, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM result_applications WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.sub]);
    if (!result.rowCount) return res.status(404).json({ message: "신청을 찾을 수 없습니다." });
    res.json(detail(result.rows[0]));
  } catch (error) { next(error); }
});
router.get("/admin/board/result-applications", requireAdmin, ensureTable, async (req, res, next) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
  try {
    const [items, count] = await Promise.all([
      pool.query(`SELECT a.id, a.title, a.status, a.created_at, a.replied_at, a.answers->>'club_name' AS category, u.name AS user_name, u.email AS user_email
        FROM result_applications a JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]),
      pool.query(`SELECT COUNT(*)::int AS total FROM result_applications`),
    ]);
    res.json({ applications: items.rows, total: count.rows[0].total, page, limit });
  } catch (error) { next(error); }
});
router.get("/admin/board/result-applications/:id", requireAdmin, validId, ensureTable, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT a.*, u.name AS user_name, u.email AS user_email FROM result_applications a JOIN users u ON u.id = a.user_id WHERE a.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: "신청을 찾을 수 없습니다." });
    res.json(detail(result.rows[0]));
  } catch (error) { next(error); }
});
router.patch("/admin/board/result-applications/:id/reply", requireAdmin, validId, ensureTable, async (req, res, next) => {
  const reply = req.body?.reply;
  if (typeof reply !== "string" || !reply.trim() || reply.length > 10000)
    return res.status(400).json({ message: "답변을 1~10,000자 이내로 입력하세요." });
  try {
    const result = await pool.query(`UPDATE result_applications SET reply = $2, status = 'answered', replied_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, status, reply, replied_at`, [req.params.id, reply.trim()]);
    if (!result.rowCount) return res.status(404).json({ message: "신청을 찾을 수 없습니다." });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});
module.exports = router;
