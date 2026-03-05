const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
