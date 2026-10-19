function buildTournamentRoundResult(round, matches, participants) {
  const active = matches.filter((match) => match.status !== 'cancelled' && (match.participant_a_id || match.participant_b_id));
  const complete = active.length > 0 && active.every((match) => match.status === 'completed' &&
    ((!match.participant_a_id || !match.participant_b_id) || (match.score_a !== null && match.score_b !== null)));
  const people = new Map(participants.map((participant) => [participant.id, participant]));
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
  const threeSet = round.rules?.match_rule === 'THREE_SET';
  const rows = [...stats.values()].sort((a, b) => tournament
    ? (b.eliminated_round === null ? 1 : 0) - (a.eliminated_round === null ? 1 : 0) || (b.eliminated_round ?? 0) - (a.eliminated_round ?? 0) || b.wins - a.wins
    : (threeSet ? b.sets_for - a.sets_for : b.wins - a.wins) || (b.sets_for - b.sets_against) - (a.sets_for - a.sets_against) || b.sets_for - a.sets_for);
  let lastKey, rank = 0;
  rows.forEach((row, index) => {
    const key = tournament ? `${row.eliminated_round}` : `${threeSet ? row.sets_for : row.wins}:${row.sets_for - row.sets_against}:${row.sets_for}`;
    if (key !== lastKey) rank = index + 1;
    row.rank = rank; lastKey = key;
  });
  const pools = ['GROUP','GROUP_TOURNAMENT'].includes(round.format)
    ? [...new Set(active.map((match) => match.pool_name).filter(Boolean))].map((name) => ({ name, ...buildTournamentRoundResult({ ...round, format: 'LEAGUE' }, active.filter((match) => match.pool_name === name), participants) })) : [];
  return { complete, match_count: active.length, completed_match_count: active.filter((match) => match.status === 'completed').length, standings: rows, matches, pools };
}
module.exports = { buildTournamentRoundResult };
