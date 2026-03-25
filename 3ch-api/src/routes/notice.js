const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

/**
 * @openapi
 * tags:
 *   name: 공지사항
 *   description: 공지사항, FAQ, 이용방법 조회 API
 */

/**
 * @openapi
 * /notices:
 *   get:
 *     summary: 공지사항 목록 조회
 *     description: 게시된 공지사항 목록을 페이지네이션으로 반환합니다.
 *     tags: [공지사항]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호 (1부터 시작)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 공지사항 목록 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       category:
 *                         type: string
 *                       title:
 *                         type: string
 *                       content_preview:
 *                         type: string
 *                         description: 내용 앞 80자 미리보기
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: 전체 공지사항 수
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/notices", async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
    50,
    Math.max(1, parseInt(req.query.limit || "20", 10)),
    );
    const offset = (page - 1) * limit;
    try {
        const [rows, cnt] = await Promise.all([
        pool.query(
        `SELECT id, category, title, LEFT(content, 80) AS content_preview, created_at
        FROM notices
        WHERE is_published = true
        ORDER BY id DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
        ),
        pool.query(
        "SELECT COUNT(*)::int AS total FROM notices WHERE is_published = true"
        ),
        ]);
        res.json({ notices: rows.rows, total: cnt.rows[0].total, page, limit });
    } catch (e) {
        res.status(500).json({ message: String(e.message) });
    }
});

/**
 * @openapi
 * /notices/{id}:
 *   get:
 *     summary: 공지사항 상세 조회
 *     description: 특정 공지사항의 전체 내용을 반환합니다.
 *     tags: [공지사항]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 공지사항 ID
 *     responses:
 *       200:
 *         description: 공지사항 상세 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 is_published:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 잘못된 ID 형식
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 공지사항을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/notices/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

  try {
    const r = await pool.query(
      `SELECT id, title, content, is_published, created_at, updated_at
       FROM notices
       WHERE id = $1 AND is_published = true`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "not found" });

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e?.message ?? e) });
  }
});

/**
 * @openapi
 * /faqs:
 *   get:
 *     summary: FAQ 목록 조회
 *     description: 게시된 FAQ 전체 목록을 표시 순서대로 반환합니다.
 *     tags: [공지사항]
 *     responses:
 *       200:
 *         description: FAQ 목록 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faqs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       tab:
 *                         type: string
 *                         description: FAQ 탭 구분
 *                       section:
 *                         type: string
 *                         description: FAQ 섹션 구분
 *                       question:
 *                         type: string
 *                       answer:
 *                         type: string
 *                       display_order:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
// GET /api/faqs - 공개 FAQ 목록
router.get("/faqs", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, tab, section, question, answer, display_order
       FROM faqs
       WHERE is_published = true
       ORDER BY display_order ASC, id ASC`,
    );
    res.json({ faqs: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/**
 * @openapi
 * /guides:
 *   get:
 *     summary: 이용방법 목록 조회
 *     description: 게시된 이용방법 목록을 표시 순서대로 반환합니다. tab 파라미터로 필터링할 수 있습니다.
 *     tags: [공지사항]
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema:
 *           type: string
 *           enum: [leader, member]
 *         description: 탭 필터 (leader 또는 member). 생략 시 전체 반환
 *     responses:
 *       200:
 *         description: 이용방법 목록 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guides:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       tab:
 *                         type: string
 *                         description: 대상 탭 (leader / member)
 *                       section:
 *                         type: string
 *                         description: 섹션 구분
 *                       content:
 *                         type: string
 *                       display_order:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
// GET /api/guides?tab=leader|member - 공개 이용방법 목록
router.get("/guides", async (req, res) => {
  const { tab } = req.query;
  try {
    const r = await pool.query(
      `SELECT id, tab, section, content, display_order
       FROM guides
       ${tab ? "WHERE tab = $1" : ""}
       ORDER BY display_order ASC, id ASC`,
      tab ? [tab] : [],
    );
    res.json({ guides: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

module.exports = router;
