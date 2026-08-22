import type { LeagueMatch, LeagueParticipantItem } from "../features/league/leagueApi";

export interface RoundRobinPlayerStats {
  wins: number;
  losses: number;
  setTotal: number;
  hasPlayed: boolean;
}

export interface RoundRobinStandings {
  playerStats: RoundRobinPlayerStats[];
  rankings: number[];
  tieSetDiffs: string[];
  unresolvedTieGroups: string[][];
  rankingOrder: string[];
  allMatchesComplete: boolean;
}

function divisionNumber(division?: string | null): number {
  const parsed = Number.parseInt(String(division ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER;
}

export function calculateRoundRobinStandings(
  players: LeagueParticipantItem[],
  matches: LeagueMatch[],
  rules?: string | null,
  manualParticipantOrder: string[] = [],
): RoundRobinStandings {
  const isThreeSetRule = rules === "THREE_SET" || rules === "3세트제";
  const playerStats = players.map((player) => {
    let wins = 0;
    let losses = 0;
    let setTotal = 0;
    for (const match of matches) {
      if (match.status !== "done") continue;
      const isA = match.participant_a_id === player.id;
      const isB = match.participant_b_id === player.id;
      if (!isA && !isB) continue;
      const myScore = Number(isA ? match.score_a ?? 0 : match.score_b ?? 0);
      const opponentScore = Number(isA ? match.score_b ?? 0 : match.score_a ?? 0);
      setTotal += myScore;
      if (myScore > opponentScore) wins += 1;
      else losses += 1;
    }
    return { wins, losses, setTotal, hasPlayed: wins + losses > 0 };
  });

  const count = players.length;
  const baseValue = (index: number) => isThreeSetRule
    ? playerStats[index]?.setTotal ?? 0
    : playerStats[index]?.wins ?? 0;
  const byBaseValue = new Map<number, number[]>();
  players.forEach((_, index) => {
    const value = baseValue(index);
    byBaseValue.set(value, [...(byBaseValue.get(value) ?? []), index]);
  });

  const tieWon = new Array<number>(count).fill(0);
  const tieLost = new Array<number>(count).fill(0);
  const isTied = new Array<boolean>(count).fill(false);
  for (const group of byBaseValue.values()) {
    if (group.length < 2) continue;
    const groupIds = new Set(group.map((index) => players[index].id));
    for (const index of group) {
      isTied[index] = true;
      const playerId = players[index].id;
      for (const match of matches) {
        if (match.status !== "done") continue;
        const isA = match.participant_a_id === playerId;
        const isB = match.participant_b_id === playerId;
        if (!isA && !isB) continue;
        const opponentId = isA ? match.participant_b_id : match.participant_a_id;
        if (!opponentId || !groupIds.has(opponentId)) continue;
        tieWon[index] += Number(isA ? match.score_a ?? 0 : match.score_b ?? 0);
        tieLost[index] += Number(isA ? match.score_b ?? 0 : match.score_a ?? 0);
      }
    }
  }

  const ratio = (index: number) => tieLost[index] === 0 ? Infinity : tieWon[index] / tieLost[index];
  const compareAutomatic = (left: number, right: number) => {
    const baseDiff = baseValue(right) - baseValue(left);
    if (baseDiff !== 0) return baseDiff;
    if (isThreeSetRule) {
      if (tieWon[left] !== tieWon[right]) return tieWon[right] - tieWon[left];
      if (tieLost[left] !== tieLost[right]) return tieLost[left] - tieLost[right];
    } else {
      const ratioDiff = ratio(right) - ratio(left);
      if (ratioDiff !== 0 && !Number.isNaN(ratioDiff)) return ratioDiff;
    }
    return divisionNumber(players[right].division) - divisionNumber(players[left].division);
  };

  const manualIndex = new Map(manualParticipantOrder.map((id, index) => [id, index]));
  const indices = players.map((_, index) => index).sort((left, right) => {
    const automaticDiff = compareAutomatic(left, right);
    if (automaticDiff !== 0) return automaticDiff;
    const manualDiff = (manualIndex.get(players[left].id) ?? Number.MAX_SAFE_INTEGER)
      - (manualIndex.get(players[right].id) ?? Number.MAX_SAFE_INTEGER);
    return manualDiff || left - right;
  });

  const activeMatches = matches.filter((match) => !match.is_no_game);
  const allMatchesComplete = activeMatches.length > 0
    && activeMatches.every((match) => match.status === "done");
  const unresolvedTieGroups: string[][] = [];
  if (allMatchesComplete) {
    let group: number[] = [];
    indices.forEach((index) => {
      if (group.length === 0 || compareAutomatic(group[0], index) === 0) {
        group.push(index);
      } else {
        if (group.length > 1) unresolvedTieGroups.push(group.map((item) => players[item].id));
        group = [index];
      }
    });
    if (group.length > 1) unresolvedTieGroups.push(group.map((item) => players[item].id));
  }

  const rankings = new Array<number>(count).fill(0);
  indices.forEach((playerIndex, rankIndex) => { rankings[playerIndex] = rankIndex + 1; });
  const tieSetDiffs = players.map((_, index) => {
    if (!isTied[index] || !playerStats[index].hasPlayed) return "";
    if (tieWon[index] === 0 && tieLost[index] === 0) return "";
    return `${tieWon[index]}/${tieLost[index]}`;
  });

  return {
    playerStats,
    rankings,
    tieSetDiffs,
    unresolvedTieGroups,
    rankingOrder: indices.map((index) => players[index].id),
    allMatchesComplete,
  };
}
