function tournamentPlacement(matches) {
  const groups = new Map(), ranks = new Map();
  const decided = match => match.status === 'completed' && match.participant_a_id && match.participant_b_id
    && match.score_a != null && match.score_b != null && match.score_a !== match.score_b;
  const result = match => match.score_a > match.score_b
    ? [match.participant_a_id, match.participant_b_id] : [match.participant_b_id, match.participant_a_id];
  for (const match of matches) {
    const key = `${match.bracket ?? 'upper'}:${match.bracket_index ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }
  let complete = groups.size > 0;
  for (const group of groups.values()) {
    if (!group.some(match => match.participant_a_id || match.participant_b_id)) { complete = false; continue; }
    const bronze = group.find(match => /3\s*[·./~-]?\s*4위/.test(match.match_label ?? ''));
    const regular = group.filter(match => match !== bronze);
    const lastRound = Math.max(...regular.map(match => match.round_no ?? 1));
    const finals = regular.filter(match => (match.round_no ?? 1) === lastRound);
    const final = finals.length === 1 ? finals[0] : null;
    if (!final || !decided(final)) { complete = false; continue; }
    const [winner, runnerUp] = result(final);
    ranks.set(winner, 1); ranks.set(runnerUp, 2);
    const semis = regular.filter(match => match.next_match_id === final.id
      || (!match.next_match_id && (match.round_no ?? 1) === lastRound - 1));
    const semiLosers = semis.filter(decided).map(match => result(match)[1]);
    if (bronze) {
      if (!decided(bronze)) { complete = false; continue; }
      const [third, fourth] = result(bronze);
      ranks.set(third, 3); ranks.set(fourth, 4);
    } else {
      for (const loser of semiLosers) ranks.set(loser, 3);
      const entrantCount = new Set(group.flatMap(match => [match.participant_a_id, match.participant_b_id]).filter(Boolean)).size;
      if (new Set([winner, runnerUp, ...semiLosers]).size < Math.min(4, entrantCount)) complete = false;
    }
  }
  return { complete, ranks };
}

function buildTournamentRoundResult(round, matches, participants, options = {}) {
  const active = matches.filter((match) => match.status !== 'cancelled' && (match.participant_a_id || match.participant_b_id)
    && !(match.league_data?.is_no_game && match.status==='pending' && match.score_a==null && match.score_b==null));
  const placement = round.format === 'TOURNAMENT' ? tournamentPlacement(matches.filter(match => match.status !== 'cancelled')) : null;
  const complete = placement ? placement.complete : active.length > 0 && active.every((match) => match.status === 'completed' &&
    ((!match.participant_a_id || !match.participant_b_id) || (match.score_a !== null && match.score_b !== null)));
  const people = new Map(participants.map((participant) => [participant.id, participant]));
  for (const match of active) for (const slot of ['a','b']) {
    const id=match[`participant_${slot}_id`], ids=match.league_data?.[`participant_${slot}_roster_ids`];
    if (!id || !ids?.length || ids.length<2) continue;
    const members=ids.map(personId=>participants.find(p=>p.id===personId)).filter(Boolean);
    if(members.length===ids.length) people.set(id,{...people.get(id),name:match.league_data[`participant_${slot}_name`]??members.map(p=>p.name).join(' · '),member_division:String(members.reduce((sum,p)=>sum+(parseInt(p.member_division)||0),0)),club_name:[...new Set(members.map(p=>p.club_name))].join(' · '),roster:members});
  }
  const stats = new Map();
  const ensure = (id) => {
    if (!id || !people.has(id)) return null;
    if (!stats.has(id)) stats.set(id, { ...people.get(id), played: 0, wins: 0, losses: 0, sets_for: 0, sets_against: 0, eliminated_round: null });
    return stats.get(id);
  };
  for (const match of active) {
    const a = ensure(match.participant_a_id), b = ensure(match.participant_b_id);
    if (match.status !== 'completed' || !a || !b || match.score_a === null || match.score_b === null) continue;
    a.played++; b.played++; a.sets_for += match.score_a; a.sets_against += match.score_b;
    b.sets_for += match.score_b; b.sets_against += match.score_a;
    if (match.score_a === match.score_b) continue;
    const [winner, loser] = match.score_a > match.score_b ? [a, b] : [b, a];
    winner.wins++; loser.losses++; loser.eliminated_round = match.round_no ?? 1;
  }
  const tournament = round.format === 'TOURNAMENT';
  const lowerIds = new Set(tournament ? active.filter((match) => match.bracket === 'lower').flatMap((match) => [match.participant_a_id, match.participant_b_id]).filter(Boolean) : []);
  const threeSet = ['THREE_SET', '3세트제'].includes(round.rules?.match_rule);
  const baseValue = row => threeSet ? row.sets_for : row.wins;
  const tied = new Map();
  if (!tournament) {
    for (const row of stats.values()) {
      const group = tied.get(baseValue(row)) ?? [];
      group.push(row); tied.set(baseValue(row), group);
      row.tie_sets_for = 0; row.tie_sets_against = 0; row.tie_set_diff = '';
    }
    for (const group of tied.values()) {
      if (group.length < 2) continue;
      const ids = new Set(group.map(row => row.id));
      for (const match of active) {
        if (match.status !== 'completed' || match.league_data?.is_no_game || match.score_a == null || match.score_b == null
          || !ids.has(match.participant_a_id) || !ids.has(match.participant_b_id)) continue;
        const a = stats.get(match.participant_a_id), b = stats.get(match.participant_b_id);
        a.tie_sets_for += match.score_a; a.tie_sets_against += match.score_b;
        b.tie_sets_for += match.score_b; b.tie_sets_against += match.score_a;
      }
      for (const row of group) if (row.tie_sets_for || row.tie_sets_against) row.tie_set_diff = `${row.tie_sets_for}/${row.tie_sets_against}`;
    }
  }
  const ratio = row => row.tie_sets_against === 0 ? Infinity : row.tie_sets_for / row.tie_sets_against;
  const compareAutomatic = (a, b) => {
    const base = baseValue(b) - baseValue(a);
    if (base) return base;
    if (threeSet) return b.tie_sets_for - a.tie_sets_for || a.tie_sets_against - b.tie_sets_against;
    const diff = ratio(b) - ratio(a);
    return Number.isNaN(diff) ? 0 : diff;
  };
  const manualIds = options.tieBreaks?.find(entry => entry.round === round.round_no && entry.poolLabel === (options.poolLabel ?? null))?.participantIds ?? [];
  const manualIndex = new Map(manualIds.map((id, index) => [id, index]));
  const brackets = tournament && active.some((match) => match.bracket === 'upper') && active.some((match) => match.bracket === 'lower') ? ['upper','lower'].map((bracket) => ({ name: bracket === 'upper' ? '상위' : '하위', ...buildTournamentRoundResult(round, active.filter((match) => match.bracket === bracket), participants) })) : [];
  const branchRanks = new Map(brackets.flatMap((bracket) => bracket.standings.map((person) => [person.id, person.rank])));
  const rows = [...stats.values()].sort((a, b) => tournament
    ? Number(lowerIds.has(a.id)) - Number(lowerIds.has(b.id)) || (placement.ranks.get(a.id) ?? 999) - (placement.ranks.get(b.id) ?? 999) || (brackets.length ? (branchRanks.get(a.id) ?? 0) - (branchRanks.get(b.id) ?? 0) : 0) || (b.eliminated_round === null ? 1 : 0) - (a.eliminated_round === null ? 1 : 0) || (b.eliminated_round ?? 0) - (a.eliminated_round ?? 0) || b.wins - a.wins
    : compareAutomatic(a, b) || (manualIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  let lastKey, rank = 0;
  rows.forEach((row, index) => {
    const key = tournament ? `${lowerIds.has(row.id) ? "lower" : "upper"}:${brackets.length ? branchRanks.get(row.id) : row.eliminated_round}` : null;
    if (tournament ? key !== lastKey : index === 0 || compareAutomatic(rows[index - 1], row) !== 0
      || manualIndex.has(rows[index - 1].id) || manualIndex.has(row.id)) rank = index + 1;
    row.rank = placement?.ranks.get(row.id) ?? rank; lastKey = key;
  });
  const pools = ['GROUP','GROUP_TOURNAMENT'].includes(round.format)
    ? [...new Set(active.map((match) => match.pool_name).filter(Boolean))].map((name) => ({ name, ...buildTournamentRoundResult({ ...round, format: 'LEAGUE' }, active.filter((match) => match.pool_name === name), participants, { ...options, poolLabel: `${name}조` }) })) : [];
  return { brackets, complete, match_count: active.length, completed_match_count: active.filter((match) => match.status === 'completed').length, standings: rows, matches, pools };
}
module.exports = { buildTournamentRoundResult };
