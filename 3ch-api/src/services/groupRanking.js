const pool = require('../db/pool');

let ensureTablesPromise = null;

function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

function applyElo(myRating, opponentRating, score, k) {
  const expected = expectedScore(myRating, opponentRating);
  return Math.round(myRating + k * (score - expected));
}

async function ensureGroupRankingTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_ranking_settings (
          group_id           TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
          enabled            BOOLEAN      NOT NULL DEFAULT true,
          algorithm          VARCHAR(20)  NOT NULL DEFAULT 'elo',
          base_rating        INTEGER      NOT NULL DEFAULT 1500,
          k_league           INTEGER      NOT NULL DEFAULT 24,
          k_tournament       INTEGER      NOT NULL DEFAULT 32,
          include_tournament BOOLEAN      NOT NULL DEFAULT true,
          exclude_guests     BOOLEAN      NOT NULL DEFAULT true,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_rankings (
          id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          group_id         TEXT         NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          member_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          rating           INTEGER      NOT NULL DEFAULT 1500,
          rank             INTEGER,
          wins             INTEGER      NOT NULL DEFAULT 0,
          losses           INTEGER      NOT NULL DEFAULT 0,
          matches_played   INTEGER      NOT NULL DEFAULT 0,
          win_rate         DOUBLE PRECISION NOT NULL DEFAULT 0,
          streak           INTEGER      NOT NULL DEFAULT 0,
          best_win_rating  INTEGER,
          last_match_at    TIMESTAMPTZ,
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS group_rankings_group_member_uidx ON group_rankings(group_id, member_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS group_rankings_group_rank_idx ON group_rankings(group_id, rank)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS group_rankings_group_rating_idx ON group_rankings(group_id, rating DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_ranking_events (
          id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          group_id           TEXT         NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          member_id          INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          opponent_member_id INTEGER,
          league_id          TEXT,
          league_match_id    TEXT,
          before_rating      INTEGER      NOT NULL,
          after_rating       INTEGER      NOT NULL,
          delta              INTEGER      NOT NULL,
          result             VARCHAR(10)  NOT NULL,
          match_type         VARCHAR(20)  NOT NULL,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS group_ranking_events_member_idx ON group_ranking_events(group_id, member_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS group_ranking_events_match_idx ON group_ranking_events(league_match_id)`);
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }

  return ensureTablesPromise;
}

async function getOrCreateSettings(client, groupId) {
  await client.query(
    `INSERT INTO group_ranking_settings (group_id)
     VALUES ($1)
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId],
  );

  const result = await client.query(
    `SELECT *
       FROM group_ranking_settings
      WHERE group_id = $1`,
    [groupId],
  );

  return result.rows[0];
}

function defaultState(baseRating) {
  return {
    rating: baseRating,
    wins: 0,
    losses: 0,
    matches_played: 0,
    streak: 0,
    best_win_rating: null,
    last_match_at: null,
  };
}

async function rebuildGroupRanking(groupId) {
  await ensureGroupRankingTables();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const settings = await getOrCreateSettings(client, groupId);
    const baseRating = Number(settings.base_rating) || 1500;
    const includeTournament = settings.include_tournament !== false;

    const memberResult = await client.query(
      `SELECT
         gm.user_id AS member_id,
         COALESCE(gm.division, '') AS division,
         COALESCE(u.name, u.email) AS name
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC, gm.user_id ASC`,
      [groupId],
    );

    const members = memberResult.rows;
    const states = new Map();
    for (const member of members) {
      states.set(Number(member.member_id), defaultState(baseRating));
    }

    const matchParams = [groupId];
    let matchQuery = `
      SELECT
        m.id,
        m.league_id,
        m.bracket,
        m.score_a,
        m.score_b,
        COALESCE(m.created_at, NOW()) AS played_at,
        pa.member_id AS member_a_id,
        pb.member_id AS member_b_id
      FROM league_matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN league_participants pa ON pa.id = m.participant_a_id
      JOIN league_participants pb ON pb.id = m.participant_b_id
      JOIN group_members gma ON gma.group_id = l.group_id AND gma.user_id = pa.member_id
      JOIN group_members gmb ON gmb.group_id = l.group_id AND gmb.user_id = pb.member_id
      WHERE l.group_id = $1
        AND m.status = 'done'
        AND pa.member_id IS NOT NULL
        AND pb.member_id IS NOT NULL
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a <> m.score_b
    `;

    if (!includeTournament) {
      matchQuery += ` AND m.bracket IS NULL`;
    }

    matchQuery += ` ORDER BY played_at ASC, m.id ASC`;

    const matchResult = await client.query(matchQuery, matchParams);
    const events = [];

    for (const match of matchResult.rows) {
      const memberAId = Number(match.member_a_id);
      const memberBId = Number(match.member_b_id);
      if (!states.has(memberAId) || !states.has(memberBId)) continue;

      const stateA = states.get(memberAId);
      const stateB = states.get(memberBId);
      const beforeA = stateA.rating;
      const beforeB = stateB.rating;
      const isAWin = Number(match.score_a) > Number(match.score_b);
      const scoreA = isAWin ? 1 : 0;
      const scoreB = isAWin ? 0 : 1;
      const k = match.bracket ? (Number(settings.k_tournament) || 32) : (Number(settings.k_league) || 24);
      const afterA = applyElo(beforeA, beforeB, scoreA, k);
      const afterB = applyElo(beforeB, beforeA, scoreB, k);
      const playedAt = match.played_at;
      const matchType = match.bracket ? 'tournament' : 'league';

      stateA.rating = afterA;
      stateB.rating = afterB;
      stateA.matches_played += 1;
      stateB.matches_played += 1;
      stateA.last_match_at = playedAt;
      stateB.last_match_at = playedAt;

      if (isAWin) {
        stateA.wins += 1;
        stateB.losses += 1;
        stateA.streak = stateA.streak >= 0 ? stateA.streak + 1 : 1;
        stateB.streak = stateB.streak <= 0 ? stateB.streak - 1 : -1;
        stateA.best_win_rating = stateA.best_win_rating == null ? beforeB : Math.max(stateA.best_win_rating, beforeB);
      } else {
        stateB.wins += 1;
        stateA.losses += 1;
        stateB.streak = stateB.streak >= 0 ? stateB.streak + 1 : 1;
        stateA.streak = stateA.streak <= 0 ? stateA.streak - 1 : -1;
        stateB.best_win_rating = stateB.best_win_rating == null ? beforeA : Math.max(stateB.best_win_rating, beforeA);
      }

      events.push({
        group_id: groupId,
        member_id: memberAId,
        opponent_member_id: memberBId,
        league_id: match.league_id,
        league_match_id: match.id,
        before_rating: beforeA,
        after_rating: afterA,
        delta: afterA - beforeA,
        result: isAWin ? 'win' : 'loss',
        match_type: matchType,
        created_at: playedAt,
      });

      events.push({
        group_id: groupId,
        member_id: memberBId,
        opponent_member_id: memberAId,
        league_id: match.league_id,
        league_match_id: match.id,
        before_rating: beforeB,
        after_rating: afterB,
        delta: afterB - beforeB,
        result: isAWin ? 'loss' : 'win',
        match_type: matchType,
        created_at: playedAt,
      });
    }

    const rankingRows = members.map((member) => {
      const memberId = Number(member.member_id);
      const state = states.get(memberId) ?? defaultState(baseRating);
      const winRate = state.matches_played > 0
        ? Number(((state.wins / state.matches_played) * 100).toFixed(1))
        : 0;
      return {
        member_id: memberId,
        division: member.division || null,
        name: member.name,
        rating: state.rating,
        wins: state.wins,
        losses: state.losses,
        matches_played: state.matches_played,
        win_rate: winRate,
        streak: state.streak,
        best_win_rating: state.best_win_rating,
        last_match_at: state.last_match_at,
      };
    });

    const rankedRows = rankingRows
      .filter((row) => row.matches_played > 0)
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return a.name.localeCompare(b.name, 'ko');
      });

    const rankMap = new Map();
    rankedRows.forEach((row, index) => {
      rankMap.set(row.member_id, index + 1);
    });

    await client.query(`DELETE FROM group_ranking_events WHERE group_id = $1`, [groupId]);
    await client.query(`DELETE FROM group_rankings WHERE group_id = $1`, [groupId]);

    if (rankingRows.length > 0) {
      const rankingValues = [];
      const rankingPlaceholders = rankingRows.map((row, index) => {
        const base = index * 11;
        rankingValues.push(
          groupId,
          row.member_id,
          row.rating,
          rankMap.get(row.member_id) ?? null,
          row.wins,
          row.losses,
          row.matches_played,
          row.win_rate,
          row.streak,
          row.best_win_rating,
          row.last_match_at,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
      }).join(', ');

      await client.query(
        `INSERT INTO group_rankings
          (group_id, member_id, rating, rank, wins, losses, matches_played, win_rate, streak, best_win_rating, last_match_at)
         VALUES ${rankingPlaceholders}`,
        rankingValues,
      );
    }

    if (events.length > 0) {
      const eventValues = [];
      const eventPlaceholders = events.map((event, index) => {
        const base = index * 10;
        eventValues.push(
          event.group_id,
          event.member_id,
          event.opponent_member_id,
          event.league_id,
          event.league_match_id,
          event.before_rating,
          event.after_rating,
          event.delta,
          event.result,
          event.match_type,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
      }).join(', ');

      await client.query(
        `INSERT INTO group_ranking_events
          (group_id, member_id, opponent_member_id, league_id, league_match_id, before_rating, after_rating, delta, result, match_type)
         VALUES ${eventPlaceholders}`,
        eventValues,
      );
    }

    await client.query(`UPDATE group_ranking_settings SET updated_at = NOW() WHERE group_id = $1`, [groupId]);
    await client.query('COMMIT');

    return {
      member_count: members.length,
      ranked_count: rankedRows.length,
      match_count: matchResult.rowCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getGroupRanking(groupId) {
  await ensureGroupRankingTables();

  const groupResult = await pool.query(
    `SELECT id, name FROM groups WHERE id = $1`,
    [groupId],
  );
  if (groupResult.rowCount === 0) return null;

  const rowsResult = await pool.query(
    `SELECT
       gr.member_id,
       COALESCE(gm.division, '') AS division,
       COALESCE(u.name, u.email) AS name,
       gr.rank,
       gr.rating,
       gr.wins,
       gr.losses,
       gr.matches_played,
       gr.win_rate,
       gr.streak,
       gr.last_match_at,
       gr.updated_at
     FROM group_rankings gr
     JOIN users u ON u.id = gr.member_id
     LEFT JOIN group_members gm ON gm.group_id = gr.group_id AND gm.user_id = gr.member_id
     WHERE gr.group_id = $1
     ORDER BY
       CASE WHEN gr.rank IS NULL THEN 1 ELSE 0 END,
       gr.rank ASC NULLS LAST,
       gr.rating DESC,
       name ASC`,
    [groupId],
  );

  if (rowsResult.rowCount === 0) {
    await rebuildGroupRanking(groupId);
  }

  const rankingResult = await pool.query(
    `SELECT
       gr.member_id,
       COALESCE(gm.division, '') AS division,
       COALESCE(u.name, u.email) AS name,
       gr.rank,
       gr.rating,
       gr.wins,
       gr.losses,
       gr.matches_played,
       gr.win_rate,
       gr.streak,
       gr.last_match_at
     FROM group_rankings gr
     JOIN users u ON u.id = gr.member_id
     LEFT JOIN group_members gm ON gm.group_id = gr.group_id AND gm.user_id = gr.member_id
     WHERE gr.group_id = $1
     ORDER BY
       CASE WHEN gr.rank IS NULL THEN 1 ELSE 0 END,
       gr.rank ASC NULLS LAST,
       gr.rating DESC,
       name ASC`,
    [groupId],
  );

  const summaryResult = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM group_members WHERE group_id = $1) AS member_count,
       (SELECT COUNT(*)::int FROM group_rankings WHERE group_id = $1 AND matches_played > 0) AS ranked_count,
       MAX(updated_at) AS updated_at
     FROM group_rankings
     WHERE group_id = $1`,
    [groupId],
  );

  const matchCountResult = await pool.query(
    `SELECT COUNT(*)::int AS match_count
       FROM league_matches m
       JOIN leagues l ON l.id = m.league_id
      WHERE l.group_id = $1
        AND m.status = 'done'
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a <> m.score_b`,
    [groupId],
  );

  return {
    group: groupResult.rows[0],
    summary: {
      member_count: Number(summaryResult.rows[0]?.member_count) || 0,
      ranked_count: Number(summaryResult.rows[0]?.ranked_count) || 0,
      match_count: Number(matchCountResult.rows[0]?.match_count) || 0,
      updated_at: summaryResult.rows[0]?.updated_at ?? null,
    },
    rankings: rankingResult.rows.map((row) => ({
      member_id: Number(row.member_id),
      division: row.division || null,
      name: row.name,
      rank: row.rank == null ? null : Number(row.rank),
      rating: Number(row.rating),
      wins: Number(row.wins),
      losses: Number(row.losses),
      matches_played: Number(row.matches_played),
      win_rate: Number(row.win_rate),
      streak: Number(row.streak),
      last_match_at: row.last_match_at,
    })),
  };
}

async function getGroupRankingDetail(groupId, memberId) {
  await ensureGroupRankingTables();

  const rankingResult = await pool.query(
    `SELECT
       gr.member_id,
       COALESCE(gm.division, '') AS division,
       COALESCE(u.name, u.email) AS name,
       gr.rank,
       gr.rating,
       gr.wins,
       gr.losses,
       gr.matches_played,
       gr.win_rate,
       gr.streak,
       gr.best_win_rating,
       gr.last_match_at
     FROM group_rankings gr
     JOIN users u ON u.id = gr.member_id
     LEFT JOIN group_members gm ON gm.group_id = gr.group_id AND gm.user_id = gr.member_id
     WHERE gr.group_id = $1 AND gr.member_id = $2`,
    [groupId, memberId],
  );

  if (rankingResult.rowCount === 0) {
    await rebuildGroupRanking(groupId);
  }

  const refreshed = await pool.query(
    `SELECT
       gr.member_id,
       COALESCE(gm.division, '') AS division,
       COALESCE(u.name, u.email) AS name,
       gr.rank,
       gr.rating,
       gr.wins,
       gr.losses,
       gr.matches_played,
       gr.win_rate,
       gr.streak,
       gr.best_win_rating,
       gr.last_match_at
     FROM group_rankings gr
     JOIN users u ON u.id = gr.member_id
     LEFT JOIN group_members gm ON gm.group_id = gr.group_id AND gm.user_id = gr.member_id
     WHERE gr.group_id = $1 AND gr.member_id = $2`,
    [groupId, memberId],
  );

  if (refreshed.rowCount === 0) return null;

  const events = await pool.query(
    `SELECT
       e.league_id,
       e.league_match_id,
       e.before_rating,
       e.after_rating,
       e.delta,
       e.result,
       e.match_type,
       e.created_at,
       COALESCE(u.name, u.email) AS opponent_name
     FROM group_ranking_events e
     LEFT JOIN users u ON u.id = e.opponent_member_id
     WHERE e.group_id = $1 AND e.member_id = $2
     ORDER BY e.created_at DESC
     LIMIT 20`,
    [groupId, memberId],
  );

  const row = refreshed.rows[0];
  return {
    member: {
      member_id: Number(row.member_id),
      division: row.division || null,
      name: row.name,
    },
    ranking: {
      member_id: Number(row.member_id),
      division: row.division || null,
      name: row.name,
      rank: row.rank == null ? null : Number(row.rank),
      rating: Number(row.rating),
      wins: Number(row.wins),
      losses: Number(row.losses),
      matches_played: Number(row.matches_played),
      win_rate: Number(row.win_rate),
      streak: Number(row.streak),
      best_win_rating: row.best_win_rating == null ? null : Number(row.best_win_rating),
      last_match_at: row.last_match_at,
    },
    recent_events: events.rows.map((event) => ({
      league_id: event.league_id,
      league_match_id: event.league_match_id,
      before_rating: Number(event.before_rating),
      after_rating: Number(event.after_rating),
      delta: Number(event.delta),
      result: event.result,
      match_type: event.match_type,
      opponent_name: event.opponent_name,
      created_at: event.created_at,
    })),
  };
}

async function updateGroupRankingSettings(groupId, input) {
  await ensureGroupRankingTables();

  const fields = [];
  const values = [];

  if (input.enabled !== undefined) {
    fields.push(`enabled = $${values.length + 1}`);
    values.push(Boolean(input.enabled));
  }
  if (input.base_rating !== undefined) {
    fields.push(`base_rating = $${values.length + 1}`);
    values.push(Number(input.base_rating));
  }
  if (input.k_league !== undefined) {
    fields.push(`k_league = $${values.length + 1}`);
    values.push(Number(input.k_league));
  }
  if (input.k_tournament !== undefined) {
    fields.push(`k_tournament = $${values.length + 1}`);
    values.push(Number(input.k_tournament));
  }
  if (input.include_tournament !== undefined) {
    fields.push(`include_tournament = $${values.length + 1}`);
    values.push(Boolean(input.include_tournament));
  }

  await pool.query(
    `INSERT INTO group_ranking_settings (group_id)
     VALUES ($1)
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId],
  );

  if (fields.length === 0) {
    const result = await pool.query(`SELECT * FROM group_ranking_settings WHERE group_id = $1`, [groupId]);
    return result.rows[0];
  }

  values.push(groupId);
  const result = await pool.query(
    `UPDATE group_ranking_settings
        SET ${fields.join(', ')}, updated_at = NOW()
      WHERE group_id = $${values.length}
      RETURNING *`,
    values,
  );

  await rebuildGroupRanking(groupId);
  return result.rows[0];
}

async function getGroupIdByLeagueId(leagueId) {
  const result = await pool.query(
    `SELECT group_id FROM leagues WHERE id = $1`,
    [leagueId],
  );
  return result.rows[0]?.group_id ?? null;
}

module.exports = {
  ensureGroupRankingTables,
  rebuildGroupRanking,
  getGroupRanking,
  getGroupRankingDetail,
  updateGroupRankingSettings,
  getGroupIdByLeagueId,
};
