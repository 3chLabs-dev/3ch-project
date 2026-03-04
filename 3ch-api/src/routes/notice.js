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
        `SELECT id, title, LEFT(content, 80) AS content_preview, created_at
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

module.exports = router;
