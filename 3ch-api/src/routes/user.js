const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

// GET /user/me/preferences
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

// PUT /user/me/preferences
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

// GET /user/me/home-summary?group_id=xxx
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
             lp.division, lp.name AS participant_name
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      WHERE lp.member_id = $1
        AND l.status = 'active'
        AND l.deleted_at IS NULL
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
        AND l.deleted_at IS NULL
        AND m.status != 'done'
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.start_date ASC, m.match_order ASC
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
        AND l.deleted_at IS NULL
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

module.exports = router;
