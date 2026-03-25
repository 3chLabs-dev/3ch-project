const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAdmin } = require("../middlewares/auth");

// 모든 라우트에 어드민 인증 적용
router.use(requireAdmin);

/* ─────────────────────────────────────────
   공지사항
───────────────────────────────────────── */

/**
 * @openapi
 * /api/admin/board/notices:
 *   get:
 *     summary: 공지사항 목록 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: 공지사항 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notices: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/notices/{id}:
 *   get:
 *     summary: 공지사항 상세 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 공지사항 상세
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/notices:
 *   post:
 *     summary: 공지사항 생성 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               category: { type: string, default: 안내 }
 *               is_published: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: 생성된 공지사항
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/notices/{id}:
 *   put:
 *     summary: 공지사항 수정 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               category: { type: string, default: 안내 }
 *               is_published: { type: boolean }
 *     responses:
 *       200:
 *         description: 수정된 공지사항
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/notices/{id}:
 *   delete:
 *     summary: 공지사항 삭제 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/faqs:
 *   get:
 *     summary: FAQ 목록 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FAQ 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faqs: { type: array, items: { type: object } }
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/faqs/{id}:
 *   get:
 *     summary: FAQ 상세 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: FAQ 상세
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/faqs:
 *   post:
 *     summary: FAQ 생성 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, answer]
 *             properties:
 *               question: { type: string }
 *               answer: { type: string }
 *               tab: { type: string, default: member }
 *               section: { type: string, default: "" }
 *               display_order: { type: integer, default: 0 }
 *               is_published: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: 생성된 FAQ
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/faqs/{id}:
 *   put:
 *     summary: FAQ 수정 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, answer]
 *             properties:
 *               question: { type: string }
 *               answer: { type: string }
 *               tab: { type: string }
 *               section: { type: string }
 *               display_order: { type: integer }
 *               is_published: { type: boolean }
 *     responses:
 *       200:
 *         description: 수정된 FAQ
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/faqs/{id}:
 *   delete:
 *     summary: FAQ 삭제 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}:
 *   get:
 *     summary: 약관 버전 목록 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *         description: 약관 유형
 *     responses:
 *       200:
 *         description: 약관 버전 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versions: { type: array, items: { type: object } }
 *       400:
 *         description: 잘못된 타입
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}/{id}:
 *   get:
 *     summary: 약관 버전 상세 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 약관 버전 상세
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 잘못된 타입
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}:
 *   post:
 *     summary: 약관 신규 버전 생성 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, effective_date, body]
 *             properties:
 *               label: { type: string, description: 버전 레이블 }
 *               effective_date: { type: string, description: 시행일 (YYYY-MM-DD) }
 *               body: { type: string, description: 약관 본문 }
 *               set_current: { type: boolean, default: false, description: 현행 버전으로 설정 여부 }
 *     responses:
 *       201:
 *         description: 생성된 약관 버전
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 잘못된 타입 또는 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}/{id}:
 *   put:
 *     summary: 약관 버전 내용 수정 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, effective_date, body]
 *             properties:
 *               label: { type: string }
 *               effective_date: { type: string }
 *               body: { type: string }
 *     responses:
 *       200:
 *         description: 수정된 약관 버전
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 잘못된 타입 또는 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}/{id}/set-current:
 *   patch:
 *     summary: 약관 현행 버전으로 설정 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 현행으로 설정된 약관 버전
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 잘못된 타입
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/policies/{type}/{id}:
 *   delete:
 *     summary: 약관 버전 삭제 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: 잘못된 타입 또는 현행 버전 삭제 시도
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/inquiries:
 *   get:
 *     summary: 문의사항 목록 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, answered]
 *         description: 상태 필터 (생략 시 전체)
 *     responses:
 *       200:
 *         description: 문의사항 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inquiries: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/inquiries/{id}:
 *   get:
 *     summary: 문의사항 상세 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 문의사항 상세 (작성자 정보 포함)
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/inquiries/{id}/reply:
 *   patch:
 *     summary: 문의사항 답변 등록 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reply]
 *             properties:
 *               reply: { type: string, description: 답변 내용 }
 *     responses:
 *       200:
 *         description: 답변이 등록된 문의사항 (status가 answered로 변경됨)
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 답변 내용 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/guide:
 *   get:
 *     summary: 이용방법 목록 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: 이용방법 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guides: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/guide/{id}:
 *   get:
 *     summary: 이용방법 상세 조회 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 이용방법 상세
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/guide:
 *   post:
 *     summary: 이용방법 생성 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tab, section, content]
 *             properties:
 *               tab: { type: string, description: 탭 구분 }
 *               section: { type: string, description: 섹션 구분 }
 *               content: { type: string, description: 내용 }
 *               display_order: { type: integer, default: 0 }
 *     responses:
 *       201:
 *         description: 생성된 이용방법
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/guide/{id}:
 *   put:
 *     summary: 이용방법 수정 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tab, section, content]
 *             properties:
 *               tab: { type: string }
 *               section: { type: string }
 *               content: { type: string }
 *               display_order: { type: integer }
 *     responses:
 *       200:
 *         description: 수정된 이용방법
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 없음
 *       500:
 *         description: 서버 오류
 */
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

/**
 * @openapi
 * /api/admin/board/guide/{id}:
 *   delete:
 *     summary: 이용방법 삭제 (관리자)
 *     tags: [관리자]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
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
