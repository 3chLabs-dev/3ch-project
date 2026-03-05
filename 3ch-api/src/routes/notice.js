const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

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

// GET /api/faqs - 공개 FAQ 목록
router.get("/faqs", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, question, answer, display_order
       FROM faqs
       WHERE is_published = true
       ORDER BY display_order ASC, id ASC`,
    );
    res.json({ faqs: r.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

module.exports = router;
