import type { LeagueMatch, LeagueParticipantItem } from "../features/league/leagueApi";
import { distributeSnake } from "../features/league/algorithms/distributeSnake";
import type { FormationAssignmentPlayer, ProgramBlock, ProgramOption } from "../features/league/types/tournament.types";
import { generateRoundRobin } from "./leagueUtils";

export type ProgramMatchPatch = Partial<Pick<
  LeagueMatch,
  | "score_a"
  | "score_b"
  | "status"
  | "court"
  | "participant_a_id"
  | "participant_a_name"
  | "participant_a_division"
  | "participant_b_id"
  | "participant_b_name"
  | "participant_b_division"
>>;

type ProgramPlayer = {
  id: string;
  name: string;
  division: string | null;
  level: number;
  seedLabel?: string;
};

type MatchUnit = {
  id: string | null;
  name: string | null;
  division?: string | null;
  level?: number;
  roster?: string[];
  rosterDetails?: Array<{ name: string; division: string | null }>;
  seedLabel?: string;
};

function toProgramPlayers(participants: LeagueParticipantItem[]): ProgramPlayer[] {
  return [...participants]
    .map((participant) => {
      const level = Number.parseInt(participant.division ?? "", 10);
      return {
        id: participant.id,
        name: participant.name,
        division: participant.division ?? null,
        level: Number.isNaN(level) ? 999 : level,
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function seededBracket(n: number): number[] {
  function buildPrimary(size: number): number[] {
    if (size === 2) return [1];
    const prev = buildPrimary(size / 2);
    const half = size / 2;
    const result: number[] = [];
    for (let i = 0; i < prev.length; i += 1) {
      const seed = prev[i];
      const complement = half + 1 - seed;
      if (i % 2 === 0) result.push(seed, complement);
      else result.push(complement, seed);
    }
    return result;
  }

  const primary = buildPrimary(n);
  const result: number[] = [];
  for (const seed of primary) result.push(seed, n + 1 - seed);
  return result;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function shuffleStable<T>(items: T[], seed: string) {
  const random = seededRandom(seed);
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function rotateBySeed<T>(items: T[], seed: number) {
  if (items.length < 2) return items;
  const offset = seed % items.length || 1;
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  return Math.floor(seed / items.length) % 2 === 1
    ? rotated.reverse()
    : rotated;
}

function shuffleWithinLevel<T extends { level?: number; name?: string | null; id?: string | null }>(
  items: T[],
  seed?: number,
) {
  if (seed == null) return items;
  const buckets = new Map<number, T[]>();
  items.forEach((item) => {
    const level = item.level ?? 999;
    buckets.set(level, [...(buckets.get(level) ?? []), item]);
  });
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
}

function makeMatch(
  id: string,
  order: number,
  a: { id: string | null; name: string | null; division?: string | null; seedLabel?: string },
  b: { id: string | null; name: string | null; division?: string | null; seedLabel?: string },
  roundNumber?: number,
  bracket?: string | null,
  label?: string,
): LeagueMatch {
  const match = {
    id,
    match_order: order,
    participant_a_id: a.id,
    participant_b_id: b.id,
    participant_a_name: a.name,
    participant_a_division: a.division ?? null,
    participant_b_name: b.name,
    participant_b_division: b.division ?? null,
    score_a: null,
    score_b: null,
    court: null,
    status: "pending",
    bracket,
    round_number: roundNumber,
    match_label: label ?? null,
    next_match_id: null,
    next_slot: null,
    loser_next_match_id: null,
    loser_next_slot: null,
    participant_a_seed_label: a.seedLabel ?? null,
    participant_b_seed_label: b.seedLabel ?? null,
  };
  const unitA = a as MatchUnit;
  const unitB = b as MatchUnit;
  return {
    ...match,
    ...(unitA.roster ? { participant_a_roster: unitA.roster } : {}),
    ...(unitB.roster ? { participant_b_roster: unitB.roster } : {}),
    ...(unitA.rosterDetails ? { participant_a_roster_details: unitA.rosterDetails } : {}),
    ...(unitB.rosterDetails ? { participant_b_roster_details: unitB.rosterDetails } : {}),
  } as LeagueMatch;
}

function buildRoundRobinMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: ProgramPlayer[],
  groupName?: string,
): LeagueMatch[] {
  return generateRoundRobin(players.length).map(([leftIndex, rightIndex], index) =>
    makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "all"}-${index + 1}`,
      index + 1,
      players[leftIndex],
      players[rightIndex],
      roundIndex + 1,
      null,
      block.format === "GROUP" && groupName ? groupName : undefined,
    )
  );
}

function pairLabel(players: ProgramPlayer[]) {
  return players.map((player) => player.name).join(" / ");
}

function toDoublesUnits(players: ProgramPlayer[]): MatchUnit[] {
  const units = [];
  for (let i = 0; i < players.length; i += 2) {
    const unit = players.slice(i, i + 2);
    if (unit.length === 2) units.push(unit);
  }

  return units.map((unit, index) => ({
    id: unit.map((player) => player.id).join("+"),
    name: `페어 ${pairLabel(unit)}`,
    division: null,
    level: index + 1,
    roster: unit.map((player) => player.name),
    rosterDetails: unit.map((player) => ({
      name: player.name,
      division: player.division,
    })),
  }));
}

function toTeamUnitsFromGroupSizes(
  players: ProgramPlayer[],
  groupSizes: number[],
): MatchUnit[] {
  return distributeSnake(players, groupSizes)
    .filter((group) => group.players.length > 0)
    .map((group, index) => {
      const roster = group.players as ProgramPlayer[];
      const leader = roster[0];
      return {
        id: roster.map((player) => player.id).join("+"),
        name: `팀 ${leader.name}`,
        division: leader.division,
        level: index + 1,
        roster: roster.map((player) => player.name),
        rosterDetails: roster.map((player) => ({
          name: player.name,
          division: player.division,
        })),
      };
    });
}

function assignedPlayers(
  assignments: FormationAssignmentPlayer[][],
  players: ProgramPlayer[],
): ProgramPlayer[][] {
  return assignments.map((group) => group.flatMap((assigned) => {
    const player = players.find((candidate) => candidate.name === assigned.name && candidate.level === assigned.level)
      ?? players.find((candidate) => candidate.name === assigned.name);
    return player ? [player] : [];
  }));
}

function teamUnitsFromAssignments(
  assignments: FormationAssignmentPlayer[][],
  players: ProgramPlayer[],
): MatchUnit[] {
  return assignedPlayers(assignments, players)
    .filter((roster) => roster.length > 0)
    .map((roster, index) => ({
      id: roster.map((player) => player.id).join("+"),
      name: `팀 ${roster[0].name}`,
      division: roster[0].division,
      level: index + 1,
      roster: roster.map((player) => player.name),
      rosterDetails: roster.map((player) => ({ name: player.name, division: player.division })),
    }));
}

function assignedTeamGroups(
  assignments: FormationAssignmentPlayer[][],
  units: MatchUnit[],
): MatchUnit[][] {
  return assignments.map((group) => group.flatMap((assigned) => {
    const rosterNames = assigned.roster?.map((member) => member.name) ?? [];
    const unit = units.find((candidate) =>
      rosterNames.length > 0
        ? rosterNames.every((name) => candidate.roster?.includes(name))
        : candidate.name?.includes(assigned.name),
    );
    return unit ? [unit] : [];
  }));
}

function buildUnitRoundRobinMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  units: MatchUnit[],
  groupName?: string,
): LeagueMatch[] {
  return generateRoundRobin(units.length).map(([leftIndex, rightIndex], index) =>
    makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "units"}-${index + 1}`,
      index + 1,
      units[leftIndex],
      units[rightIndex],
      roundIndex + 1,
      null,
      block.format === "GROUP" && groupName ? groupName : undefined,
    )
  );
}

function buildTournamentSlots(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: MatchUnit[],
  forcedSeeding?: "manual" | "seed" | "random",
) {
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, players.length)));
  const emptySlots = Array.from<MatchUnit | null>({ length: bracketSize }).fill(null);
  const seeding = forcedSeeding ?? block.tournamentSeeding ?? "seed";

  if (seeding === "manual") {
    return emptySlots;
  }

  const orderedPlayers = seeding === "random"
    ? shuffleStable(players, `${leagueId}-r${roundIndex + 1}-${players.map((player) => player.id).join("|")}`)
    : players;
  const seedPositions = seededBracket(bracketSize);
  const slots = [...emptySlots];

  orderedPlayers.forEach((player, index) => {
    const seedNumber = index + 1;
    const slotIndex = seedPositions.indexOf(seedNumber);
    if (slotIndex >= 0) slots[slotIndex] = player;
  });

  return slots;
}

function getTournamentRoundLabel(bracketSize: number, bracketRound: number) {
  const roundSize = bracketSize / 2 ** (bracketRound - 1);
  return roundSize <= 2 ? "결승" : `${roundSize}강`;
}

function buildTournamentMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: MatchUnit[],
  forcedSeeding?: "manual" | "seed" | "random",
  bracketIndex = 1,
): LeagueMatch[] {
  const matches: LeagueMatch[] = [];
  const slots = buildTournamentSlots(leagueId, roundIndex, block, players, forcedSeeding);
  const bracketSize = slots.length;
  let previousRoundIds: string[] = [];

  for (let bracketRound = 1, matchCount = bracketSize / 2; matchCount >= 1; bracketRound += 1, matchCount /= 2) {
    const currentRoundIds: string[] = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const matchId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-r${bracketRound}-m${matchIndex + 1}`;
      currentRoundIds.push(matchId);

      const isFirstRound = bracketRound === 1;
      const a = isFirstRound
        ? slots[matchIndex * 2] ?? { id: null, name: null, division: null }
        : { id: null, name: null, division: null };
      const b = isFirstRound
        ? slots[matchIndex * 2 + 1] ?? { id: null, name: null, division: null }
        : { id: null, name: null, division: null };
      const match = makeMatch(
        matchId,
        matchIndex + 1,
        a,
        b,
        bracketRound,
        "upper",
        getTournamentRoundLabel(bracketSize, bracketRound),
      );
      matches.push({ ...match, tournament_bracket_index: bracketIndex });
    }

    previousRoundIds.forEach((previousId, previousIndex) => {
      const parentId = currentRoundIds[Math.floor(previousIndex / 2)];
      const previousMatch = matches.find((match) => match.id === previousId);
      if (previousMatch) {
        previousMatch.next_match_id = parentId;
        previousMatch.next_slot = previousIndex % 2 === 0 ? "a" : "b";
      }
    });
    previousRoundIds = currentRoundIds;
  }

  return matches;
}

function splitTournamentUnits(units: MatchUnit[], bracketCount: number): MatchUnit[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, units.length));
  const brackets = Array.from({ length: count }, () => [] as MatchUnit[]);
  units.forEach((unit, index) => brackets[index % count].push(unit));
  return brackets.filter((bracket) => bracket.length > 0);
}

function isPrelimToFinal(option: ProgramOption | null, round: number) {
  const currentRound = option?.rounds?.[round - 1];
  const previousRound = option?.rounds?.[round - 2];
  const currentBlock = option?.blocks?.[round - 1];
  const previousBlock = option?.blocks?.[round - 2];

  return (
    round > 1 &&
    currentRound?.option === "FINAL" &&
    previousRound?.option === "PRELIM" &&
    currentBlock?.type === "SINGLES" &&
    currentBlock?.format === "TOURNAMENT" &&
    previousBlock?.type === "SINGLES"
  );
}

function getRankedPlayersFromPreviousRound(
  players: ProgramPlayer[],
  sourceMatches: LeagueMatch[],
  previousRound: number,
): ProgramPlayer[] | null {
  const previousMatches = sourceMatches.filter(
    (match) =>
      (match.program_round ?? match.round_number) === previousRound &&
      !match.bracket &&
      match.participant_a_id &&
      match.participant_b_id,
  );

  if (previousMatches.length === 0 || previousMatches.some((match) => match.status !== "done")) {
    return null;
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const playerIndex = new Map(players.map((player, index) => [player.id, index]));
  const stats = new Map<string, { wins: number; losses: number; setTotal: number; played: number }>();
  players.forEach((player) => stats.set(player.id, { wins: 0, losses: 0, setTotal: 0, played: 0 }));

  previousMatches.forEach((match) => {
    const aId = match.participant_a_id;
    const bId = match.participant_b_id;
    if (!aId || !bId || !playerById.has(aId) || !playerById.has(bId)) return;

    const scoreA = match.score_a ?? 0;
    const scoreB = match.score_b ?? 0;
    const aStats = stats.get(aId)!;
    const bStats = stats.get(bId)!;
    aStats.played += 1;
    bStats.played += 1;
    aStats.setTotal += scoreA;
    bStats.setTotal += scoreB;

    if (scoreA > scoreB) {
      aStats.wins += 1;
      bStats.losses += 1;
    } else if (scoreB > scoreA) {
      bStats.wins += 1;
      aStats.losses += 1;
    }
  });

  const byWins = new Map<number, ProgramPlayer[]>();
  players.forEach((player) => {
    const wins = stats.get(player.id)?.wins ?? 0;
    byWins.set(wins, [...(byWins.get(wins) ?? []), player]);
  });

  const tieWon = new Map<string, number>();
  const tieLost = new Map<string, number>();
  players.forEach((player) => {
    tieWon.set(player.id, 0);
    tieLost.set(player.id, 0);
  });

  for (const group of byWins.values()) {
    if (group.length < 2) continue;
    const groupIds = new Set(group.map((player) => player.id));
    previousMatches.forEach((match) => {
      const aId = match.participant_a_id;
      const bId = match.participant_b_id;
      if (!aId || !bId || !groupIds.has(aId) || !groupIds.has(bId)) return;
      const scoreA = match.score_a ?? 0;
      const scoreB = match.score_b ?? 0;
      tieWon.set(aId, (tieWon.get(aId) ?? 0) + scoreA);
      tieLost.set(aId, (tieLost.get(aId) ?? 0) + scoreB);
      tieWon.set(bId, (tieWon.get(bId) ?? 0) + scoreB);
      tieLost.set(bId, (tieLost.get(bId) ?? 0) + scoreA);
    });
  }

  return [...players].sort((left, right) => {
    const leftStats = stats.get(left.id)!;
    const rightStats = stats.get(right.id)!;
    if (leftStats.wins !== rightStats.wins) return rightStats.wins - leftStats.wins;

    const leftTieLost = tieLost.get(left.id) ?? 0;
    const rightTieLost = tieLost.get(right.id) ?? 0;
    const leftRatio = leftTieLost === 0 ? Infinity : (tieWon.get(left.id) ?? 0) / leftTieLost;
    const rightRatio = rightTieLost === 0 ? Infinity : (tieWon.get(right.id) ?? 0) / rightTieLost;
    if (leftRatio !== rightRatio) return rightRatio - leftRatio;

    return (playerIndex.get(left.id) ?? 0) - (playerIndex.get(right.id) ?? 0);
  });
}

function getRankedGroupsFromPreviousRound(
  players: ProgramPlayer[],
  sourceMatches: LeagueMatch[],
  previousRound: number,
): ProgramPlayer[][] | null {
  const previousMatches = sourceMatches.filter(
    (match) =>
      (match.program_round ?? match.round_number) === previousRound &&
      !match.bracket &&
      match.match_label &&
      match.participant_a_id &&
      match.participant_b_id,
  );
  if (previousMatches.length === 0 || previousMatches.some((match) => match.status !== "done")) return null;

  const labels = [...new Set(previousMatches.map((match) => match.match_label as string))].sort();
  const playerById = new Map(players.map((player) => [player.id, player]));
  return labels.map((label) => {
    const labelMatches = previousMatches.filter((match) => match.match_label === label);
    const ids = new Set(labelMatches.flatMap((match) => [match.participant_a_id, match.participant_b_id]).filter(Boolean) as string[]);
    const groupPlayers = [...ids].flatMap((id) => {
      const player = playerById.get(id);
      return player ? [player] : [];
    });
    return getRankedPlayersFromPreviousRound(groupPlayers, labelMatches, previousRound) ?? groupPlayers;
  }).filter((group) => group.length > 0);
}

function distributeRankedGroupsToBrackets(
  rankedGroups: ProgramPlayer[][],
  bracketCount: number,
): ProgramPlayer[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, rankedGroups.flat().length));
  const brackets = Array.from({ length: count }, () => [] as ProgramPlayer[]);
  rankedGroups.forEach((group, groupIndex) => {
    group.forEach((player, rankIndex) => {
      brackets[(groupIndex + rankIndex) % count].push({
        ...player,
        seedLabel: `${groupIndex + 1}-${rankIndex + 1}`,
      });
    });
  });
  return brackets.filter((bracket) => bracket.length > 0);
}

function buildRankPlaceholders(
  groupSizes: number[],
  bracketCount: number,
): MatchUnit[][] {
  const groups: ProgramPlayer[][] = groupSizes.map((size, groupIndex) =>
    Array.from({ length: size }, (_, rankIndex) => ({
      id: `placeholder-${groupIndex + 1}-${rankIndex + 1}`,
      name: `${groupIndex + 1}조 ${rankIndex + 1}위`,
      division: null,
      level: rankIndex + 1,
      seedLabel: `${groupIndex + 1}-${rankIndex + 1}`,
    })),
  );
  return distributeRankedGroupsToBrackets(groups, bracketCount).map((bracket) =>
    bracket.map((player) => ({ ...player, id: null })),
  );
}

export function getStoredProgramOption(leagueId: string): ProgramOption | null {
  try {
    const raw = localStorage.getItem(`league-program-${leagueId}`);
    return raw ? (JSON.parse(raw) as ProgramOption) : null;
  } catch {
    return null;
  }
}

function getProgramMatchStateKey(leagueId: string, round: number) {
  return `league-program-match-state-${leagueId}-r${round}`;
}

export function readProgramMatchState(leagueId: string, round: number): Record<string, ProgramMatchPatch> {
  try {
    const raw = localStorage.getItem(getProgramMatchStateKey(leagueId, round));
    return raw ? (JSON.parse(raw) as Record<string, ProgramMatchPatch>) : {};
  } catch {
    return {};
  }
}

function writeProgramMatchState(leagueId: string, round: number, state: Record<string, ProgramMatchPatch>) {
  localStorage.setItem(getProgramMatchStateKey(leagueId, round), JSON.stringify(state));
}

export function saveProgramMatchPatch(leagueId: string, round: number, matchId: string, patch: ProgramMatchPatch) {
  const state = readProgramMatchState(leagueId, round);
  state[matchId] = { ...(state[matchId] ?? {}), ...patch };
  writeProgramMatchState(leagueId, round, state);
  return state;
}

export function clearProgramMatchState(leagueId: string, round: number) {
  localStorage.removeItem(getProgramMatchStateKey(leagueId, round));
}

export function applyProgramMatchState(matches: LeagueMatch[], leagueId: string, round: number): LeagueMatch[] {
  const state = readProgramMatchState(leagueId, round);
  return matches.map((match) => (state[match.id] ? { ...match, ...state[match.id] } : match));
}

function getTournamentWinner(match: LeagueMatch) {
  if (match.status !== "done") return null;

  const scoreA = match.score_a;
  const scoreB = match.score_b;
  const hasScoreA = typeof scoreA === "number";
  const hasScoreB = typeof scoreB === "number";
  const winnerSlot = hasScoreA && hasScoreB && scoreA !== scoreB
    ? scoreA > scoreB ? "a" : "b"
    : match.participant_a_id && !match.participant_b_id ? "a"
    : match.participant_b_id && !match.participant_a_id ? "b"
    : null;

  if (!winnerSlot) return null;
  return winnerSlot === "a"
    ? {
        id: match.participant_a_id,
        name: match.participant_a_name,
        division: match.participant_a_division,
      }
    : {
        id: match.participant_b_id,
        name: match.participant_b_name,
        division: match.participant_b_division,
      };
}

export function applyProgramTournamentAdvancement(matches: LeagueMatch[]): LeagueMatch[] {
  const matchMap = new Map(matches.map((match) => [match.id, { ...match }]));
  const orderedMatches = [...matchMap.values()].sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0));

  orderedMatches.forEach((match) => {
    if (!match.next_match_id || !match.next_slot) return;
    const parent = matchMap.get(match.next_match_id);
    if (!parent) return;

    const winner = getTournamentWinner(match);
    if (!winner) return;

    if (match.next_slot === "a") {
      parent.participant_a_id = winner.id;
      parent.participant_a_name = winner.name;
      parent.participant_a_division = winner.division;
    } else {
      parent.participant_b_id = winner.id;
      parent.participant_b_name = winner.name;
      parent.participant_b_division = winner.division;
    }
  });

  return matches.map((match) => matchMap.get(match.id) ?? match);
}

export function generateProgramRoundMatches(
  leagueId: string,
  option: ProgramOption | null,
  participants: LeagueParticipantItem[],
  round: number,
  sourceMatches: LeagueMatch[] = [],
): LeagueMatch[] {
  const block = option?.blocks?.[round - 1];
  if (!block || participants.length < 2) return [];

  const players = toProgramPlayers(participants);
  const defaultFormationSeed = round * 1000;
  const teamFormationPlayers = shuffleWithinLevel(players, block.teamShuffleSeed ?? defaultFormationSeed + 101);
  const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
  const matchUnits: MatchUnit[] = block.type === "TEAM"
    ? block.teamAssignments?.length
      ? teamUnitsFromAssignments(block.teamAssignments, players)
      : toTeamUnitsFromGroupSizes(teamFormationPlayers, groupSizes)
    : block.type === "DOUBLES"
      ? toDoublesUnits(players)
      : players;

  if (matchUnits.length < 2) {
    return [];
  }

  if (block.format === "TOURNAMENT") {
    if (isPrelimToFinal(option, round) && block.type === "SINGLES") {
      const rankedPlayers = getRankedPlayersFromPreviousRound(players, sourceMatches, round - 1);
      const bracketCount = block.tournamentBracketCount ?? 1;
      const rankedGroups = bracketCount > 1
        ? getRankedGroupsFromPreviousRound(players, sourceMatches, round - 1)
        : null;
      const ranked = rankedPlayers ?? players;
      const previousGroupSizes = option?.blocks?.[round - 2]?.groupSizes ?? option?.groupSizes ?? [];
      const placeholderBrackets = !rankedPlayers && bracketCount > 1 && previousGroupSizes.length > 1
        ? buildRankPlaceholders(previousGroupSizes, bracketCount)
        : null;
      const tournamentBrackets: MatchUnit[][] = rankedGroups?.length
        ? distributeRankedGroupsToBrackets(rankedGroups, bracketCount)
        : placeholderBrackets?.length
          ? placeholderBrackets
        : splitTournamentUnits(ranked, bracketCount);
      return tournamentBrackets.flatMap((bracketPlayers, bracketIndex) =>
        buildTournamentMatches(
          leagueId,
          round - 1,
          block,
          bracketPlayers,
          rankedPlayers || placeholderBrackets ? "seed" : "manual",
          bracketIndex + 1,
        ),
      );
    }

    return splitTournamentUnits(matchUnits, block.tournamentBracketCount ?? 1).flatMap((bracketPlayers, bracketIndex) =>
      buildTournamentMatches(leagueId, round - 1, block, bracketPlayers, undefined, bracketIndex + 1),
    );
  }

  if (block.type === "TEAM") {
    if (block.format === "GROUP") {
      const teamGroupSizes = block.teamGroupSizes?.length
        ? block.teamGroupSizes
        : [Math.ceil(matchUnits.length / 2), Math.floor(matchUnits.length / 2)].filter((size) => size > 0);
      const shuffledTeams = shuffleWithinLevel(matchUnits, block.groupShuffleSeed ?? defaultFormationSeed + 503);
      const teamGroups = block.groupAssignments?.length
        ? assignedTeamGroups(block.groupAssignments, matchUnits).map((players, index) => ({ name: `${index + 1}조`, players }))
        : distributeSnake(shuffledTeams as ProgramPlayer[], teamGroupSizes);
      return teamGroups.flatMap((group, groupIndex) =>
        buildUnitRoundRobinMatches(
          leagueId,
          round - 1,
          block,
          group.players as MatchUnit[],
          `${groupIndex + 1}조`,
        ).map((match, index) => ({
          ...match,
          id: `${match.id}-${index + 1}`,
          match_order: index + 1,
        })),
      ).map((match, index) => ({ ...match, match_order: index + 1 }));
    }

    return buildUnitRoundRobinMatches(leagueId, round - 1, block, matchUnits);
  }

  if (block.format === "GROUP") {
    const shuffledUnits = shuffleWithinLevel(matchUnits, block.groupShuffleSeed ?? defaultFormationSeed + 503);
    const groups = block.groupAssignments?.length && block.type === "SINGLES"
      ? assignedPlayers(block.groupAssignments, players).map((groupPlayers, index) => ({ name: `${index + 1}조`, players: groupPlayers }))
      : distributeSnake(shuffledUnits as ProgramPlayer[], groupSizes);
    return groups.flatMap((group, groupIndex) =>
      buildUnitRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        group.players as MatchUnit[],
        `${groupIndex + 1}조`,
      ).map((match, index) => ({
        ...match,
        id: `${match.id}-${index + 1}`,
        match_order: index + 1,
      })),
    ).map((match, index) => ({ ...match, match_order: index + 1 }));
  }

  return block.type === "SINGLES"
    ? buildRoundRobinMatches(leagueId, round - 1, block, players)
    : buildUnitRoundRobinMatches(leagueId, round - 1, block, matchUnits);
}
