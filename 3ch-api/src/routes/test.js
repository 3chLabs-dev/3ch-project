const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

/**
 * @openapi
 * /test:
 *   get:
 *     summary: Test API 확인
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/test", (req, res) => {
  res.status(200).send("테스트 API 경로 입니다.");
});

router.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("select now() as now");
    res.status(200).json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

module.exports = router;
