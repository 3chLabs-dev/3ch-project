const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middlewares/auth");
const { getUserSportRankingSummary, getSportRanking } = require("../services/sportRanking");

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
 *                       group_assignments:
 *                         type: array
 *                         description: 공개된 프로그램에서 배정된 조 이름
 *                         items:
 *                           type: string
 *                       team_assignments:
 *                         type: array
 *                         description: 공개된 프로그램에서 배정된 팀 이름
 *                         items:
 *                           type: string
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
    // 1. 공개된 프로그램 편성에서 나의 조/팀 찾기
    const groupsQuery = `
      SELECT l.id AS league_id, l.name AS league_name, l.league_code,
             l.format, l.start_date AS league_start_date, l.status AS league_status,
             lp.division, lp.name AS participant_name,
             lp.source_group_id, pr.program_data
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      JOIN league_programs pr ON pr.league_id = l.id
      JOIN users me ON me.id = $1
      WHERE (
          lp.member_id = $1
          OR (
            lp.member_id IS NULL
            AND BTRIM(me.name) = BTRIM(lp.name)
          )
        )
        AND lp.status = 'active'
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.start_date DESC
    `;
    const groupsResult = await pool.query(groupsQuery, groupId ? [userId, groupId] : [userId]);

    const leagueIds = groupsResult.rows.map((row) => row.league_id);
    const participantRows = leagueIds.length > 0
      ? await pool.query(
        `SELECT league_id, name, division, source_group_id
         FROM league_participants
         WHERE league_id = ANY($1::text[]) AND status = 'active'`,
        [leagueIds],
      )
      : { rows: [] };
    const participantsByLeague = participantRows.rows.reduce((byLeague, row) => {
      const level = Number.parseInt(row.division ?? '', 10);
      const player = {
        name: row.name,
        level: Number.isNaN(level) ? 999 : level,
        sourceGroupId: row.source_group_id,
      };
      byLeague.set(row.league_id, [...(byLeague.get(row.league_id) ?? []), player]);
      return byLeague;
    }, new Map());

    const rotateBySeed = (items, seed) => {
      if (items.length < 2) return items;
      const offset = seed % items.length || 1;
      const rotated = [...items.slice(offset), ...items.slice(0, offset)];
      return Math.floor(seed / items.length) % 2 === 1 ? rotated.reverse() : rotated;
    };
    const reshuffleWithinLevel = (items, seed) => {
      if (seed == null) return items;
      const buckets = new Map();
      items.forEach((item) => {
        const level = item.level ?? 999;
        buckets.set(level, [...(buckets.get(level) ?? []), item]);
      });
      return [...buckets.keys()].sort((a, b) => a - b)
        .flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
    };
    const distributeSnake = (players, groupSizes) => {
      const groups = groupSizes.map(() => []);
      if (groups.length === 0) return groups;
      for (let offset = 0, reverse = false; offset < players.length; offset += groups.length, reverse = !reverse) {
        const tier = players.slice(offset, offset + groups.length);
        (reverse ? tier.reverse() : tier).forEach((player, index) => {
          if (groups[index]?.length < groupSizes[index]) groups[index].push(player);
        });
      }
      return groups;
    };
    const splitIntoTwoGroups = (count) => count <= 0 ? [] : count <= 2
      ? [count]
      : [Math.ceil(count / 2), Math.floor(count / 2)];

    const containsParticipant = (entry, participant) => {
      if (!entry || typeof entry !== 'object') return false;
      const sameName = String(entry.name ?? '').trim() === String(participant.participant_name ?? '').trim();
      const sourceMatches = !entry.sourceGroupId || !participant.source_group_id ||
        entry.sourceGroupId === participant.source_group_id;
      if (sameName && sourceMatches) return true;
      return Array.isArray(entry.roster) && entry.roster.some((member) => containsParticipant(member, participant));
    };

    const findAssignmentLabels = (assignments, participant, suffix, alphabetic = false) => {
      if (!Array.isArray(assignments)) return [];
      return assignments.flatMap((entries, index) =>
        Array.isArray(entries) && entries.some((entry) => containsParticipant(entry, participant))
          ? [`${alphabetic ? String.fromCharCode(65 + index) : index + 1}${suffix}`]
          : [],
      );
    };

    const generateRoundRobin = (count) => {
      const games = [];
      const size = count % 2 === 0 ? count : count + 1;
      const positions = Array.from({ length: size }, (_, index) => index);
      for (let round = 0; round < size - 1; round += 1) {
        for (let index = 0; index < size / 2; index += 1) {
          const left = positions[index];
          const right = positions[size - 1 - index];
          if (left < count && right < count) games.push([left, right]);
        }
        positions.splice(1, 0, positions.pop());
      }
      return games;
    };

    const fallbackMatches = [];
    const myGroups = groupsResult.rows.flatMap((participant) => {
      const blocks = Array.isArray(participant.program_data?.blocks)
        ? participant.program_data.blocks
        : [];
      const allPlayers = [...(participantsByLeague.get(participant.league_id) ?? [])]
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      const group_assignments = [];
      const team_assignments = [];

      const resolveBlock = (index) => {
        const block = blocks[index];
        if (!block || index === 0 || block.type !== 'TEAM') return block;
        const inherits = participant.program_data?.rounds?.[index]?.inheritPreviousTeamFormation ??
          block.inheritPreviousTeamFormation;
        if (!inherits) return block;
        const previous = resolveBlock(index - 1);
        return previous?.type === 'TEAM' ? {
          ...block,
          groupSizes: previous.groupSizes,
          teamShuffleSeed: previous.teamShuffleSeed,
          teamAssignments: previous.teamAssignments,
        } : block;
      };

      blocks.forEach((rawBlock, index) => {
        const block = resolveBlock(index) ?? rawBlock;
        const defaultSeed = (index + 1) * 1000;
        const teamSizes = block?.groupSizes ?? participant.program_data?.groupSizes ?? [allPlayers.length];
        const teamPlayers = reshuffleWithinLevel(allPlayers, block?.teamShuffleSeed ?? defaultSeed + 101);
        const teams = Array.isArray(block?.teamAssignments) && block.teamAssignments.length > 0
          ? block.teamAssignments
          : distributeSnake(teamPlayers, teamSizes);

        if (block?.groupFormationPublished) {
          let groups = block.groupAssignments;
          if (!Array.isArray(groups) || groups.length === 0) {
            if (block.type === 'TEAM') {
              const teamUnits = teams.map((roster, teamIndex) => ({
                name: `팀 ${roster[0]?.name ?? teamIndex + 1}`,
                level: roster[0]?.level ?? teamIndex + 1,
                roster,
              }));
              const sizes = block.teamGroupSizes ?? splitIntoTwoGroups(teamUnits.length);
              groups = distributeSnake(
                reshuffleWithinLevel(teamUnits, block.groupShuffleSeed ?? defaultSeed + 503),
                sizes,
              );
            } else {
              const sizes = block.groupSizes ?? participant.program_data?.groupSizes ?? [allPlayers.length];
              groups = distributeSnake(
                reshuffleWithinLevel(allPlayers, block.groupShuffleSeed ?? defaultSeed + 503),
                sizes,
              );
            }
          }
          group_assignments.push(...findAssignmentLabels(groups, participant, '조'));

          // 프로그램 경기 동기화 전에도 공개된 단식 조 편성에서 내 대진을 복원한다.
          if (block.type === 'SINGLES') {
            let matchOrder = 0;
            groups.forEach((entries, groupIndex) => {
              generateRoundRobin(entries.length).forEach(([leftIndex, rightIndex], gameIndex) => {
                matchOrder += 1;
                const left = entries[leftIndex];
                const right = entries[rightIndex];
                const mineIsLeft = containsParticipant(left, participant);
                const mineIsRight = containsParticipant(right, participant);
                if (!mineIsLeft && !mineIsRight) return;
                const opponent = mineIsLeft ? right : left;
                fallbackMatches.push({
                  league_id: participant.league_id,
                  league_name: participant.league_name,
                  league_code: participant.league_code,
                  league_start_date: participant.league_start_date,
                  league_status: participant.league_status,
                  match_id: `fallback-${participant.league_id}-r${index + 1}-g${groupIndex + 1}-m${gameIndex + 1}`,
                  match_order: matchOrder,
                  status: 'pending',
                  my_score: null,
                  opponent_score: null,
                  opponent_name: opponent?.name ?? null,
                  opponent_division: opponent?.level && opponent.level !== 999 ? String(opponent.level) : null,
                  my_division: participant.division,
                  program_round: index + 1,
                });
              });
            });
          }
        }
        if (block?.type === 'TEAM' && block?.teamFormationPublished) {
          team_assignments.push(...findAssignmentLabels(teams, participant, '팀', true));
        }
      });

      const uniqueGroups = [...new Set(group_assignments)];
      const uniqueTeams = [...new Set(team_assignments)];
      if (uniqueGroups.length === 0 && uniqueTeams.length === 0) return [];

      const { program_data, source_group_id, ...league } = participant;
      return [{ ...league, group_assignments: uniqueGroups, team_assignments: uniqueTeams }];
    });

    // 2. 나의 경기: 활성 리그에서 내 대기/진행 중 경기
    const matchesQuery = `
      SELECT
        l.id AS league_id, l.name AS league_name, l.league_code,
        l.start_date AS league_start_date, l.status AS league_status,
        m.id AS match_id, m.match_order, m.status, m.program_round,
        CASE WHEN m.participant_a_id = lp.id THEN m.score_a ELSE m.score_b END AS my_score,
        CASE WHEN m.participant_a_id = lp.id THEN m.score_b ELSE m.score_a END AS opponent_score,
        CASE WHEN m.participant_a_id = lp.id THEN pb.name ELSE pa.name END AS opponent_name,
        CASE WHEN m.participant_a_id = lp.id THEN pb.division ELSE pa.division END AS opponent_division,
        lp.division AS my_division
      FROM league_participants lp
      JOIN leagues l ON l.id = lp.league_id
      JOIN users me ON me.id = $1
      JOIN league_matches m ON m.league_id = l.id
        AND (
          m.participant_a_id = lp.id
          OR m.participant_b_id = lp.id
          OR lp.id = ANY(COALESCE(m.participant_a_roster_ids, ARRAY[]::text[]))
          OR lp.id = ANY(COALESCE(m.participant_b_roster_ids, ARRAY[]::text[]))
        )
      LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
      LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
      WHERE (
          lp.member_id = $1
          OR (
            lp.member_id IS NULL
            AND BTRIM(me.name) = BTRIM(lp.name)
          )
        )
        AND lp.status = 'active'
        ${groupId ? "AND l.group_id = $2" : ""}
      ORDER BY l.start_date DESC, m.match_order ASC
    `;
    const matchesResult = await pool.query(matchesQuery, groupId ? [userId, groupId] : [userId]);
    const persistedRoundKeys = new Set(matchesResult.rows.map((match) =>
      `${match.league_id}:${match.program_round ?? 0}`,
    ));
    const myMatches = [
      ...matchesResult.rows,
      ...fallbackMatches.filter((match) =>
        !persistedRoundKeys.has(`${match.league_id}:${match.program_round ?? 0}`),
      ),
    ].sort((left, right) => {
      const dateCompare = String(right.league_start_date ?? '').localeCompare(String(left.league_start_date ?? ''));
      return dateCompare || Number(left.match_order) - Number(right.match_order);
    });

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
      my_groups: myGroups,
      my_matches: myMatches,
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

/**
 * @openapi
 * /user/me/sport-rankings:
 *   get:
 *     summary: 내 종목별 랭킹 요약 조회
 *     description: 로그인한 사용자가 참여 중인 종목별 개인 통합 랭킹 요약을 조회합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 sports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sport:
 *                         type: string
 *                         example: 탁구
 *                       joined_club_count:
 *                         type: integer
 *                       summary:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           total_members:
 *                             type: integer
 *                           my_rank:
 *                             type: integer
 *                             nullable: true
 *                           my_rating:
 *                             type: number
 *                             nullable: true
 *                           matches_played:
 *                             type: integer
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/user/me/sport-rankings", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }

  try {
    const result = await getUserSportRankingSummary(userId);
    return res.json({
      ok: true,
      sports: result.sports,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /user/me/sport-rankings/{sport}:
 *   get:
 *     summary: 내 종목별 랭킹 상세 조회
 *     description: 특정 종목의 개인 통합 랭킹 상세와 내 최근 변동 내역을 조회합니다.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sport
 *         required: true
 *         schema:
 *           type: string
 *         description: 조회할 종목명
 *         example: 탁구
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 sport:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_members:
 *                       type: integer
 *                     my_rank:
 *                       type: integer
 *                       nullable: true
 *                     my_rating:
 *                       type: number
 *                       nullable: true
 *                     matches_played:
 *                       type: integer
 *                 my_ranking:
 *                   type: object
 *                   nullable: true
 *                 rankings:
 *                   type: array
 *                   items:
 *                     type: object
 *                 my_recent_events:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: 종목 값 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 종목 랭킹 정보를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/user/me/sport-rankings/:sport", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  if (!Number.isFinite(userId)) {
    return res.status(401).json({ ok: false, error: "BAD_TOKEN_SUB" });
  }

  const sport = String(req.params.sport ?? "").trim();
  if (!sport) {
    return res.status(400).json({ ok: false, error: "SPORT_REQUIRED" });
  }

  try {
    const result = await getSportRanking(sport, userId);
    if (!result) {
      return res.status(404).json({ ok: false, error: "SPORT_RANKING_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      sport: result.sport,
      summary: result.summary,
      my_ranking: result.my_ranking,
      rankings: result.rankings,
      my_recent_events: result.my_recent_events,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
