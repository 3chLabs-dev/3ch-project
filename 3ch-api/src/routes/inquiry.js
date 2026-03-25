const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * @openapi
 * tags:
 *   name: 문의
 *   description: 1:1 문의 접수 및 조회 API
 */

// 업로드 디렉토리 보장
const uploadDir = path.join(__dirname, "../../uploads/inquiries");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// 테이블이 없으면 자동 생성 + 컬럼 추가
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category       VARCHAR(50) NOT NULL DEFAULT '기타',
      title          VARCHAR(200) NOT NULL,
      content        TEXT NOT NULL,
      contact_email  VARCHAR(200),
      phone          VARCHAR(30),
      attachment_path VARCHAR(500),
      status         VARCHAR(20) NOT NULL DEFAULT 'pending',
      reply          TEXT,
      replied_at     TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // 기존 테이블에 컬럼이 없는 경우 추가
  await pool.query(`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS category       VARCHAR(50)  NOT NULL DEFAULT '기타'`);
  await pool.query(`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS contact_email  VARCHAR(200)`);
  await pool.query(`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS phone          VARCHAR(30)`);
  await pool.query(`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500)`);
}
ensureTable().catch(console.error);

/**
 * @openapi
 * /inquiries:
 *   post:
 *     summary: 문의 작성
 *     description: 로그인한 사용자가 1:1 문의를 접수합니다. 첨부 파일(최대 10MB)을 함께 전송할 수 있습니다.
 *     tags: [문의]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               category:
 *                 type: string
 *                 description: 문의 유형 (기본값 '기타')
 *                 example: 서비스 이용
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 description: 문의 제목
 *               content:
 *                 type: string
 *                 description: 문의 내용
 *               contact_email:
 *                 type: string
 *                 format: email
 *                 description: 회신 받을 이메일 (선택)
 *               phone:
 *                 type: string
 *                 description: 연락처 (선택)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 첨부 파일 (선택, 최대 10MB)
 *     responses:
 *       201:
 *         description: 문의 접수 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 category:
 *                   type: string
 *                 title:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: pending
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 필수 항목 누락 (제목 또는 내용)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 인증 필요
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
// POST /api/inquiries - 문의 작성
router.post("/inquiries", requireAuth, upload.single("file"), async (req, res) => {
  const { category, title, content, contact_email, phone } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }
  const attachmentPath = req.file
    ? `/uploads/inquiries/${req.file.filename}`
    : null;
  try {
    const r = await pool.query(
      `INSERT INTO inquiries (user_id, category, title, content, contact_email, phone, attachment_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, category, title, status, created_at`,
      [
        req.user.sub,
        category?.trim() || "기타",
        title.trim(),
        content.trim(),
        contact_email?.trim() || null,
        phone?.trim() || null,
        attachmentPath,
      ],
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/**
 * @openapi
 * /inquiries/my:
 *   get:
 *     summary: 내 문의 목록 조회
 *     description: 로그인한 사용자 본인이 접수한 문의 목록을 최신순으로 반환합니다.
 *     tags: [문의]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 문의 목록 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inquiries:
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
 *                       status:
 *                         type: string
 *                         description: 처리 상태 (pending / answered 등)
 *                         example: pending
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       replied_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *       401:
 *         description: 인증 필요
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
// GET /api/inquiries/my - 내 문의 목록
router.get("/inquiries/my", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, category, title, status, created_at, replied_at
       FROM inquiries
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.user.sub],
    );
    res.json({ inquiries: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

/**
 * @openapi
 * /inquiries/my/{id}:
 *   get:
 *     summary: 내 문의 상세 조회
 *     description: 로그인한 사용자 본인이 접수한 특정 문의의 상세 내용과 답변을 반환합니다.
 *     tags: [문의]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 문의 ID
 *     responses:
 *       200:
 *         description: 문의 상세 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 category:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 contact_email:
 *                   type: string
 *                   format: email
 *                   nullable: true
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                 attachment_path:
 *                   type: string
 *                   nullable: true
 *                   description: 첨부 파일 경로 (/uploads/inquiries/...)
 *                 status:
 *                   type: string
 *                   example: pending
 *                 reply:
 *                   type: string
 *                   nullable: true
 *                   description: 관리자 답변 내용
 *                 replied_at:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 created_at:
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
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 문의를 찾을 수 없거나 접근 권한 없음
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
// GET /api/inquiries/my/:id - 내 문의 상세
router.get("/inquiries/my/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
  try {
    const r = await pool.query(
      `SELECT id, category, title, content, contact_email, phone, attachment_path, status, reply, replied_at, created_at
       FROM inquiries
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.sub],
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

module.exports = router;
