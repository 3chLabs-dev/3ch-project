import type { LeagueMatch } from "../features/league/leagueApi";

/** A played final and settled podium are sufficient; unfinished opening BYEs are irrelevant. */
export function isTournamentResultReady(matches: LeagueMatch[]): boolean {
  const groups = new Map<string, LeagueMatch[]>();
  const decided = (match: LeagueMatch) => match.status === "done" && match.participant_a_id && match.participant_b_id
    && match.score_a != null && match.score_b != null && match.score_a !== match.score_b;
  const loser = (match: LeagueMatch) => match.score_a! > match.score_b! ? match.participant_b_id : match.participant_a_id;
  for (const match of matches) {
    const key = `${match.bracket ?? "upper"}:${match.tournament_bracket_index ?? 1}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  return groups.size > 0 && [...groups.values()].every(group => {
    if (!group.some(match => match.participant_a_id || match.participant_b_id)) return false;
    const bronze = group.find(match => /3\s*[·./~-]?\s*4위/.test(match.match_label ?? ""));
    const regular = group.filter(match => match !== bronze);
    const lastRound = Math.max(...regular.map(match => match.round_number ?? 1));
    const finals = regular.filter(match => (match.round_number ?? 1) === lastRound);
    const final = finals.length === 1 ? finals[0] : null;
    if (!final || !decided(final)) return false;
    if (bronze) return Boolean(decided(bronze));
    const semis = regular.filter(match => match.next_match_id === final.id
      || (!match.next_match_id && (match.round_number ?? 1) === lastRound - 1));
    const semiLosers = semis.filter(decided).map(loser);
    const entrantCount = new Set(group.flatMap(match => [match.participant_a_id, match.participant_b_id]).filter(Boolean)).size;
    return new Set([final.participant_a_id, final.participant_b_id, ...semiLosers]).size >= Math.min(4, entrantCount);
  });
}
