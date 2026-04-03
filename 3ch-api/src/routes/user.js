const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: User
 *   description: 사용자 설정 및 홈 화면 요약 API
 */

/**
 * @openapi
 * /user/me/preferences:
 *   get:
 *     summary: 홈 화면 표시 설정 조회
 *     description: 현재 로그인된 사용자의 홈 화면 표시 설정을 반환합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     show_group:
 *                       type: boolean
 *                       description: 나의 조편성 표시 여부
 *                     show_game:
 *                       type: boolean
 *                       description: 나의 경기 표시 여부
 *                     show_win:
 *                       type: boolean
 *                       description: 나의 당첨내역 표시 여부
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       404:
 *         description: 사용자를 찾을 수 없음.
 *       500:
 *         description: 서버 오류.
 */
router.get("/user/me/preferences", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }
  try {
    const result = await pool.query(
      "SELECT preferences FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }
    const prefs = result.rows[0].preferences ?? {};
    return res.json({
      ok: true,
      preferences: {
        show_group: prefs.show_group ?? false,
        show_game: prefs.show_game ?? true,
        show_win: prefs.show_win ?? true,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /user/me/preferences:
 *   put:
 *     summary: 홈 화면 표시 설정 저장
 *     description: 현재 로그인된 사용자의 홈 화면 표시 설정을 저장합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               show_group:
 *                 type: boolean
 *               show_game:
 *                 type: boolean
 *               show_win:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 저장 성공
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       500:
 *         description: 서버 오류.
 */
router.put("/user/me/preferences", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }
  const { show_group, show_game, show_win } = req.body;
  const prefs = {
    show_group: Boolean(show_group),
    show_game: Boolean(show_game),
    show_win: Boolean(show_win),
  };
  try {
    await pool.query(
      "UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL",
      [JSON.stringify(prefs), userId]
    );
    return res.json({ ok: true, preferences: prefs });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /user/me/home-summary:
 *   get:
 *     summary: 홈 화면 요약 데이터 조회
 *     description: 현재 로그인된 사용자의 홈 화면에 표시할 조편성, 경기, 당첨내역 요약을 반환합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: group_id
 *         schema:
 *           type: string
 *         description: 클럽(그룹) ID로 필터링
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 my_groups:
 *                   type: array
 *                   description: 활성 리그에서 나의 조편성 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       league_id:
 *                         type: string
 *                       league_name:
 *                         type: string
 *                       league_code:
 *                         type: string
 *                         nullable: true
 *                       division:
 *                         type: string
 *                         nullable: true
 *                       participant_name:
 *                         type: string
 *                 my_matches:
 *                   type: array
 *                   description: 활성 리그에서 대기/진행 중인 나의 경기 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       league_id:
 *                         type: string
 *                       league_name:
 *                         type: string
 *                       match_id:
 *                         type: string
 *                       match_order:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       my_score:
 *                         type: integer
 *                         nullable: true
 *                       opponent_score:
 *                         type: integer
 *                         nullable: true
 *                       opponent_name:
 *                         type: string
 *                         nullable: true
 *                       my_division:
 *                         type: string
 *                         nullable: true
 *                 my_wins:
 *                   type: array
 *                   description: 나의 추첨 당첨 내역
 *                   items:
 *                     type: object
 *                     properties:
 *                       league_id:
 *                         type: string
 *                       league_name:
 *                         type: string
 *                       draw_name:
 *                         type: string
 *                       prize_name:
 *                         type: string
 *                       participant_name:
 *                         type: string
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       500:
 *         description: 서버 오류.
 */
router.get("/user/me/home-summary", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }
  const groupId = req.query.group_id ?? null;

  try {
    // 1. 나의 조편성: 활성 리그에서 내 배정 부수/조
    const groupsQuery = `
      SELECT l.id AS league_id, l.name AS league_name, l.league_code,
             l.format, lp.division, lp.name AS participant_name
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      WHERE lp.member_id = $1
        AND l.status = 'active'
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.start_date DESC
    `;
    const groupsResult = await pool.query(groupsQuery, groupId ? [userId, groupId] : [userId]);

    // 2. 나의 경기: 활성 리그에서 내 대기/진행 중 경기
    const matchesQuery = `
      SELECT
        l.id AS league_id, l.name AS league_name, l.league_code,
        m.id AS match_id, m.match_order, m.status,
        CASE WHEN m.participant_a_id = lp.id THEN m.score_a ELSE m.score_b END AS my_score,
        CASE WHEN m.participant_a_id = lp.id THEN m.score_b ELSE m.score_a END AS opponent_score,
        CASE WHEN m.participant_a_id = lp.id THEN pb.name ELSE pa.name END AS opponent_name,
        CASE WHEN m.participant_a_id = lp.id THEN pb.division ELSE pa.division END AS opponent_division,
        lp.division AS my_division
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      JOIN league_matches m ON m.league_id = l.id
        AND (m.participant_a_id = lp.id OR m.participant_b_id = lp.id)
      LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
      LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
      WHERE lp.member_id = $1
        AND l.status = 'active'
        AND m.status != 'done'
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.start_date ASC, m.match_order ASC
      LIMIT 10
    `;
    const matchesResult = await pool.query(matchesQuery, groupId ? [userId, groupId] : [userId]);

    // 3. 나의 당첨내역: 참가자 이름으로 draw_winners 매칭
    const winsQuery = `
      SELECT DISTINCT
        l.id AS league_id, l.name AS league_name, l.league_code,
        d.name AS draw_name, d.draw_code,
        dp.prize_name,
        dw.participant_name, dw.participant_division
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      JOIN draws d ON d.league_id = l.id
      JOIN draw_prizes dp ON dp.draw_id = d.id
      JOIN draw_winners dw ON dw.prize_id = dp.id AND dw.participant_name = lp.name
      WHERE lp.member_id = $1
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.name ASC
      LIMIT 20
    `;
    const winsResult = await pool.query(winsQuery, groupId ? [userId, groupId] : [userId]);

    return res.json({
      ok: true,
      my_groups: groupsResult.rows,
      my_matches: matchesResult.rows,
      my_wins: winsResult.rows,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /user/me/push-subscription:
 *   post:
 *     summary: 푸시 알림 구독 등록
 *     description: 사용자의 Web Push 구독 정보를 저장합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, keys]
 *             properties:
 *               endpoint:
 *                 type: string
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *     responses:
 *       200:
 *         description: 등록 성공
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       500:
 *         description: 서버 오류.
 */
router.post("/user/me/push-subscription", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ ok: false, error: "INVALID_SUBSCRIPTION" });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /user/me/push-subscription:
 *   delete:
 *     summary: 푸시 알림 구독 해제
 *     description: 사용자의 Web Push 구독 정보를 삭제합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint]
 *             properties:
 *               endpoint:
 *                 type: string
 *     responses:
 *       200:
 *         description: 해제 성공
 *       401:
 *         description: 인증 토큰이 없거나 유효하지 않음.
 *       500:
 *         description: 서버 오류.
 */
router.delete("/user/me/push-subscription", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ ok: false, error: "MISSING_ENDPOINT" });
  }
  try {
    await pool.query(
      "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
      [userId, endpoint]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
