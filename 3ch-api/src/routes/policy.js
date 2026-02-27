const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

const VALID_TYPES = ["terms", "privacy"];

/**
 * @swagger
 * tags:
 *   name: 약관
 *   description: 이용약관 / 개인정보처리방침 버전 API
 */

/**
 * @swagger
 * /policies/{type}/versions:
 *   get:
 *     summary: 약관 버전 목록 조회 (본문 제외)
 *     tags: [약관]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *         description: terms = 이용약관, privacy = 개인정보처리방침
 *     responses:
 *       200:
 *         description: 버전 목록 (id, label, effective_date, is_current)
 *       400:
 *         description: 잘못된 타입
 */
router.get("/policies/:type/versions", async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: "잘못된 타입입니다." });
  }
  try {
    const result = await pool.query(
      `SELECT id, label, effective_date, is_current
       FROM policy_versions
       WHERE type = $1
       ORDER BY id DESC`,
      [type],
    );
    res.json({ versions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

/**
 * @swagger
 * /policies/{type}/current:
 *   get:
 *     summary: 현행 약관 조회 (본문 포함)
 *     tags: [약관]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *         description: terms = 이용약관, privacy = 개인정보처리방침
 *     responses:
 *       200:
 *         description: 현행 버전 상세 (id, label, effective_date, body, is_current)
 *       400:
 *         description: 잘못된 타입
 *       404:
 *         description: 현행 버전 없음
 */
router.get("/policies/:type/current", async (req, res) => {
  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: "잘못된 타입입니다." });
  }
  try {
    const result = await pool.query(
      `SELECT id, label, effective_date, body, is_current
       FROM policy_versions
       WHERE type = $1 AND is_current = true
       ORDER BY id DESC
       LIMIT 1`,
      [type],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "현행 버전이 없습니다." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

/**
 * @swagger
 * /policies/{type}/versions/{id}:
 *   get:
 *     summary: 약관 특정 버전 상세 조회 (본문 포함)
 *     tags: [약관]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [terms, privacy]
 *         description: terms = 이용약관, privacy = 개인정보처리방침
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 버전 ID
 *     responses:
 *       200:
 *         description: 버전 상세 (id, label, effective_date, body, is_current)
 *       400:
 *         description: 잘못된 타입
 *       404:
 *         description: 버전 없음
 */
router.get("/policies/:type/versions/:id", async (req, res) => {
  const { type, id } = req.params;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: "잘못된 타입입니다." });
  }
  try {
    const result = await pool.query(
      `SELECT id, label, effective_date, body, is_current
       FROM policy_versions
       WHERE type = $1 AND id = $2`,
      [type, id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "버전을 찾을 수 없습니다." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
