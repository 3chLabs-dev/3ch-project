const pool = require('../db/pool');

const BASE_RATING = 1500;
const LEAGUE_K = 24;
const TOURNAMENT_K = 32;

let ensureTablesPromise = null;

function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

function applyElo(myRating, opponentRating, score, k) {
  const expected = expectedScore(myRating, opponentRating);
  return Math.round(myRating + k * (score - expected));
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

function normalizeSport(sport) {
  return String(sport ?? '').trim();
}

async function ensureSportRankingTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sport_rankings (
          id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          sport            VARCHAR(100) NOT NULL,
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
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sport_rankings_sport_member_uidx ON sport_rankings(sport, member_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS sport_rankings_sport_rank_idx ON sport_rankings(sport, rank)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS sport_rankings_member_idx ON sport_rankings(member_id)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sport_ranking_events (
          id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          sport              VARCHAR(100) NOT NULL,
          member_id          INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          opponent_member_id INTEGER,
          group_id           TEXT REFERENCES groups(id) ON DELETE SET NULL,
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
      await pool.query(`CREATE INDEX IF NOT EXISTS sport_ranking_events_member_idx ON sport_ranking_events(sport, member_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS sport_ranking_events_match_idx ON sport_ranking_events(league_match_id)`);
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }

  return ensureTablesPromise;
}

async function rebuildSportRanking(sport) {
  await ensureSportRankingTables();

  const normalizedSport = normalizeSport(sport);
  if (!normalizedSport) {
    return {
      ranked_count: 0,
      match_count: 0,
      member_count: 0,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matchResult = await client.query(
      `SELECT
         m.id,
         m.league_id,
         l.group_id,
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
      WHERE l.sport = $1
        AND m.status = 'done'
        AND pa.member_id IS NOT NULL
        AND pb.member_id IS NOT NULL
        AND pa.member_id <> pb.member_id
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a <> m.score_b
      ORDER BY played_at ASC, m.id ASC`,
      [normalizedSport],
    );

    const memberIds = new Set();
    const states = new Map();
    const events = [];

    for (const match of matchResult.rows) {
      const memberAId = Number(match.member_a_id);
      const memberBId = Number(match.member_b_id);

      memberIds.add(memberAId);
      memberIds.add(memberBId);

      if (!states.has(memberAId)) states.set(memberAId, defaultState(BASE_RATING));
      if (!states.has(memberBId)) states.set(memberBId, defaultState(BASE_RATING));

      const stateA = states.get(memberAId);
      const stateB = states.get(memberBId);
      const beforeA = stateA.rating;
      const beforeB = stateB.rating;
      const isAWin = Number(match.score_a) > Number(match.score_b);
      const scoreA = isAWin ? 1 : 0;
      const scoreB = isAWin ? 0 : 1;
      const k = match.bracket ? TOURNAMENT_K : LEAGUE_K;
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
        sport: normalizedSport,
        member_id: memberAId,
        opponent_member_id: memberBId,
        group_id: match.group_id,
        league_id: match.league_id,
        league_match_id: match.id,
        before_rating: beforeA,
        after_rating: afterA,
        delta: afterA - beforeA,
        result: isAWin ? 'win' : 'loss',
        match_type: matchType,
      });

      events.push({
        sport: normalizedSport,
        member_id: memberBId,
        opponent_member_id: memberAId,
        group_id: match.group_id,
        league_id: match.league_id,
        league_match_id: match.id,
        before_rating: beforeB,
        after_rating: afterB,
        delta: afterB - beforeB,
        result: isAWin ? 'loss' : 'win',
        match_type: matchType,
      });
    }

    const memberIdList = Array.from(memberIds);
    const nameMap = new Map();
    if (memberIdList.length > 0) {
      const userResult = await client.query(
        `SELECT id, COALESCE(name, email) AS name
           FROM users
          WHERE id = ANY($1::int[])`,
        [memberIdList],
      );
      for (const row of userResult.rows) {
        nameMap.set(Number(row.id), row.name);
      }
    }

    const rankingRows = memberIdList.map((memberId) => {
      const state = states.get(memberId) ?? defaultState(BASE_RATING);
      const winRate = state.matches_played > 0
        ? Number(((state.wins / state.matches_played) * 100).toFixed(1))
        : 0;

      return {
        member_id: memberId,
        name: nameMap.get(memberId) ?? `회원 ${memberId}`,
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

    await client.query(`DELETE FROM sport_ranking_events WHERE sport = $1`, [normalizedSport]);
    await client.query(`DELETE FROM sport_rankings WHERE sport = $1`, [normalizedSport]);

    if (rankingRows.length > 0) {
      const rankingValues = [];
      const rankingPlaceholders = rankingRows.map((row, index) => {
        const base = index * 11;
        rankingValues.push(
          normalizedSport,
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
        `INSERT INTO sport_rankings
          (sport, member_id, rating, rank, wins, losses, matches_played, win_rate, streak, best_win_rating, last_match_at)
         VALUES ${rankingPlaceholders}`,
        rankingValues,
      );
    }

    if (events.length > 0) {
      const eventValues = [];
      const eventPlaceholders = events.map((event, index) => {
        const base = index * 11;
        eventValues.push(
          event.sport,
          event.member_id,
          event.opponent_member_id,
          event.group_id,
          event.league_id,
          event.league_match_id,
          event.before_rating,
          event.after_rating,
          event.delta,
          event.result,
          event.match_type,
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
      }).join(', ');

      await client.query(
        `INSERT INTO sport_ranking_events
          (sport, member_id, opponent_member_id, group_id, league_id, league_match_id, before_rating, after_rating, delta, result, match_type)
         VALUES ${eventPlaceholders}`,
        eventValues,
      );
    }

    await client.query(
      `UPDATE sport_rankings
          SET updated_at = NOW()
        WHERE sport = $1`,
      [normalizedSport],
    );

    await client.query('COMMIT');

    return {
      member_count: rankingRows.length,
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

async function ensureSportRankingExists(sport) {
  const normalizedSport = normalizeSport(sport);
  if (!normalizedSport) return;

  await ensureSportRankingTables();
  const result = await pool.query(
    `SELECT 1 FROM sport_rankings WHERE sport = $1 LIMIT 1`,
    [normalizedSport],
  );
  if (result.rowCount === 0) {
    await rebuildSportRanking(normalizedSport);
  }
}

async function getUserSportRankingSummary(userId) {
  await ensureSportRankingTables();

  const sportResult = await pool.query(
    `SELECT DISTINCT sport
       FROM (
         SELECT g.sport AS sport
           FROM group_members gm
           JOIN groups g ON g.id = gm.group_id
          WHERE gm.user_id = $1
            AND g.sport IS NOT NULL
            AND TRIM(g.sport) <> ''
         UNION
         SELECT l.sport AS sport
           FROM league_participants lp
           JOIN leagues l ON l.id = lp.league_id
          WHERE lp.member_id = $1
            AND l.sport IS NOT NULL
            AND TRIM(l.sport) <> ''
       ) sports
      ORDER BY sport ASC`,
    [userId],
  );

  const sports = sportResult.rows.map((row) => row.sport).filter(Boolean);
  if (sports.length === 0) {
    return { sports: [] };
  }

  for (const sport of sports) {
    await ensureSportRankingExists(sport);
  }

  const clubCountResult = await pool.query(
    `SELECT g.sport, COUNT(DISTINCT gm.group_id)::int AS club_count
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = $1
        AND g.sport = ANY($2::text[])
      GROUP BY g.sport`,
    [userId, sports],
  );
  const clubCountMap = new Map();
  for (const row of clubCountResult.rows) {
    clubCountMap.set(row.sport, Number(row.club_count));
  }

  const myRankingResult = await pool.query(
    `SELECT
       sport,
       member_id,
       rank,
       rating,
       wins,
       losses,
       matches_played,
       win_rate,
       streak,
       last_match_at
     FROM sport_rankings
    WHERE member_id = $1
      AND sport = ANY($2::text[])`,
    [userId, sports],
  );
  const myRankingMap = new Map();
  for (const row of myRankingResult.rows) {
    myRankingMap.set(row.sport, {
      member_id: Number(row.member_id),
      rank: row.rank == null ? null : Number(row.rank),
      rating: Number(row.rating),
      wins: Number(row.wins),
      losses: Number(row.losses),
      matches_played: Number(row.matches_played),
      win_rate: Number(row.win_rate),
      streak: Number(row.streak),
      last_match_at: row.last_match_at,
    });
  }

  const previewResult = await pool.query(
    `SELECT sport, member_id, name, rank, rating
       FROM (
         SELECT
           sr.sport,
           sr.member_id,
           COALESCE(u.name, u.email) AS name,
           sr.rank,
           sr.rating,
           ROW_NUMBER() OVER (
             PARTITION BY sr.sport
             ORDER BY
               CASE WHEN sr.rank IS NULL THEN 1 ELSE 0 END,
               sr.rank ASC NULLS LAST,
               sr.rating DESC,
               COALESCE(u.name, u.email) ASC
           ) AS preview_order
         FROM sport_rankings sr
         JOIN users u ON u.id = sr.member_id
         WHERE sr.sport = ANY($1::text[])
           AND sr.matches_played > 0
       ) ranked
      WHERE preview_order <= 3
      ORDER BY sport ASC, preview_order ASC`,
    [sports],
  );
  const previewMap = new Map();
  for (const row of previewResult.rows) {
    const current = previewMap.get(row.sport) ?? [];
    current.push({
      member_id: Number(row.member_id),
      name: row.name,
      rank: row.rank == null ? null : Number(row.rank),
      rating: Number(row.rating),
    });
    previewMap.set(row.sport, current);
  }

  return {
    sports: sports.map((sport) => ({
      sport,
      club_count: clubCountMap.get(sport) ?? 0,
      my_ranking: myRankingMap.get(sport) ?? null,
      top3: previewMap.get(sport) ?? [],
    })),
  };
}

async function getSportRanking(sport, userId) {
  await ensureSportRankingTables();

  const normalizedSport = normalizeSport(sport);
  if (!normalizedSport) return null;

  await ensureSportRankingExists(normalizedSport);

  const rankingResult = await pool.query(
    `SELECT
       sr.member_id,
       COALESCE(u.name, u.email) AS name,
       sr.rank,
       sr.rating,
       sr.wins,
       sr.losses,
       sr.matches_played,
       sr.win_rate,
       sr.streak,
       sr.last_match_at
     FROM sport_rankings sr
     JOIN users u ON u.id = sr.member_id
    WHERE sr.sport = $1
    ORDER BY
      CASE WHEN sr.rank IS NULL THEN 1 ELSE 0 END,
      sr.rank ASC NULLS LAST,
      sr.rating DESC,
      COALESCE(u.name, u.email) ASC`,
    [normalizedSport],
  );

  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS ranked_count,
       MAX(updated_at) AS updated_at
     FROM sport_rankings
    WHERE sport = $1
      AND matches_played > 0`,
    [normalizedSport],
  );

  const matchCountResult = await pool.query(
    `SELECT COUNT(*)::int AS match_count
       FROM league_matches m
       JOIN leagues l ON l.id = m.league_id
       JOIN league_participants pa ON pa.id = m.participant_a_id
       JOIN league_participants pb ON pb.id = m.participant_b_id
      WHERE l.sport = $1
        AND m.status = 'done'
        AND pa.member_id IS NOT NULL
        AND pb.member_id IS NOT NULL
        AND pa.member_id <> pb.member_id
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a <> m.score_b`,
    [normalizedSport],
  );

  let myRecentEvents = [];
  let myRanking = null;

  if (Number.isFinite(Number(userId))) {
    const myRow = rankingResult.rows.find((row) => Number(row.member_id) === Number(userId));
    if (myRow) {
      myRanking = {
        member_id: Number(myRow.member_id),
        name: myRow.name,
        rank: myRow.rank == null ? null : Number(myRow.rank),
        rating: Number(myRow.rating),
        wins: Number(myRow.wins),
        losses: Number(myRow.losses),
        matches_played: Number(myRow.matches_played),
        win_rate: Number(myRow.win_rate),
        streak: Number(myRow.streak),
        last_match_at: myRow.last_match_at,
      };
    }

    const eventResult = await pool.query(
      `SELECT
         e.group_id,
         g.name AS group_name,
         e.league_id,
         e.league_match_id,
         e.before_rating,
         e.after_rating,
         e.delta,
         e.result,
         e.match_type,
         e.created_at,
         COALESCE(u.name, u.email) AS opponent_name
       FROM sport_ranking_events e
       LEFT JOIN groups g ON g.id = e.group_id
       LEFT JOIN users u ON u.id = e.opponent_member_id
      WHERE e.sport = $1
        AND e.member_id = $2
      ORDER BY e.created_at DESC
      LIMIT 10`,
      [normalizedSport, Number(userId)],
    );

    myRecentEvents = eventResult.rows.map((event) => ({
      group_id: event.group_id,
      group_name: event.group_name,
      league_id: event.league_id,
      league_match_id: event.league_match_id,
      before_rating: Number(event.before_rating),
      after_rating: Number(event.after_rating),
      delta: Number(event.delta),
      result: event.result,
      match_type: event.match_type,
      opponent_name: event.opponent_name,
      created_at: event.created_at,
    }));
  }

  return {
    sport: normalizedSport,
    summary: {
      ranked_count: Number(summaryResult.rows[0]?.ranked_count) || 0,
      match_count: Number(matchCountResult.rows[0]?.match_count) || 0,
      updated_at: summaryResult.rows[0]?.updated_at ?? null,
    },
    my_ranking: myRanking,
    rankings: rankingResult.rows.map((row) => ({
      member_id: Number(row.member_id),
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
    my_recent_events: myRecentEvents,
  };
}

async function getSportByLeagueId(leagueId) {
  const result = await pool.query(
    `SELECT sport FROM leagues WHERE id = $1`,
    [leagueId],
  );
  return result.rows[0]?.sport ?? null;
}

async function rebuildSportRankingByLeagueId(leagueId) {
  const sport = await getSportByLeagueId(leagueId);
  if (sport) {
    await rebuildSportRanking(sport);
  }
}

module.exports = {
  ensureSportRankingTables,
  rebuildSportRanking,
  getUserSportRankingSummary,
  getSportRanking,
  getSportByLeagueId,
  rebuildSportRankingByLeagueId,
};
