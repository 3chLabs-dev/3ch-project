const express = require("express");
const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: 서비스 생존 확인
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/health", (req, res) => res.json({ ok: true }));

module.exports = router;
