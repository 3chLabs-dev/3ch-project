const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAdmin } = require("../middlewares/auth");

// 모든 라우트에 어드민 인증 적용
router.use(requireAdmin);

/* ─────────────────────────────────────────
   공지사항
───────────────────────────────────────── */

// GET /admin/board/notices
router.get("/notices", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const offset = (page - 1) * limit;
  try {
    const [rows, cnt] = await Promise.all([
      pool.query(
        `SELECT id, category, title, LEFT(content, 80) AS content_preview, is_published, created_at, updated_at
         FROM notices ORDER BY id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query("SELECT COUNT(*)::int AS total FROM notices"),
    ]);
    res.json({ notices: rows.rows, total: cnt.rows[0].total, page, limit });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// GET /admin/board/notices/:id
router.get("/notices/:id", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM notices WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// POST /admin/board/notices
router.post("/notices", async (req, res) => {
  const { title, content, category = "안내", is_published = true } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `INSERT INTO notices (category, title, content, is_published)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [category, title.trim(), content.trim(), is_published],
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// PUT /admin/board/notices/:id
router.put("/notices/:id", async (req, res) => {
  const { title, content, category = "안내", is_published } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `UPDATE notices SET category=$1, title=$2, content=$3, is_published=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [category, title.trim(), content.trim(), is_published ?? true, req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// DELETE /admin/board/notices/:id
router.delete("/notices/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM notices WHERE id=$1 RETURNING id", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json({ message: "삭제되었습니다." });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/* ─────────────────────────────────────────
   FAQ
───────────────────────────────────────── */

// GET /admin/board/faqs
router.get("/faqs", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, tab, section, question, LEFT(answer, 80) AS answer_preview, display_order, is_published, created_at
       FROM faqs ORDER BY tab ASC, section ASC, display_order ASC, id ASC`,
    );
    res.json({ faqs: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// GET /admin/board/faqs/:id
router.get("/faqs/:id", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM faqs WHERE id=$1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// POST /admin/board/faqs
router.post("/faqs", async (req, res) => {
  const { question, answer, tab = "member", section = "", display_order = 0, is_published = true } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "질문과 답변을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `INSERT INTO faqs (tab, section, question, answer, display_order, is_published)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tab, section.trim(), question.trim(), answer.trim(), display_order, is_published],
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// PUT /admin/board/faqs/:id
router.put("/faqs/:id", async (req, res) => {
  const { question, answer, tab, section, display_order, is_published } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "질문과 답변을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `UPDATE faqs SET tab=$1, section=$2, question=$3, answer=$4, display_order=$5, is_published=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [tab ?? "member", (section ?? "").trim(), question.trim(), answer.trim(), display_order ?? 0, is_published ?? true, req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// DELETE /admin/board/faqs/:id
router.delete("/faqs/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM faqs WHERE id=$1 RETURNING id", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json({ message: "삭제되었습니다." });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/* ─────────────────────────────────────────
   약관 (이용약관 / 개인정보처리방침) - 어드민 전용
───────────────────────────────────────── */

const VALID_TYPES = ["terms", "privacy"];

// GET /admin/board/policies/:type
router.get("/policies/:type", async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  try {
    const r = await pool.query(
      `SELECT id, label, effective_date, LEFT(body, 100) AS body_preview, is_current, created_at
       FROM policy_versions WHERE type=$1 ORDER BY id DESC`,
      [type],
    );
    res.json({ versions: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// GET /admin/board/policies/:type/:id
router.get("/policies/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  try {
    const r = await pool.query(
      "SELECT * FROM policy_versions WHERE type=$1 AND id=$2",
      [type, id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// POST /admin/board/policies/:type  (신규 버전 추가)
router.post("/policies/:type", async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  const { label, effective_date, body, set_current = false } = req.body;
  if (!label?.trim() || !effective_date?.trim() || !body?.trim()) {
    return res.status(400).json({ message: "label, effective_date, body를 입력하세요." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (set_current) {
      await client.query(
        "UPDATE policy_versions SET is_current=false WHERE type=$1",
        [type],
      );
    }
    const r = await client.query(
      `INSERT INTO policy_versions (type, label, effective_date, body, is_current)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [type, label.trim(), effective_date.trim(), body.trim(), set_current],
    );
    await client.query("COMMIT");
    res.status(201).json(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(e.message) });
  } finally {
    client.release();
  }
});

// PUT /admin/board/policies/:type/:id  (내용 수정)
router.put("/policies/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  const { label, effective_date, body } = req.body;
  if (!label?.trim() || !effective_date?.trim() || !body?.trim()) {
    return res.status(400).json({ message: "label, effective_date, body를 입력하세요." });
  }
  try {
    const r = await pool.query(
      `UPDATE policy_versions SET label=$1, effective_date=$2, body=$3
       WHERE type=$4 AND id=$5 RETURNING *`,
      [label.trim(), effective_date.trim(), body.trim(), type, id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// PATCH /admin/board/policies/:type/:id/set-current  (현행으로 설정)
router.patch("/policies/:type/:id/set-current", async (req, res) => {
  const { type, id } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE policy_versions SET is_current=false WHERE type=$1", [type]);
    const r = await client.query(
      "UPDATE policy_versions SET is_current=true WHERE type=$1 AND id=$2 RETURNING *",
      [type, id],
    );
    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "없음" });
    }
    await client.query("COMMIT");
    res.json(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(e.message) });
  } finally {
    client.release();
  }
});

// DELETE /admin/board/policies/:type/:id
router.delete("/policies/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ message: "잘못된 타입" });
  try {
    const r = await pool.query(
      "DELETE FROM policy_versions WHERE type=$1 AND id=$2 RETURNING id, is_current",
      [type, id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    if (r.rows[0].is_current) {
      return res.status(400).json({ message: "현행 버전은 삭제할 수 없습니다." });
    }
    res.json({ message: "삭제되었습니다." });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/* ─────────────────────────────────────────
   문의사항 (어드민)
───────────────────────────────────────── */

// GET /admin/board/inquiries
router.get("/inquiries", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const offset = (page - 1) * limit;
  const status = req.query.status; // 'pending' | 'answered' | undefined
  try {
    const where = status ? "WHERE i.status = $3" : "";
    const params = status ? [limit, offset, status] : [limit, offset];
    const [rows, cnt] = await Promise.all([
      pool.query(
        `SELECT i.id, i.category, i.title, i.status, i.created_at, i.replied_at,
                u.name AS user_name, u.email AS user_email
         FROM inquiries i
         JOIN users u ON u.id = i.user_id
         ${where}
         ORDER BY i.id DESC LIMIT $1 OFFSET $2`,
        params,
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM inquiries ${where}`,
        status ? [status] : [],
      ),
    ]);
    res.json({ inquiries: rows.rows, total: cnt.rows[0].total, page, limit });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// GET /admin/board/inquiries/:id
router.get("/inquiries/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT i.*, u.name AS user_name, u.email AS user_email
       FROM inquiries i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = $1`,
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// PATCH /admin/board/inquiries/:id/reply - 답변 등록
router.patch("/inquiries/:id/reply", async (req, res) => {
  const { reply } = req.body;
  if (!reply?.trim()) {
    return res.status(400).json({ message: "답변 내용을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `UPDATE inquiries
       SET reply=$1, status='answered', replied_at=NOW(), updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [reply.trim(), req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/* ─────────────────────────────────────────
   이용방법
───────────────────────────────────────── */

// GET /admin/board/guide
router.get("/guide", async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const offset = (page - 1) * limit;
  try {
    const [rows, cnt] = await Promise.all([
      pool.query(
        `SELECT id, tab, section, LEFT(content, 100) AS content_preview, display_order, created_at
         FROM guides ORDER BY tab, display_order, id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query("SELECT COUNT(*)::int AS total FROM guides"),
    ]);
    res.json({ guides: rows.rows, total: cnt.rows[0].total, page, limit });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// GET /admin/board/guide/:id
router.get("/guide/:id", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM guides WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// POST /admin/board/guide
router.post("/guide", async (req, res) => {
  const { tab, section, content, display_order = 0 } = req.body;
  if (!tab?.trim() || !section?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "탭, 섹션, 내용을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `INSERT INTO guides (tab, section, content, display_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [tab.trim(), section.trim(), content.trim(), display_order],
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// PUT /admin/board/guide/:id
router.put("/guide/:id", async (req, res) => {
  const { tab, section, content, display_order } = req.body;
  if (!tab?.trim() || !section?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "탭, 섹션, 내용을 입력하세요." });
  }
  try {
    const r = await pool.query(
      `UPDATE guides SET tab=$1, section=$2, content=$3, display_order=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [tab.trim(), section.trim(), content.trim(), display_order ?? 0, req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "없음" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

// DELETE /admin/board/guide/:id
router.delete("/guide/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM guides WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

module.exports = router;

