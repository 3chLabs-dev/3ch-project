const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: 테스트
 *   description: 테스트 및 헬스체크 API
 */

/**
 * @openapi
 * /test:
 *   get:
 *     summary: Test API 확인
 *     tags: [테스트]
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/test", (req, res) => {
  res.status(200).send("테스트 API 경로 입니다.");
});

/**
 * @openapi
 * /db-test:
 *   get:
 *     summary: 데이터베이스 연결 테스트
 *     description: PostgreSQL 데이터베이스 연결 상태를 확인합니다.
 *     tags: [테스트]
 *     responses:
 *       200:
 *         description: 데이터베이스 연결 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 now:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: 데이터베이스 연결 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
router.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("select now() as now");
    res.status(200).json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

module.exports = router;
