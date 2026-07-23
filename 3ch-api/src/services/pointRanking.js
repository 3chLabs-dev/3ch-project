const pool = require("../db/pool");

const DEFAULT_POINT_RULES = Object.freeze({
  attendance: { league: 1, tournament: 2 },
  rankings: {
    league: { first: 30, second: 20, thirdFourth: 10 },
    group: { first: 30, second: 15, thirdFourth: 10 },
    tournamentUpper: { first: 50, second: 30, thirdFourth: 20 },
    tournamentLower: { first: 20, second: 10, thirdFourth: 7 },
  },
});

function normalizePointRules(value) {
  const input = value && typeof value === "object" ? value : {};
  const attendance = input.attendance && typeof input.attendance === "object" ? input.attendance : {};
  const rankings = input.rankings && typeof input.rankings === "object" ? input.rankings : {};
  const numberOr = (candidate, fallback) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  const normalizeRankRule = (rule, fallback) => ({
    first: numberOr(rule?.first, fallback.first),
    second: numberOr(rule?.second, fallback.second),
    thirdFourth: numberOr(rule?.thirdFourth, fallback.thirdFourth),
  });
  return {
    attendance: {
      league: numberOr(attendance.league, DEFAULT_POINT_RULES.attendance.league),
      tournament: numberOr(attendance.tournament, DEFAULT_POINT_RULES.attendance.tournament),
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

function awardBonus(row, rank, rule) {
  let points = 0;
  if (rank === 1) points = rule.first;
  else if (rank === 2) points = rule.second;
  else if (rank === 3 || rank === 4) points = rule.thirdFourth;

  row.bonus_points += points;
  if (rank === 1) row.championships += 1;
}

function finalizeRows(sectionMap, pointRules) {
  const rows = Array.from(sectionMap.values());
  rows.forEach((row) => {
    row.attendance_points = row.attendance_count * pointRules.attendance[row.section];
    row.total_points = row.attendance_points + row.score_points + row.bonus_points;
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

async function ensureAutoRenewedSeasons(groupId) {
  const today = new Date().toISOString().slice(0, 10);
  for (let index = 0; index < 24; index += 1) {
    const latestResult = await pool.query(
      `SELECT id, start_date, end_date, auto_renew, point_rules, created_by_id
         FROM group_ranking_seasons
        WHERE group_id = $1
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
        WHERE group_id = $1 AND start_date <= $3::date AND end_date >= $2::date
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

async function getPointRanking(groupId, year, scope, seasonId) {
  const groupResult = await pool.query(
    `SELECT id, name, sport FROM groups WHERE id = $1`,
    [groupId],
  );
  if (groupResult.rowCount === 0) return null;

  const group = groupResult.rows[0];
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
      `SELECT id, name, start_date, end_date, auto_renew, point_rules
         FROM group_ranking_seasons
        WHERE group_id = $1
        ORDER BY start_date DESC, created_at DESC`,
      [groupId],
    )
    : { rows: [] };
  const seasons = seasonResult.rows.map((season) => ({
    id: season.id,
    name: season.name,
    start_date: toDateOnly(season.start_date),
    end_date: toDateOnly(season.end_date),
    auto_renew: Boolean(season.auto_renew),
    point_rules: normalizePointRules(season.point_rules),
  }));
  const today = new Date().toISOString().slice(0, 10);
  const selectedSeason = seasons.find((season) => season.id === seasonId)
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
       m.bracket,
       m.round_number,
       m.match_label,
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
     JOIN league_participants pa ON pa.id = m.participant_a_id
     JOIN league_participants pb ON pb.id = m.participant_b_id
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
       AND COALESCE(pa.member_id, CASE WHEN matched_a.matched_count = 1 THEN matched_a.user_id ELSE NULL END) IS NOT NULL
       AND COALESCE(pb.member_id, CASE WHEN matched_b.matched_count = 1 THEN matched_b.user_id ELSE NULL END) IS NOT NULL
       AND COALESCE(pa.member_id, CASE WHEN matched_a.matched_count = 1 THEN matched_a.user_id ELSE NULL END)
           <> COALESCE(pb.member_id, CASE WHEN matched_b.matched_count = 1 THEN matched_b.user_id ELSE NULL END)
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

  matchResult.rows.forEach((match) => {
    if (!isSinglesEntry(match)) return;
    const roundMeta = getProgramRoundMeta(match.program_data, match.program_round);
    const section = roundMeta.format === "TOURNAMENT" || match.bracket ? "tournament" : "league";
    match._rankingFormat = roundMeta.format
      ?? (String(match.format ?? "").includes("조별리그") ? "GROUP" : section === "tournament" ? "TOURNAMENT" : "LEAGUE");
    match._rankingOption = roundMeta.option;
    if (String(match.bracket ?? "").toLowerCase().includes("lower")
        || String(match.bracket ?? "").includes("하위")) {
      match._rankingOption = "LOWER";
    }
    if (!match.bracket) {
      leagueHasRegularPhase.add(match.league_id);
    }

    const memberAId = Number(match.member_a_id);
    const memberBId = Number(match.member_b_id);

    const attendanceSets = section === "tournament" ? tournamentParticipantSets : leagueParticipantSets;
    if (!attendanceSets.has(memberAId)) attendanceSets.set(memberAId, new Set());
    if (!attendanceSets.has(memberBId)) attendanceSets.set(memberBId, new Set());
    const attendanceKey = match.league_id;
    attendanceSets.get(memberAId).add(attendanceKey);
    attendanceSets.get(memberBId).add(attendanceKey);

    if (match.status !== "done" || Number(match.score_a) === Number(match.score_b)) {
      return;
    }

    const scoreA = Number(match.score_a);
    const scoreB = Number(match.score_b);
    const rowA = ensureRow(section === "league" ? leagueRows : tournamentRows, memberAId, baseMembers.get(memberAId), section);
    const rowB = ensureRow(section === "league" ? leagueRows : tournamentRows, memberBId, baseMembers.get(memberBId), section);

    rowA.matches_played += 1;
    rowB.matches_played += 1;
    rowA.score_points += scoreA;
    rowB.score_points += scoreB;

    if (scoreA > scoreB) {
      rowA.wins += 1;
      rowB.losses += 1;
    } else {
      rowB.wins += 1;
      rowA.losses += 1;
    }

    const leagueKey = match.league_id;
    if (section === "league") {
      const roundKey = `${leagueKey}:${match.program_round ?? 0}`;
      const divisionKey = match._rankingFormat === "GROUP"
        ? `${roundKey}:${toKey(match.group_name_a)}`
        : `${roundKey}:__all__`;
      const existing = leagueGroups.get(divisionKey) ?? [];
      existing.push(match);
      leagueGroups.set(divisionKey, existing);

      if (match._rankingFormat === "GROUP" && toKey(match.group_name_b) !== toKey(match.group_name_a)) {
        const otherKey = `${roundKey}:${toKey(match.group_name_b)}`;
        const otherExisting = leagueGroups.get(otherKey) ?? [];
        otherExisting.push(match);
        leagueGroups.set(otherKey, otherExisting);
      }
    } else {
      const tournamentKey = `${leagueKey}:${match.program_round ?? 0}:${match._rankingOption}:${match.bracket ?? "main"}`;
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
      const includeA = divisionKey === "__all__" || toKey(match.group_name_a) === divisionKey;
      const includeB = divisionKey === "__all__" || toKey(match.group_name_b) === divisionKey;
      if (!includeA || !includeB) return;

      const memberAId = Number(match.member_a_id);
      const memberBId = Number(match.member_b_id);
      const baseA = baseMembers.get(memberAId);
      const baseB = baseMembers.get(memberBId);
      if (!baseA || !baseB) return;

      if (!statMap.has(memberAId)) statMap.set(memberAId, { ...baseA, wins: 0, losses: 0, score_points: 0, lost_points: 0 });
      if (!statMap.has(memberBId)) statMap.set(memberBId, { ...baseB, wins: 0, losses: 0, score_points: 0, lost_points: 0 });

      const scoreA = Number(match.score_a);
      const scoreB = Number(match.score_b);
      const a = statMap.get(memberAId);
      const b = statMap.get(memberBId);
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
      const row = leagueRows.get(Number(standing.member_id));
      if (row) awardBonus(row, index + 1, bonusRule);
    });
  });

  tournamentGroups.forEach((matches) => {
    if (matches.length === 0) return;
    const sample = matches[0];
    const statMap = new Map();

    matches.forEach((match) => {
      const memberAId = Number(match.member_a_id);
      const memberBId = Number(match.member_b_id);
      const baseA = baseMembers.get(memberAId);
      const baseB = baseMembers.get(memberBId);
      if (!baseA || !baseB) return;

      if (!statMap.has(memberAId)) statMap.set(memberAId, {
        ...baseA,
        wins: 0,
        losses: 0,
        score_points: 0,
        lost_points: 0,
        max_round: Number(match.round_number) || 0,
      });
      if (!statMap.has(memberBId)) statMap.set(memberBId, {
        ...baseB,
        wins: 0,
        losses: 0,
        score_points: 0,
        lost_points: 0,
        max_round: Number(match.round_number) || 0,
      });

      if (match.status !== "done" || Number(match.score_a) === Number(match.score_b)) return;

      const scoreA = Number(match.score_a);
      const scoreB = Number(match.score_b);
      const a = statMap.get(memberAId);
      const b = statMap.get(memberBId);
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

    const standings = Array.from(statMap.values()).sort((a, b) => {
      if ((b.max_round ?? 0) !== (a.max_round ?? 0)) return (b.max_round ?? 0) - (a.max_round ?? 0);
      return compareStanding(a, b);
    });
    const bonusRule = getBonusRule(pointRules, "tournament", sample._rankingFormat, sample._rankingOption);
    standings.slice(0, 4).forEach((standing, index) => {
      const row = tournamentRows.get(Number(standing.member_id));
      if (row) awardBonus(row, index + 1, bonusRule);
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
};
