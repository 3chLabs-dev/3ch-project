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
  sourceGroupId?: string | null;
};

type MatchUnit = {
  id: string | null;
  name: string | null;
  division?: string | null;
  level?: number;
  roster?: string[];
  rosterDetails?: Array<{ name: string; division: string | null }>;
  seedLabel?: string;
  sourceGroupIds?: string[];
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
        sourceGroupId: participant.source_group_id ?? null,
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

function sourceGroupsOf(unit: { sourceGroupId?: string | null; sourceGroupIds?: string[] }) {
  if (unit.sourceGroupIds?.length) return unit.sourceGroupIds;
  if (unit.sourceGroupId) return [unit.sourceGroupId];
  return [];
}

function sameClubMatch(left: ProgramPlayer | MatchUnit, right: ProgramPlayer | MatchUnit) {
  const rightGroups = new Set(sourceGroupsOf(right));
  const leftGroups = sourceGroupsOf(left);
  return leftGroups.length > 0 && leftGroups.some((groupId) => rightGroups.has(groupId));
}

function distributeClubAware<T extends { level?: number; sourceGroupId?: string | null; sourceGroupIds?: string[] }>(items: T[], sizes: number[]) {
  const groups = sizes.map(() => [] as T[]);
  const sums = sizes.map(() => 0);
  [...items].sort((a, b) => (a.level ?? 999) - (b.level ?? 999)).forEach((item) => {
    const itemGroups = sourceGroupsOf(item);
    const target = groups.map((group, index) => ({
      index,
      full: group.length >= sizes[index],
      overlap: group.reduce((count, member) => count + (sourceGroupsOf(member).some((id) => itemGroups.includes(id)) ? 1 : 0), 0),
      size: group.length,
      sum: sums[index],
    })).filter((candidate) => !candidate.full).sort((a, b) => a.overlap - b.overlap || a.size - b.size || a.sum - b.sum)[0]?.index;
    if (target == null) return;
    groups[target].push(item);
    sums[target] += item.level ?? 0;
  });
  return groups;
}

function unitRosters(players: ProgramPlayer[], size: number, mode: "same" | "mixed") {
  if (mode === "same") {
    const byClub = new Map<string, ProgramPlayer[]>();
    players.forEach((player) => {
      const key = player.sourceGroupId ?? `unknown-${player.id}`;
      byClub.set(key, [...(byClub.get(key) ?? []), player]);
    });
    return [...byClub.values()].flatMap((clubPlayers) => {
      const count = Math.max(1, Math.floor(clubPlayers.length / size));
      const sizes = Array.from({ length: count }, (_, index) => Math.floor(clubPlayers.length / count) + (index < clubPlayers.length % count ? 1 : 0));
      return distributeSnake(clubPlayers, sizes).map((group) => group.players as ProgramPlayer[]);
    });
  }
  const count = Math.max(1, Math.floor(players.length / size));
  const sizes = Array.from({ length: count }, (_, index) => Math.floor(players.length / count) + (index < players.length % count ? 1 : 0));
  return distributeClubAware(players, sizes);
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

function pairLabel(players: ProgramPlayer[]) {
  return players.map((player) => player.name).join(" · ");
}

function toDoublesUnits(players: ProgramPlayer[], assignments?: FormationAssignmentPlayer[][], clubMode: "same" | "mixed" = "mixed"): MatchUnit[] {
  const units = assignments?.length
    ? assignedPlayers(assignments, players).filter((unit) => unit.length === 2)
    : unitRosters(players, 2, clubMode)
      .filter((unit) => unit.length === 2);

  return units.map((unit, index) => ({
    id: unit.map((player) => player.id).join("+"),
    name: pairLabel(unit),
    division: String(unit.reduce((sum, player) => sum + (player.level ?? 0), 0)),
    level: index + 1,
    roster: unit.map((player) => player.name),
    rosterDetails: unit.map((player) => ({
      name: player.name,
      division: player.division,
    })),
    sourceGroupIds: [...new Set(unit.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))],
  }));
}

function toTeamUnitsFromGroupSizes(
  players: ProgramPlayer[],
  groupSizes: number[],
  clubMode: "same" | "mixed" = "mixed",
): MatchUnit[] {
  const targetSize = Math.max(1, Math.round(players.length / Math.max(1, groupSizes.length)));
  return unitRosters(players, targetSize, clubMode)
    .filter((roster) => roster.length > 0)
    .map((roster, index) => {
      const leader = roster[0];
      return {
        id: roster.map((player) => player.id).join("+"),
        name: `팀 ${leader.name}`,
        division: String(roster.reduce((sum, player) => sum + (player.level ?? 0), 0)),
        level: index + 1,
        roster: roster.map((player) => player.name),
        rosterDetails: roster.map((player) => ({
          name: player.name,
          division: player.division,
        })),
        sourceGroupIds: [...new Set(roster.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))],
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
      division: String(roster.reduce((sum, player) => sum + (player.level ?? 0), 0)),
      level: index + 1,
      roster: roster.map((player) => player.name),
      rosterDetails: roster.map((player) => ({ name: player.name, division: player.division })),
      sourceGroupIds: [...new Set(roster.flatMap((player) => player.sourceGroupId ? [player.sourceGroupId] : []))],
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
  return generateRoundRobin(units.length).map(([leftIndex, rightIndex], index) => {
    const match = makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "units"}-${index + 1}`,
      index + 1,
      units[leftIndex],
      units[rightIndex],
      roundIndex + 1,
      null,
      block.format === "GROUP" && groupName ? groupName : undefined,
    );
    return { ...match, is_no_game: Boolean(block.crossClubOnlyMatches && sameClubMatch(units[leftIndex], units[rightIndex])) };
  });
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

  if (block.crossClubGrouping) {
    for (let index = 0; index < slots.length; index += 2) {
      const left = slots[index];
      const right = slots[index + 1];
      if (!left || !right || !sameClubMatch(left, right)) continue;
      const swapIndex = slots.findIndex((candidate, candidateIndex) => candidateIndex > index + 1 && candidate && !sameClubMatch(left, candidate));
      if (swapIndex >= 0) [slots[index + 1], slots[swapIndex]] = [slots[swapIndex], slots[index + 1]];
    }
  }

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

function buildUpperLowerTournamentMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: MatchUnit[],
  forcedSeeding?: "manual" | "seed" | "random",
  bracketIndex = 1,
): LeagueMatch[] {
  const slots = buildTournamentSlots(leagueId, roundIndex, block, players, forcedSeeding);
  const bracketSize = slots.length;
  if (bracketSize < 4) {
    return buildTournamentMatches(leagueId, roundIndex, block, players, forcedSeeding, bracketIndex);
  }

  const openingCount = bracketSize / 2;
  const innerRounds = Math.log2(openingCount);
  const openingIds = Array.from(
    { length: openingCount },
    (_, index) => `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-open-m${index + 1}`,
  );
  const upperRoundIds = Array.from({ length: innerRounds }, (_, roundOffset) =>
    Array.from(
      { length: openingCount / 2 ** (roundOffset + 1) },
      (_, index) =>
        `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-upper-r${roundOffset + 2}-m${index + 1}`,
    ),
  );
  const lowerRoundIds = Array.from({ length: innerRounds }, (_, roundOffset) =>
    Array.from(
      { length: openingCount / 2 ** (roundOffset + 1) },
      (_, index) =>
        `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-lower-r${roundOffset + 1}-m${index + 1}`,
    ),
  );
  const matches: LeagueMatch[] = [];

  openingIds.forEach((matchId, matchIndex) => {
    const match = makeMatch(
      matchId,
      matches.length + 1,
      slots[matchIndex * 2] ?? { id: null, name: null },
      slots[matchIndex * 2 + 1] ?? { id: null, name: null },
      1,
      "upper",
      getTournamentRoundLabel(bracketSize, 1),
    );
    matches.push({
      ...match,
      next_match_id: upperRoundIds[0]?.[Math.floor(matchIndex / 2)] ?? null,
      next_slot: matchIndex % 2 === 0 ? "a" : "b",
      loser_next_match_id: lowerRoundIds[0]?.[Math.floor(matchIndex / 2)] ?? null,
      loser_next_slot: matchIndex % 2 === 0 ? "a" : "b",
      tournament_bracket_index: bracketIndex,
    });
  });

  upperRoundIds.forEach((roundIds, roundOffset) => {
    roundIds.forEach((matchId, matchIndex) => {
      const isFinal = roundOffset === upperRoundIds.length - 1;
      const match = makeMatch(
        matchId,
        matches.length + 1,
        { id: null, name: null },
        { id: null, name: null },
        roundOffset + 2,
        "upper",
        isFinal ? "상위 결승" : `상위 ${getTournamentRoundLabel(openingCount, roundOffset + 1)}`,
      );
      matches.push({
        ...match,
        next_match_id: isFinal
          ? null
          : upperRoundIds[roundOffset + 1]?.[Math.floor(matchIndex / 2)] ?? null,
        next_slot: isFinal ? null : matchIndex % 2 === 0 ? "a" : "b",
        tournament_bracket_index: bracketIndex,
      });
    });
  });

  lowerRoundIds.forEach((roundIds, roundOffset) => {
    roundIds.forEach((matchId, matchIndex) => {
      const isFinal = roundOffset === lowerRoundIds.length - 1;
      const match = makeMatch(
        matchId,
        matches.length + 1,
        { id: null, name: null },
        { id: null, name: null },
        roundOffset + 1,
        "lower",
        isFinal ? "하위 결승" : `하위 ${getTournamentRoundLabel(openingCount, roundOffset + 1)}`,
      );
      matches.push({
        ...match,
        next_match_id: isFinal
          ? null
          : lowerRoundIds[roundOffset + 1]?.[Math.floor(matchIndex / 2)] ?? null,
        next_slot: isFinal ? null : matchIndex % 2 === 0 ? "a" : "b",
        tournament_bracket_index: bracketIndex,
      });
    });
  });

  return matches;
}

function splitTournamentUnits(units: MatchUnit[], bracketCount: number): MatchUnit[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, units.length));
  const brackets = Array.from({ length: count }, () => [] as MatchUnit[]);
  units.forEach((unit, index) => brackets[index % count].push(unit));
  return brackets.filter((bracket) => bracket.length > 0);
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

function asRankingPlayers(units: MatchUnit[]): ProgramPlayer[] {
  return units.flatMap((unit, index) =>
    unit.id && unit.name
      ? [{
          id: unit.id,
          name: unit.name,
          division: unit.division ?? null,
          level: unit.level ?? index + 1,
        }]
      : [],
  );
}

function getRankedTournamentPools(
  units: MatchUnit[],
  sourceMatches: LeagueMatch[],
  sourceRound: number,
): MatchUnit[][] | null {
  const unitById = new Map(units.flatMap((unit) => unit.id ? [[unit.id, unit] as const] : []));
  const tournamentMatches = applyProgramTournamentAdvancement(
    sourceMatches.filter(
      (match) =>
        (match.program_round ?? match.round_number) === sourceRound &&
        Boolean(match.bracket),
    ),
  );
  if (tournamentMatches.length === 0) return null;

  const bracketIndexes = [
    ...new Set(tournamentMatches.map((match) => match.tournament_bracket_index ?? 1)),
  ].sort((left, right) => left - right);

  const pools = bracketIndexes.flatMap((bracketIndex) => {
    const bracketMatches = tournamentMatches.filter(
      (match) => (match.tournament_bracket_index ?? 1) === bracketIndex,
    );
    const upperMatches = bracketMatches.filter((match) => match.bracket === "upper");
    const finalRound = Math.max(...upperMatches.map((match) => match.round_number ?? 0));
    const finalMatch = upperMatches.find((match) => (match.round_number ?? 0) === finalRound);
    if (!finalMatch || finalMatch.status !== "done") return [];

    const winner = getTournamentWinner(finalMatch);
    const runnerUp = getTournamentLoser(finalMatch);
    const semifinalLosers = upperMatches
      .filter((match) => (match.round_number ?? 0) === finalRound - 1)
      .map(getTournamentLoser)
      .filter(Boolean);
    const rankedIds = [winner, runnerUp, ...semifinalLosers]
      .flatMap((result) => result?.id ? [result.id] : []);
    const rankedUnits = rankedIds.flatMap((id) => {
      const unit = unitById.get(id);
      return unit ? [unit] : [];
    });
    return rankedUnits.length > 0 ? [rankedUnits] : [];
  });

  return pools.length === bracketIndexes.length ? pools : null;
}

function getRankedUnitPools(
  units: MatchUnit[],
  sourceMatches: LeagueMatch[],
  sourceRound: number,
  previousBlock?: ProgramBlock,
): MatchUnit[][] | null {
  if (previousBlock?.format === "TOURNAMENT") {
    return getRankedTournamentPools(units, sourceMatches, sourceRound);
  }

  const rankingPlayers = asRankingPlayers(units);
  const unitById = new Map(units.flatMap((unit) => unit.id ? [[unit.id, unit] as const] : []));

  if (previousBlock?.format === "GROUP") {
    const rankedGroups = getRankedGroupsFromPreviousRound(
      rankingPlayers,
      sourceMatches,
      sourceRound,
    );
    return rankedGroups?.map((group) =>
      group.flatMap((player) => {
        const unit = unitById.get(player.id);
        return unit ? [unit] : [];
      }),
    ) ?? null;
  }

  const ranked = getRankedPlayersFromPreviousRound(
    rankingPlayers,
    sourceMatches,
    sourceRound,
  );
  return ranked
    ? [ranked.flatMap((player) => {
        const unit = unitById.get(player.id);
        return unit ? [unit] : [];
      })]
    : null;
}

function distributeRankedUnitPoolsToBrackets(
  rankedPools: MatchUnit[][],
  bracketCount: number,
): MatchUnit[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, rankedPools.flat().length));
  const brackets = Array.from({ length: count }, () => [] as MatchUnit[]);
  rankedPools.forEach((pool, poolIndex) => {
    pool.forEach((unit, rankIndex) => {
      brackets[(poolIndex + rankIndex) % count].push({
        ...unit,
        seedLabel: `${poolIndex + 1}-${rankIndex + 1}`,
      });
    });
  });
  return brackets.filter((bracket) => bracket.length > 0);
}

function balancedSizes(total: number, preferredGroupCount: number) {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, total));
  return Array.from(
    { length: groupCount },
    (_, index) => Math.floor(total / groupCount) + (index < total % groupCount ? 1 : 0),
  );
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

function buildSingleLeagueRankPlaceholders(
  participantCount: number,
  bracketCount: number,
): MatchUnit[][] {
  const placeholders: MatchUnit[] = Array.from({ length: participantCount }, (_, index) => ({
    id: null,
    name: `${index + 1}위`,
    division: null,
    level: index + 1,
    seedLabel: String(index + 1),
  }));
  return splitTournamentUnits(placeholders, bracketCount);
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

function getTournamentLoser(match: LeagueMatch) {
  const winner = getTournamentWinner(match);
  if (!winner) return null;
  return winner.id === match.participant_a_id
    ? {
        id: match.participant_b_id,
        name: match.participant_b_name,
        division: match.participant_b_division,
      }
    : {
        id: match.participant_a_id,
        name: match.participant_a_name,
        division: match.participant_a_division,
      };
}

export function applyProgramTournamentAdvancement(matches: LeagueMatch[]): LeagueMatch[] {
  const matchMap = new Map(matches.map((match) => [match.id, { ...match }]));
  const orderedMatches = [...matchMap.values()].sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0));

  orderedMatches.forEach((match) => {
    const winner = getTournamentWinner(match);
    if (winner && match.next_match_id && match.next_slot) {
      const parent = matchMap.get(match.next_match_id);
      if (parent && match.next_slot === "a") {
        parent.participant_a_id = winner.id;
        parent.participant_a_name = winner.name;
        parent.participant_a_division = winner.division;
      } else if (parent) {
        parent.participant_b_id = winner.id;
        parent.participant_b_name = winner.name;
        parent.participant_b_division = winner.division;
      }
    }

    const loser = getTournamentLoser(match);
    if (loser && match.loser_next_match_id && match.loser_next_slot) {
      const parent = matchMap.get(match.loser_next_match_id);
      if (parent && match.loser_next_slot === "a") {
        parent.participant_a_id = loser.id;
        parent.participant_a_name = loser.name;
        parent.participant_a_division = loser.division;
      } else if (parent) {
        parent.participant_b_id = loser.id;
        parent.participant_b_name = loser.name;
        parent.participant_b_division = loser.division;
      }
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
  const deletedMatchIds = new Set(block.deletedMatchIds ?? []);
  const withoutDeleted = (matches: LeagueMatch[]) => matches.filter((match) => !deletedMatchIds.has(match.id));

  const players = toProgramPlayers(participants);
  const defaultFormationSeed = round * 1000;
  const teamFormationPlayers = shuffleWithinLevel(players, block.teamShuffleSeed ?? defaultFormationSeed + 101);
  const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
  const matchUnits: MatchUnit[] = block.type === "TEAM"
    ? block.teamAssignments?.length
      ? teamUnitsFromAssignments(block.teamAssignments, players)
      : toTeamUnitsFromGroupSizes(teamFormationPlayers, groupSizes, block.unitClubMode ?? "mixed")
    : block.type === "DOUBLES"
      ? toDoublesUnits(players, block.doublesAssignments, block.unitClubMode ?? "mixed")
      : players;

  if (matchUnits.length < 2) {
    return [];
  }

  const currentRound = option?.rounds?.[round - 1];
  const isFinalRound = round > 1 && currentRound?.option === "FINAL";
  const sourceRound = block.sourceRoundId ?? round - 1;
  const previousBlock = option?.blocks?.[sourceRound - 1];
  const rankedPools = isFinalRound
    ? getRankedUnitPools(matchUnits, sourceMatches, sourceRound, previousBlock)
    : null;
  const finalMode = block.finalAdvancementMode ?? "top-n";
  const advanceCount = Math.max(1, block.advanceCount ?? 2);
  const tournamentBuilder = block.tournamentMode === "upper-lower"
    ? buildUpperLowerTournamentMatches
    : buildTournamentMatches;
  const selectedFinalUnits = rankedPools
    ? rankedPools.flatMap((pool) => pool.slice(0, advanceCount))
    : [];

  if (block.format === "TOURNAMENT") {
    if (isFinalRound) {
      const bracketCount = block.tournamentBracketCount ?? 1;
      const previousGroupSizes = previousBlock?.groupSizes ?? option?.groupSizes ?? [];
      const placeholderBrackets = !rankedPools && previousGroupSizes.length > 1
        ? buildRankPlaceholders(previousGroupSizes, bracketCount)
        : !rankedPools && previousBlock?.format === "LEAGUE"
          ? buildSingleLeagueRankPlaceholders(matchUnits.length, bracketCount)
        : null;
      const tournamentBrackets = rankedPools?.length
        ? distributeRankedUnitPoolsToBrackets(rankedPools, bracketCount)
        : placeholderBrackets?.length
          ? placeholderBrackets
          : splitTournamentUnits(matchUnits, bracketCount);
      return withoutDeleted(tournamentBrackets.flatMap((bracketPlayers, bracketIndex) =>
        tournamentBuilder(
          leagueId,
          round - 1,
          block,
          bracketPlayers,
          rankedPools || placeholderBrackets ? "seed" : undefined,
          bracketIndex + 1,
        ),
      ));
    }

    return withoutDeleted(splitTournamentUnits(matchUnits, block.tournamentBracketCount ?? 1).flatMap((bracketPlayers, bracketIndex) =>
      tournamentBuilder(leagueId, round - 1, block, bracketPlayers, undefined, bracketIndex + 1),
    ));
  }

  if (block.format === "LEAGUE") {
    if (isFinalRound) {
      if (!rankedPools || selectedFinalUnits.length < 2) return [];
      return withoutDeleted(buildUnitRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        selectedFinalUnits,
      ));
    }
    return withoutDeleted(buildUnitRoundRobinMatches(leagueId, round - 1, block, matchUnits));
  }

  if (block.format === "GROUP") {
    if (isFinalRound) {
      if (!rankedPools) return [];

      let finalGroups: Array<{ name: string; players: MatchUnit[] }> = [];
      if (finalMode === "upper-lower-groups") {
        const upper = rankedPools.flatMap((pool) => pool.slice(0, Math.ceil(pool.length / 2)));
        const lower = rankedPools.flatMap((pool) => pool.slice(Math.ceil(pool.length / 2)));
        finalGroups = [
          { name: "상위부", players: upper },
          { name: "하위부", players: lower },
        ].filter((group) => group.players.length > 1);
      } else if (finalMode === "rank-groups") {
        const maxRank = Math.max(0, ...rankedPools.map((pool) => pool.length));
        finalGroups = Array.from({ length: maxRank }, (_, rankIndex) => ({
          name: `${rankIndex + 1}위조`,
          players: rankedPools.flatMap((pool) => pool[rankIndex] ? [pool[rankIndex]] : []),
        })).filter((group) => group.players.length > 1);
      } else {
        const preferredGroupCount = Math.max(1, block.groupSizes?.length ?? rankedPools.length);
        const sizes = balancedSizes(selectedFinalUnits.length, preferredGroupCount);
        finalGroups = distributeSnake(
          selectedFinalUnits as ProgramPlayer[],
          sizes,
        ).map((group, index) => ({
          name: `${index + 1}조`,
          players: group.players as MatchUnit[],
        }));
      }

      return withoutDeleted(finalGroups.flatMap((group) =>
        buildUnitRoundRobinMatches(
          leagueId,
          round - 1,
          block,
          group.players,
          group.name,
        ),
      ).map((match, index) => ({ ...match, match_order: index + 1 })));
    }

    const shuffledUnits = shuffleWithinLevel(matchUnits, block.groupShuffleSeed ?? defaultFormationSeed + 503);
    const configuredGroupSizes = block.type === "TEAM"
      ? block.teamGroupSizes?.length
        ? block.teamGroupSizes
        : [Math.ceil(matchUnits.length / 2), Math.floor(matchUnits.length / 2)].filter((size) => size > 0)
      : groupSizes;
    const groups = block.groupAssignments?.length
      ? block.type === "DOUBLES" || block.type === "TEAM"
        ? assignedTeamGroups(block.groupAssignments, matchUnits).map((groupPlayers, index) => ({ name: `${index + 1}조`, players: groupPlayers }))
        : assignedPlayers(block.groupAssignments, players).map((groupPlayers, index) => ({ name: `${index + 1}조`, players: groupPlayers }))
      : block.crossClubGrouping
        ? distributeClubAware(shuffledUnits, configuredGroupSizes).map((groupPlayers, index) => ({ name: `${index + 1}조`, players: groupPlayers }))
        : distributeSnake(shuffledUnits as ProgramPlayer[], configuredGroupSizes).map((group, index) => ({
            name: `${index + 1}조`,
            players: group.players,
          }));
    return withoutDeleted(groups.flatMap((group, groupIndex) =>
      buildUnitRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        group.players as MatchUnit[],
        group.name ?? `${groupIndex + 1}조`,
      ).map((match, index) => ({
        ...match,
        id: `${match.id}-${index + 1}`,
        match_order: index + 1,
      })),
    ).map((match, index) => ({ ...match, match_order: index + 1 })));
  }

  return [];
}
