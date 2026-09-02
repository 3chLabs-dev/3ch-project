const pool = require("../db/pool");

const DEFAULT_POINT_RULES = Object.freeze({
  attendance: { league: 10, tournament: 20 },
  matchPoints: {
    mode: "sets",
    winPoints: 3,
    eventTypes: { singles: true, doubles: true, team: true },
    formats: { league: true, group: true, tournament: true },
  },
  rankings: {
    league: { enabled: true, first: 30, second: 20, third: 15, fourth: 10 },
    group: { enabled: true, first: 30, second: 20, third: 15, fourth: 10 },
    tournamentUpper: { enabled: true, first: 50, second: 30, third: 20, fourth: 15 },
    tournamentLower: { enabled: true, first: 20, second: 15, third: 10, fourth: 5 },
  },
});

function normalizePointRules(value) {
  const input = value && typeof value === "object" ? value : {};
  const attendance = input.attendance && typeof input.attendance === "object" ? input.attendance : {};
  const matchPoints = input.matchPoints && typeof input.matchPoints === "object" ? input.matchPoints : {};
  const rankings = input.rankings && typeof input.rankings === "object" ? input.rankings : {};
  const numberOr = (candidate, fallback) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const normalizeRankRule = (rule, fallback) => ({
    enabled: rule?.enabled !== false,
    first: numberOr(rule?.first, fallback.first),
    second: numberOr(rule?.second, fallback.second),
    third: numberOr(rule?.third, numberOr(rule?.thirdFourth, fallback.third)),
    fourth: numberOr(rule?.fourth, numberOr(rule?.thirdFourth, fallback.fourth)),
  });
  return {
    attendance: {
      league: numberOr(attendance.league, DEFAULT_POINT_RULES.attendance.league),
      tournament: numberOr(attendance.tournament, DEFAULT_POINT_RULES.attendance.tournament),
    },
    matchPoints: {
      mode: matchPoints.mode === "win" ? "win" : "sets",
      winPoints: numberOr(matchPoints.winPoints, DEFAULT_POINT_RULES.matchPoints.winPoints),
      eventTypes: {
        singles: matchPoints.eventTypes?.singles !== false,
        doubles: matchPoints.eventTypes?.doubles !== false,
        team: matchPoints.eventTypes?.team !== false,
      },
      formats: {
        league: matchPoints.formats?.league !== false,
        group: matchPoints.formats?.group !== false,
        tournament: matchPoints.formats?.tournament !== false,
      },
    },
    rankings: {
      league: normalizeRankRule(rankings.league, DEFAULT_POINT_RULES.rankings.league),
      group: normalizeRankRule(rankings.group, DEFAULT_POINT_RULES.rankings.group),
      tournamentUpper: normalizeRankRule(rankings.tournamentUpper, DEFAULT_POINT_RULES.rankings.tournamentUpper),
      tournamentLower: normalizeRankRule(rankings.tournamentLower, DEFAULT_POINT_RULES.rankings.tournamentLower),
    },
  };
}

function toKey(value) {
  return String(value ?? "");
}

function getBonusRule(pointRules, section, format, option) {
  if (section === "tournament") {
    return option === "LOWER"
      ? pointRules.rankings.tournamentLower
      : pointRules.rankings.tournamentUpper;
  }
  return format === "GROUP"
    ? pointRules.rankings.group
    : pointRules.rankings.league;
}

function createSectionRow(base) {
  return {
    member_id: Number(base.member_id),
    name: base.name,
    division: base.division || null,
    attendance_count: 0,
    championships: 0,
    matches_played: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    score_points: 0,
    attendance_points: 0,
    bonus_points: 0,
    total_points: 0,
    rank: null,
    section: "league",
  };
}

function ensureRow(sectionMap, memberId, baseInfo, section) {
  if (!baseInfo) return null;
  const key = Number(memberId);
  if (!sectionMap.has(key)) {
    const row = createSectionRow(baseInfo);
    row.section = section;
    sectionMap.set(key, row);
  }
  return sectionMap.get(key);
}

function compareStanding(a, b) {
  if (b.wins !== a.wins) return b.wins - a.wins;
  const diffA = a.score_points - a.lost_points;
  const diffB = b.score_points - b.lost_points;
  if (diffB !== diffA) return diffB - diffA;
  if (b.score_points !== a.score_points) return b.score_points - a.score_points;
  return a.name.localeCompare(b.name, "ko");
}

function compareRanking(a, b) {
  if (b.total_points !== a.total_points) return b.total_points - a.total_points;
  if (b.championships !== a.championships) return b.championships - a.championships;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return a.name.localeCompare(b.name, "ko");
}

function awardBonus(row, rank, rule, divisor = 1) {
  if (rule?.enabled === false) return;
  let points = 0;
  if (rank === 1) points = rule.first;
  else if (rank === 2) points = rule.second;
  else if (rank === 3) points = rule.third;
  else if (rank === 4) points = rule.fourth;

  row.bonus_points = roundPoint(row.bonus_points + points / Math.max(1, divisor));
  if (rank === 1) row.championships += 1;
}

function finalizeRows(sectionMap, pointRules) {
  const rows = Array.from(sectionMap.values());
  rows.forEach((row) => {
    row.attendance_points = row.attendance_count * pointRules.attendance[row.section];
    row.score_points = roundPoint(row.score_points);
    row.total_points = roundPoint(row.attendance_points + row.score_points + row.bonus_points);
    row.win_rate = row.matches_played > 0
      ? Number((row.wins / row.matches_played).toFixed(3))
      : 0;
  });

  rows.sort(compareRanking);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

function getAvailableYears(rows) {
  const years = new Set();
  rows.forEach((row) => {
    const year = Number(row.year);
    if (Number.isFinite(year)) years.add(year);
  });
  return Array.from(years).sort((a, b) => b - a);
}

function toDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function addUtcDays(value, days) {
  const date = new Date(`${toDateOnly(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getProgramRoundMeta(programData, programRound) {
  const index = Math.max(0, Number(programRound || 1) - 1);
  const block = Array.isArray(programData?.blocks) ? programData.blocks[index] : null;
  const round = Array.isArray(programData?.rounds) ? programData.rounds[index] : null;
  return {
    type: block?.type ?? round?.program ?? null,
    format: block?.format ?? round?.format ?? null,
    option: round?.option ?? block?.option ?? "NONE",
  };
}

function isSinglesEntry(row) {
  if (row.is_program) {
    return row.program_block_type === "SINGLES"
      || getProgramRoundMeta(row.program_data, row.program_round).type === "SINGLES";
  }
  return String(row.league_type ?? "").trim() === "단식";
}

function getProgramEntryType(row) {
  if (!row.is_program) return isSinglesEntry(row) ? "singles" : null;
  const type = row.program_block_type
    ?? getProgramRoundMeta(row.program_data, row.program_round).type;
  if (type === "SINGLES") return "singles";
  if (type === "DOUBLES") return "doubles";
  if (type === "TEAM") return "team";
  return null;
}

function roundPoint(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function rankingUnitKey(memberIds) {
  return [...memberIds].map(Number).filter(Number.isFinite).sort((a, b) => a - b).join(",");
}

function isThirdPlaceMatch(match) {
  return String(match?.match_label ?? "").includes("3·4위전");
}

function isFinalMatch(match) {
  return String(match?.match_label ?? "").includes("결승") && !isThirdPlaceMatch(match);
}

async function ensureAutoRenewedSeasons(groupId) {
  const today = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < 24; index += 1) {
    const latestResult = await pool.query(
      `SELECT id, start_date, end_date, auto_renew, point_rules, created_by_id
         FROM group_ranking_seasons
        WHERE group_id = $1 AND is_default = false
        ORDER BY end_date DESC, created_at DESC
        LIMIT 1`,
      [groupId],
    );
    const latest = latestResult.rows[0];
    if (!latest?.auto_renew || toDateOnly(latest.end_date) >= today) break;

    const start = toDateOnly(latest.start_date);
    const end = toDateOnly(latest.end_date);
    const durationDays = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
    const nextStart = addUtcDays(end, 1);
    const nextEnd = addUtcDays(nextStart, durationDays);
    const overlap = await pool.query(
      `SELECT 1 FROM group_ranking_seasons
        WHERE group_id = $1 AND is_default = false
          AND start_date <= $3::date AND end_date >= $2::date
        LIMIT 1`,
      [groupId, nextStart, nextEnd],
    );
    if (overlap.rowCount > 0) break;
    const name = `${nextStart.replaceAll('-', '.')} ~ ${nextEnd.replaceAll('-', '.')}`;
    await pool.query(
      `INSERT INTO group_ranking_seasons
         (group_id, name, start_date, end_date, auto_renew, point_rules, created_by_id)
       VALUES ($1, $2, $3::date, $4::date, true, $5::jsonb, $6)`,
      [groupId, name, nextStart, nextEnd, JSON.stringify(normalizePointRules(latest.point_rules)), latest.created_by_id],
    );
  }
}

async function ensureDefaultRankingSeasons(groupId) {
  const groupResult = await pool.query(
    `SELECT created_at, created_by_id FROM groups WHERE id = $1`,
    [groupId],
  );
  const group = groupResult.rows[0];
  if (!group) return;

  const firstYear = new Date(group.created_at).getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  let inheritedRules = DEFAULT_POINT_RULES;

  for (let year = firstYear; year <= currentYear; year += 1) {
    const existing = await pool.query(
      `SELECT point_rules
         FROM group_ranking_seasons
        WHERE group_id = $1
          AND is_default = true
          AND EXTRACT(YEAR FROM start_date) = $2
        LIMIT 1`,
      [groupId, year],
    );
    if (existing.rowCount > 0) {
      inheritedRules = normalizePointRules(existing.rows[0].point_rules);
      continue;
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    await pool.query(
      `INSERT INTO group_ranking_seasons
         (group_id, name, start_date, end_date, auto_renew, is_default, point_rules, created_by_id)
       VALUES ($1, $2, $3::date, $4::date, false, true, $5::jsonb, $6)
       ON CONFLICT DO NOTHING`,
      [groupId, `${year} 시즌`, startDate, endDate, JSON.stringify(inheritedRules), group.created_by_id],
    );
  }

  await pool.query(
    `UPDATE group_ranking_seasons
        SET is_display_default = true, updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM group_ranking_seasons
        WHERE group_id = $1
          AND is_default = true
          AND EXTRACT(YEAR FROM start_date) = $2
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM group_ranking_seasons
        WHERE group_id = $1 AND is_display_default = true
      )`,
    [groupId, currentYear],
  );
}

async function getPointRanking(groupId, year, scope, seasonId) {
  const groupResult = await pool.query(
    `SELECT id, name, sport FROM groups WHERE id = $1`,
    [groupId],
  );
  if (groupResult.rowCount === 0) return null;

  const group = groupResult.rows[0];
  await ensureDefaultRankingSeasons(groupId);
  await ensureAutoRenewedSeasons(groupId);
  const normalizedScope = scope === "national" ? "national" : "club";
  const scopeValue = normalizedScope === "club"
    ? String(groupId)
    : String(group.sport ?? "");

  const yearSourceResult = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS year
       FROM leagues
      WHERE (group_id = $1::text OR sport = $2::text)
      ORDER BY year DESC`,
    [String(groupId), String(group.sport ?? "")],
  );
  const availableYears = getAvailableYears(yearSourceResult.rows);
  const seasonResult = normalizedScope === "club"
    ? await pool.query(
      `SELECT id, name, start_date, end_date, auto_renew, is_default, is_display_default, point_rules
         FROM group_ranking_seasons
        WHERE group_id = $1
        ORDER BY start_date DESC, is_default ASC, created_at DESC`,
      [groupId],
    )
    : { rows: [] };
  const seasons = seasonResult.rows.map((season) => ({
    id: season.id,
    name: season.name,
    start_date: toDateOnly(season.start_date),
    end_date: toDateOnly(season.end_date),
    auto_renew: Boolean(season.auto_renew),
    is_default: Boolean(season.is_default),
    is_display_default: Boolean(season.is_display_default),
    point_rules: normalizePointRules(season.point_rules),
  }));
  const today = new Date().toISOString().slice(0, 10);
  const selectedSeason = seasons.find((season) => season.id === seasonId)
    ?? (!year ? seasons.find((season) => season.is_display_default) : null)
    ?? (!year ? seasons.find((season) => season.start_date <= today && season.end_date >= today) : null)
    ?? null;
  const noActiveSeason = normalizedScope === "club" && seasons.length > 0 && !selectedSeason && !year;
  const targetYear = Number.isFinite(Number(year))
    ? Number(year)
    : (selectedSeason ? Number(selectedSeason.start_date.slice(0, 4)) : (availableYears[0] ?? new Date().getFullYear()));
  const rangeStart = noActiveSeason ? "0001-01-01" : (selectedSeason?.start_date ?? `${targetYear}-01-01`);
  const rangeEnd = noActiveSeason ? "0001-01-01" : (selectedSeason?.end_date ?? `${targetYear}-12-31`);
  const pointRules = normalizePointRules(selectedSeason?.point_rules);

  const leagueFilterSql = normalizedScope === "club"
    ? `l.group_id = $1::text`
    : `l.sport = $1::text`;
  const scopedDateSql = `l.start_date::date BETWEEN $2::date AND $3::date`;

  const memberResult = normalizedScope === "club"
    ? await pool.query(
      `SELECT
         gm.user_id AS member_id,
         COALESCE(gm.division, '') AS division,
         COALESCE(u.name, u.email) AS name
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC, gm.user_id ASC`,
      [groupId],
    )
    : await pool.query(
      `SELECT DISTINCT
         COALESCE(lp.member_id, CASE WHEN matched.matched_count = 1 THEN matched.user_id ELSE NULL END) AS member_id,
         COALESCE(lp.division, CASE WHEN matched.matched_count = 1 THEN matched.division ELSE '' END, '') AS division,
         COALESCE(u.name, u.email, CASE WHEN matched.matched_count = 1 THEN matched.name ELSE NULL END, lp.name) AS name
       FROM league_participants lp
       JOIN leagues l ON l.id = lp.league_id
       LEFT JOIN users u ON u.id = lp.member_id
       LEFT JOIN LATERAL (
         SELECT
           MIN(gm.user_id) AS user_id,
           MIN(COALESCE(gm.division, '')) AS division,
           MIN(COALESCE(u2.name, u2.email, lp.name)) AS name,
           COUNT(*)::int AS matched_count
         FROM group_members gm
         JOIN users u2 ON u2.id = gm.user_id
         WHERE gm.group_id = l.group_id
           AND u2.name IS NOT NULL
           AND u2.name = lp.name
        ) matched ON lp.member_id IS NULL
       WHERE ${leagueFilterSql}
        AND ${scopedDateSql}
        AND COALESCE(lp.member_id, CASE WHEN matched.matched_count = 1 THEN matched.user_id ELSE NULL END) IS NOT NULL
       ORDER BY name ASC`,
      [scopeValue, rangeStart, rangeEnd],
    );

  const baseMembers = new Map();
  memberResult.rows.forEach((row) => {
    baseMembers.set(Number(row.member_id), {
      member_id: Number(row.member_id),
      division: row.division || null,
      name: row.name,
    });
  });

  const participantResult = await pool.query(
    `SELECT
       l.id AS league_id,
       l.name AS league_name,
       l.type AS league_type,
       l.format,
       l.group_id,
       prog.program_data,
       lp.id AS participant_id,
       COALESCE(lp.member_id, CASE WHEN matched.matched_count = 1 THEN matched.user_id ELSE NULL END) AS member_id,
       COALESCE(lp.division, CASE WHEN matched.matched_count = 1 THEN matched.division ELSE '' END, '') AS division,
       COALESCE(u.name, u.email, CASE WHEN matched.matched_count = 1 THEN matched.name ELSE NULL END, lp.name) AS name
     FROM leagues l
     JOIN league_participants lp ON lp.league_id = l.id
     LEFT JOIN league_programs prog ON prog.league_id = l.id
     LEFT JOIN users u ON u.id = lp.member_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(gm.user_id) AS user_id,
         MIN(COALESCE(gm.division, '')) AS division,
         MIN(COALESCE(u2.name, u2.email, lp.name)) AS name,
         COUNT(*)::int AS matched_count
       FROM group_members gm
       JOIN users u2 ON u2.id = gm.user_id
       WHERE gm.group_id = l.group_id
         AND u2.name IS NOT NULL
         AND u2.name = lp.name
     ) matched ON lp.member_id IS NULL
     WHERE ${leagueFilterSql}
       AND ${scopedDateSql}
       AND COALESCE(lp.member_id, CASE WHEN matched.matched_count = 1 THEN matched.user_id ELSE NULL END) IS NOT NULL
     ORDER BY l.start_date ASC, lp.created_at ASC`,
    [scopeValue, rangeStart, rangeEnd],
  );

  const matchColumnResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'league_matches'
       AND column_name IN (
         'participant_a_roster_ids',
         'participant_b_roster_ids',
         'tournament_bracket_index'
       )`,
  );
  const matchColumns = new Set(matchColumnResult.rows.map((row) => row.column_name));
  const rosterSelectSql = matchColumns.has('participant_a_roster_ids')
    && matchColumns.has('participant_b_roster_ids')
    ? `m.participant_a_roster_ids,
       m.participant_b_roster_ids,`
    : `ARRAY[]::text[] AS participant_a_roster_ids,
       ARRAY[]::text[] AS participant_b_roster_ids,`;
  const tournamentBracketIndexSelectSql = matchColumns.has('tournament_bracket_index')
    ? 'COALESCE(m.tournament_bracket_index, 1) AS tournament_bracket_index,'
    : '1 AS tournament_bracket_index,';

  const matchResult = await pool.query(
    `SELECT
       l.id AS league_id,
       l.name AS league_name,
       l.type AS league_type,
       l.format,
       l.group_id,
       prog.program_data,
       m.id AS match_id,
       m.is_program,
       m.program_round,
       m.program_block_type,
       ${rosterSelectSql}
       m.bracket,
       ${tournamentBracketIndexSelectSql}
       m.round_number,
       m.match_label,
       m.next_match_id,
       m.next_slot,
       m.loser_next_match_id,
       m.loser_next_slot,
       m.status,
       COALESCE(m.score_a, 0) AS score_a,
       COALESCE(m.score_b, 0) AS score_b,
       pa.id AS participant_a_id,
       pa.group_name AS group_name_a,
       COALESCE(pa.member_id, CASE WHEN matched_a.matched_count = 1 THEN matched_a.user_id ELSE NULL END) AS member_a_id,
       COALESCE(pa.division, '') AS division_a,
       COALESCE(ua.name, ua.email, CASE WHEN matched_a.matched_count = 1 THEN matched_a.name ELSE NULL END, pa.name) AS name_a,
       pb.id AS participant_b_id,
       pb.group_name AS group_name_b,
       COALESCE(pb.member_id, CASE WHEN matched_b.matched_count = 1 THEN matched_b.user_id ELSE NULL END) AS member_b_id,
       COALESCE(pb.division, '') AS division_b,
       COALESCE(ub.name, ub.email, CASE WHEN matched_b.matched_count = 1 THEN matched_b.name ELSE NULL END, pb.name) AS name_b
     FROM leagues l
     JOIN league_matches m ON m.league_id = l.id
     LEFT JOIN league_programs prog ON prog.league_id = l.id
     LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
     LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
     LEFT JOIN users ua ON ua.id = pa.member_id
     LEFT JOIN users ub ON ub.id = pb.member_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(gm.user_id) AS user_id,
         MIN(COALESCE(u2.name, u2.email, pa.name)) AS name,
         COUNT(*)::int AS matched_count
       FROM group_members gm
       JOIN users u2 ON u2.id = gm.user_id
       WHERE gm.group_id = l.group_id
         AND u2.name IS NOT NULL
         AND u2.name = pa.name
     ) matched_a ON pa.member_id IS NULL
     LEFT JOIN LATERAL (
       SELECT
         MIN(gm.user_id) AS user_id,
         MIN(COALESCE(u2.name, u2.email, pb.name)) AS name,
         COUNT(*)::int AS matched_count
       FROM group_members gm
       JOIN users u2 ON u2.id = gm.user_id
       WHERE gm.group_id = l.group_id
         AND u2.name IS NOT NULL
         AND u2.name = pb.name
     ) matched_b ON pb.member_id IS NULL
     WHERE ${leagueFilterSql}
       AND ${scopedDateSql}
     ORDER BY l.start_date ASC, m.created_at ASC, m.match_order ASC`,
    [scopeValue, rangeStart, rangeEnd],
  );

  const leagueRows = new Map();
  const tournamentRows = new Map();
  baseMembers.forEach((base, memberId) => {
    const leagueRow = createSectionRow(base);
    leagueRow.section = "league";
    leagueRows.set(memberId, leagueRow);
    const tournamentRow = createSectionRow(base);
    tournamentRow.section = "tournament";
    tournamentRows.set(memberId, tournamentRow);
  });

  const leagueParticipantSets = new Map();
  const tournamentParticipantSets = new Map();
  const participantsByLeague = new Map();

  participantResult.rows.forEach((row) => {
    const memberId = Number(row.member_id);
    if (!baseMembers.has(memberId)) {
      baseMembers.set(memberId, {
        member_id: memberId,
        division: row.division || null,
        name: row.name,
      });
      const leagueRow = createSectionRow(baseMembers.get(memberId));
      leagueRow.section = "league";
      leagueRows.set(memberId, leagueRow);
      const tournamentRow = createSectionRow(baseMembers.get(memberId));
      tournamentRow.section = "tournament";
      tournamentRows.set(memberId, tournamentRow);
    }

    const leagueParticipants = participantsByLeague.get(row.league_id) ?? [];
    leagueParticipants.push({
      participant_id: row.participant_id,
      member_id: memberId,
      division: row.division || "",
      name: row.name,
      format: row.format || "",
    });
    participantsByLeague.set(row.league_id, leagueParticipants);
  });

  const leagueGroups = new Map();
  const tournamentGroups = new Map();
  const leagueHasRegularPhase = new Set();
  const participantMembers = new Map(
    participantResult.rows.map((row) => [String(row.participant_id), Number(row.member_id)]),
  );

  matchResult.rows.forEach((match) => {
    const entryType = getProgramEntryType(match);
    if (!entryType) return;
    const roundMeta = getProgramRoundMeta(match.program_data, match.program_round);
    const section = roundMeta.format === "TOURNAMENT" || match.bracket ? "tournament" : "league";
    match._rankingFormat = roundMeta.format
      ?? (String(match.format ?? "").includes("조별리그") ? "GROUP" : section === "tournament" ? "TOURNAMENT" : "LEAGUE");
    const matchFormat = section === "tournament"
      ? "tournament"
      : match._rankingFormat === "GROUP" ? "group" : "league";
    const includeMatchPoints = pointRules.matchPoints.eventTypes[entryType] === true
      && pointRules.matchPoints.formats[matchFormat] === true;
    match._rankingOption = roundMeta.option;
    if (String(match.bracket ?? "").toLowerCase().includes("lower")
        || String(match.bracket ?? "").includes("하위")) {
      match._rankingOption = "LOWER";
    }
    if (!match.bracket) {
      leagueHasRegularPhase.add(match.league_id);
    }

    const memberAIds = entryType === "singles"
      ? [Number(match.member_a_id)].filter(Number.isFinite)
      : (match.participant_a_roster_ids ?? []).map((id) => participantMembers.get(String(id))).filter(Number.isFinite);
    const memberBIds = entryType === "singles"
      ? [Number(match.member_b_id)].filter(Number.isFinite)
      : (match.participant_b_roster_ids ?? []).map((id) => participantMembers.get(String(id))).filter(Number.isFinite);
    if (memberAIds.length === 0 || memberBIds.length === 0) return;
    const rankingMemberAIds = memberAIds.filter((memberId) => baseMembers.has(memberId));
    const rankingMemberBIds = memberBIds.filter((memberId) => baseMembers.has(memberId));
    if (rankingMemberAIds.length === 0 && rankingMemberBIds.length === 0) return;
    match._memberAIds = memberAIds;
    match._memberBIds = memberBIds;
    match._rankingMemberAIds = rankingMemberAIds;
    match._rankingMemberBIds = rankingMemberBIds;

    const attendanceSets = section === "tournament" ? tournamentParticipantSets : leagueParticipantSets;
    const attendanceKey = match.league_id;
    [...rankingMemberAIds, ...rankingMemberBIds].forEach((memberId) => {
      if (!attendanceSets.has(memberId)) attendanceSets.set(memberId, new Set());
      attendanceSets.get(memberId).add(attendanceKey);
    });

    if (match.status !== "done") return;

    const scoreA = Number(match.score_a);
    const scoreB = Number(match.score_b);
    const targetRows = section === "league" ? leagueRows : tournamentRows;
    const rowsA = rankingMemberAIds
      .map((memberId) => ensureRow(targetRows, memberId, baseMembers.get(memberId), section))
      .filter(Boolean);
    const rowsB = rankingMemberBIds
      .map((memberId) => ensureRow(targetRows, memberId, baseMembers.get(memberId), section))
      .filter(Boolean);
    if (includeMatchPoints) {
      [...rowsA, ...rowsB].forEach((row) => { row.matches_played += 1; });
      if (pointRules.matchPoints.mode === "win") {
        if (scoreA > scoreB) {
          rowsA.forEach((row) => { row.score_points = roundPoint(row.score_points + pointRules.matchPoints.winPoints / memberAIds.length); });
        } else if (scoreB > scoreA) {
          rowsB.forEach((row) => { row.score_points = roundPoint(row.score_points + pointRules.matchPoints.winPoints / memberBIds.length); });
        }
      } else {
        rowsA.forEach((row) => { row.score_points = roundPoint(row.score_points + scoreA / memberAIds.length); });
        rowsB.forEach((row) => { row.score_points = roundPoint(row.score_points + scoreB / memberBIds.length); });
      }

      if (scoreA > scoreB) {
        rowsA.forEach((row) => { row.wins += 1; });
        rowsB.forEach((row) => { row.losses += 1; });
      } else if (scoreB > scoreA) {
        rowsB.forEach((row) => { row.wins += 1; });
        rowsA.forEach((row) => { row.losses += 1; });
      }
    }

    if (scoreA === scoreB) return;
    const leagueKey = match.league_id;
    if (section === "league") {
      const roundKey = `${leagueKey}:${match.program_round ?? 0}`;
      const groupNameA = entryType === "singles" ? toKey(match.group_name_a) : toKey(match.match_label);
      const groupNameB = entryType === "singles" ? toKey(match.group_name_b) : toKey(match.match_label);
      match._rankingGroupA = groupNameA;
      match._rankingGroupB = groupNameB;
      const divisionKey = match._rankingFormat === "GROUP"
        ? `${roundKey}:${groupNameA}`
        : `${roundKey}:__all__`;
      const existing = leagueGroups.get(divisionKey) ?? [];
      existing.push(match);
      leagueGroups.set(divisionKey, existing);

      if (match._rankingFormat === "GROUP" && groupNameB !== groupNameA) {
        const otherKey = `${roundKey}:${groupNameB}`;
        const otherExisting = leagueGroups.get(otherKey) ?? [];
        otherExisting.push(match);
        leagueGroups.set(otherKey, otherExisting);
      }
    } else {
      const tournamentKey = `${leagueKey}:${match.program_round ?? 0}:${match._rankingOption}:${match.bracket ?? "main"}:${match.tournament_bracket_index ?? 1}`;
      const existing = tournamentGroups.get(tournamentKey) ?? [];
      existing.push(match);
      tournamentGroups.set(tournamentKey, existing);
    }
  });

  participantResult.rows.forEach((row) => {
    if (row.program_data || String(row.league_type ?? "").trim() !== "단식") return;
    const memberId = Number(row.member_id);
    const format = String(row.format ?? "");
    const hasLeaguePhase = format !== "상·하위 토너먼트"
      && (leagueHasRegularPhase.has(row.league_id) || !format.includes("토너먼트"));
    if (hasLeaguePhase) {
      if (!leagueParticipantSets.has(memberId)) leagueParticipantSets.set(memberId, new Set());
      leagueParticipantSets.get(memberId).add(row.league_id);
    }
  });

  leagueParticipantSets.forEach((set, memberId) => {
    const row = ensureRow(leagueRows, memberId, baseMembers.get(memberId), "league");
    row.attendance_count = set.size;
  });
  tournamentParticipantSets.forEach((set, memberId) => {
    const row = ensureRow(tournamentRows, memberId, baseMembers.get(memberId), "tournament");
    row.attendance_count = set.size;
  });

  leagueGroups.forEach((matches, groupKey) => {
    if (matches.length === 0) return;
    const sample = matches[0];
    const statMap = new Map();

    matches.forEach((match) => {
      const divisionKey = groupKey.split(":").at(-1);
      const includeA = divisionKey === "__all__" || match._rankingGroupA === divisionKey;
      const includeB = divisionKey === "__all__" || match._rankingGroupB === divisionKey;
      if (!includeA || !includeB) return;

      const memberAIds = match._memberAIds ?? [];
      const memberBIds = match._memberBIds ?? [];
      const keyA = rankingUnitKey(memberAIds);
      const keyB = rankingUnitKey(memberBIds);
      if (!keyA || !keyB) return;

      if (!statMap.has(keyA)) statMap.set(keyA, { member_ids: memberAIds, name: keyA, wins: 0, losses: 0, score_points: 0, lost_points: 0 });
      if (!statMap.has(keyB)) statMap.set(keyB, { member_ids: memberBIds, name: keyB, wins: 0, losses: 0, score_points: 0, lost_points: 0 });

      const scoreA = Number(match.score_a);
      const scoreB = Number(match.score_b);
      const a = statMap.get(keyA);
      const b = statMap.get(keyB);
      a.score_points += scoreA;
      a.lost_points += scoreB;
      b.score_points += scoreB;
      b.lost_points += scoreA;
      if (scoreA > scoreB) {
        a.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        a.losses += 1;
      }
    });

    const standings = Array.from(statMap.values()).sort(compareStanding);
    const bonusRule = getBonusRule(pointRules, "league", sample._rankingFormat, sample._rankingOption);
    standings.slice(0, 4).forEach((standing, index) => {
      const divisor = standing.member_ids.length;
      standing.member_ids.forEach((memberId) => {
        const row = leagueRows.get(Number(memberId));
        if (row) awardBonus(row, index + 1, bonusRule, divisor);
      });
    });
  });

  tournamentGroups.forEach((matches) => {
    if (matches.length === 0) return;
    const sample = matches[0];
    const statMap = new Map();

    matches.forEach((match) => {
      const memberAIds = match._memberAIds ?? [];
      const memberBIds = match._memberBIds ?? [];
      const keyA = rankingUnitKey(memberAIds);
      const keyB = rankingUnitKey(memberBIds);
      if (!keyA || !keyB) return;

      if (!statMap.has(keyA)) statMap.set(keyA, {
        member_ids: memberAIds,
        name: keyA,
        wins: 0,
        losses: 0,
        score_points: 0,
        lost_points: 0,
        max_round: Number(match.round_number) || 0,
      });
      if (!statMap.has(keyB)) statMap.set(keyB, {
        member_ids: memberBIds,
        name: keyB,
        wins: 0,
        losses: 0,
        score_points: 0,
        lost_points: 0,
        max_round: Number(match.round_number) || 0,
      });

      if (match.status !== "done" || Number(match.score_a) === Number(match.score_b)) return;

      const scoreA = Number(match.score_a);
      const scoreB = Number(match.score_b);
      const a = statMap.get(keyA);
      const b = statMap.get(keyB);
      a.score_points += scoreA;
      a.lost_points += scoreB;
      a.max_round = Math.max(a.max_round, Number(match.round_number) || 0);
      b.score_points += scoreB;
      b.lost_points += scoreA;
      b.max_round = Math.max(b.max_round, Number(match.round_number) || 0);
      if (scoreA > scoreB) {
        a.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        a.losses += 1;
      }
    });

    const completedOutcome = (match) => {
      if (!match || match.status !== "done" || Number(match.score_a) === Number(match.score_b)) return null;
      const aIds = match._memberAIds ?? [];
      const bIds = match._memberBIds ?? [];
      if (aIds.length === 0 || bIds.length === 0) return null;
      return Number(match.score_a) > Number(match.score_b)
        ? { winnerIds: aIds, loserIds: bIds }
        : { winnerIds: bIds, loserIds: aIds };
    };
    const awardMemberRank = (memberIds, rank, rule) => {
      const divisor = memberIds.length;
      memberIds.forEach((memberId) => {
        const row = tournamentRows.get(Number(memberId));
        if (row) awardBonus(row, rank, rule, divisor);
      });
    };
    const bonusRule = getBonusRule(pointRules, "tournament", sample._rankingFormat, sample._rankingOption);
    const finalMatch = matches.find(isFinalMatch)
      ?? [...matches]
        .filter((match) => !isThirdPlaceMatch(match))
        .sort((a, b) => (Number(b.round_number) || 0) - (Number(a.round_number) || 0))[0];
    const finalOutcome = completedOutcome(finalMatch);

    if (finalMatch && finalOutcome) {
      awardMemberRank(finalOutcome.winnerIds, 1, bonusRule);
      awardMemberRank(finalOutcome.loserIds, 2, bonusRule);

      const thirdPlaceMatch = matches.find(isThirdPlaceMatch);
      const thirdPlaceOutcome = completedOutcome(thirdPlaceMatch);
      if (thirdPlaceOutcome) {
        awardMemberRank(thirdPlaceOutcome.winnerIds, 3, bonusRule);
        awardMemberRank(thirdPlaceOutcome.loserIds, 4, bonusRule);
      } else if (!thirdPlaceMatch) {
        matches
          .filter(
            (match) =>
              match.next_match_id === finalMatch.match_id
              && Number(match.round_number) === Number(finalMatch.round_number) - 1,
          )
          .map(completedOutcome)
          .filter(Boolean)
          .forEach((outcome) => awardMemberRank(outcome.loserIds, 3, bonusRule));
      }
      return;
    }

    const standings = Array.from(statMap.values()).sort((a, b) => {
      if ((b.max_round ?? 0) !== (a.max_round ?? 0)) return (b.max_round ?? 0) - (a.max_round ?? 0);
      return compareStanding(a, b);
    });
    standings.slice(0, 4).forEach((standing, index) => {
      awardMemberRank(standing.member_ids, index + 1, bonusRule);
    });
  });

  const leagueRankings = finalizeRows(leagueRows, pointRules);
  const tournamentRankings = finalizeRows(tournamentRows, pointRules);

  return {
    group: {
      id: group.id,
      name: group.name,
      sport: group.sport,
    },
    year: targetYear,
    season_id: selectedSeason?.id ?? null,
    season: selectedSeason,
    seasons,
    point_rules: pointRules,
    no_active_season: noActiveSeason,
    scope: normalizedScope,
    available_years: availableYears,
    league: {
      rankings: leagueRankings,
    },
    tournament: {
      rankings: tournamentRankings,
    },
  };
}

module.exports = {
  getPointRanking,
  ensureDefaultRankingSeasons,
  _test: {
    awardBonus,
    getBonusRule,
    isFinalMatch,
    isThirdPlaceMatch,
    rankingUnitKey,
  },
};
