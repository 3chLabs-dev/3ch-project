import type { LeagueMatch, LeagueParticipantItem } from "../features/league/leagueApi";
import { distributeSnake } from "../features/league/algorithms/distributeSnake";
import type {
  FormationAssignmentPlayer,
  ProgramBlock,
  ProgramOption,
  ProgramRoundStandingsSnapshot,
} from "../features/league/types/tournament.types";
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
  | "participant_a_seed_label"
  | "participant_b_id"
  | "participant_b_name"
  | "participant_b_division"
  | "participant_b_seed_label"
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
        level: Number.isNaN(level) ? 0 : level,
        sourceGroupId: participant.source_group_id ?? null,
      };
    })
    .sort((a, b) => (a.level || Number.MAX_SAFE_INTEGER) - (b.level || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
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
    const level = item.level ?? 0;
    buckets.set(level, [...(buckets.get(level) ?? []), item]);
  });
  return [...buckets.keys()]
    .sort((a, b) => (a || Number.MAX_SAFE_INTEGER) - (b || Number.MAX_SAFE_INTEGER))
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
  [...items].sort((a, b) => ((a.level ?? 0) || Number.MAX_SAFE_INTEGER) - ((b.level ?? 0) || Number.MAX_SAFE_INTEGER)).forEach((item) => {
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
  const orderedUnits = units.map((unit, index) => ({
    ...unit,
    seedLabel: String(index + 1),
  }));
  const upperHalfSize = Math.ceil(orderedUnits.length / 2);
  const isSameHalf = (leftIndex: number, rightIndex: number) =>
    (leftIndex < upperHalfSize) === (rightIndex < upperHalfSize);

  return generateRoundRobin(orderedUnits.length).map(([leftIndex, rightIndex], index) => {
    const match = makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "units"}-${index + 1}`,
      index + 1,
      orderedUnits[leftIndex],
      orderedUnits[rightIndex],
      roundIndex + 1,
      null,
      block.format === "GROUP" && groupName ? groupName : undefined,
    );
    return {
      ...match,
      is_no_game: Boolean(
        (block.crossClubOnlyMatches
          && sameClubMatch(orderedUnits[leftIndex], orderedUnits[rightIndex]))
        || (block.halfSplitOnlyMatches && isSameHalf(leftIndex, rightIndex)),
      ),
    };
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

function completeAutomaticOpeningWalkover(
  match: LeagueMatch,
  seeding?: "manual" | "seed" | "random",
): LeagueMatch {
  const hasExactlyOneParticipant = Boolean(match.participant_a_id) !== Boolean(match.participant_b_id);
  if (seeding === "manual" || match.bracket !== "upper" || match.round_number !== 1 || !hasExactlyOneParticipant) {
    return match;
  }
  return { ...match, status: "done", score_a: 0, score_b: 0 };
}

export function isAutomaticProgramWalkover(match: LeagueMatch): boolean {
  return match.bracket === "upper"
    && match.round_number === 1
    && match.status === "done"
    && Boolean(match.participant_a_id) !== Boolean(match.participant_b_id);
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
        matches.length + 1,
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

  const shouldCreateThirdPlaceMatch =
    block.thirdPlaceMatch ?? (block.tournamentBracketCount ?? 1) === 1;
  if (bracketSize >= 4 && shouldCreateThirdPlaceMatch) {
    const finalMatch = matches[matches.length - 1];
    const finalRound = finalMatch.round_number ?? Math.log2(bracketSize);
    const semifinalMatches = matches.filter(
      (match) => match.bracket === "upper" && match.round_number === finalRound - 1,
    );

    if (semifinalMatches.length === 2) {
      const thirdPlaceId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-r${finalRound}-m0`;
      const thirdPlaceMatch = makeMatch(
        thirdPlaceId,
        finalMatch.match_order,
        { id: null, name: null, division: null },
        { id: null, name: null, division: null },
        finalRound,
        "upper",
        "3·4위전",
      );

      semifinalMatches.forEach((semifinal, index) => {
        semifinal.loser_next_match_id = thirdPlaceId;
        semifinal.loser_next_slot = index === 0 ? "a" : "b";
      });

      finalMatch.match_order += 1;
      finalMatch.match_label = "결승";
      matches.splice(matches.length - 1, 0, {
        ...thirdPlaceMatch,
        tournament_bracket_index: bracketIndex,
      });
    }
  }

  const seeding = forcedSeeding ?? block.tournamentSeeding;
  return matches.map((sourceMatch) => {
    const match = completeAutomaticOpeningWalkover(sourceMatch, seeding);
    const stageSize = bracketSize / 2 ** ((match.round_number ?? 1) - 1);
    return {
      ...match,
      match_rule: block.nextMatchRule ?? (block.lateMatchRule && block.ruleSwitchSize && stageSize <= block.ruleSwitchSize
        ? block.lateMatchRule
        : block.matchRule),
    };
  });
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

  if (block.thirdPlaceMatch && innerRounds >= 2) {
    const addThirdPlaceMatch = (bracket: "upper" | "lower", semifinalRound: number, finalRound: number) => {
      const semifinals = matches.filter((match) => match.bracket === bracket && match.round_number === semifinalRound);
      const final = matches.find((match) => match.bracket === bracket && match.round_number === finalRound);
      if (semifinals.length !== 2 || !final) return;
      const thirdPlaceId = `program-${leagueId}-r${roundIndex + 1}-t${bracketIndex}-${bracket}-third-m0`;
      semifinals.forEach((semifinal, index) => {
        semifinal.loser_next_match_id = thirdPlaceId;
        semifinal.loser_next_slot = index === 0 ? "a" : "b";
      });
      matches.push({
        ...makeMatch(thirdPlaceId, final.match_order, { id: null, name: null }, { id: null, name: null }, finalRound, bracket, `${bracket === "upper" ? "상위" : "하위"} 3·4위전`),
        tournament_bracket_index: bracketIndex,
      });
    };
    addThirdPlaceMatch("upper", innerRounds, innerRounds + 1);
    addThirdPlaceMatch("lower", innerRounds - 1, innerRounds);
  }

  const seeding = forcedSeeding ?? block.tournamentSeeding;
  return matches.map((sourceMatch) => {
    const match = completeAutomaticOpeningWalkover(sourceMatch, seeding);
    const stageSize = match.bracket === "lower"
      ? bracketSize / 2 ** (match.round_number ?? 1)
      : bracketSize / 2 ** ((match.round_number ?? 1) - 1);
    return {
      ...match,
      match_rule: block.nextMatchRule ?? (block.lateMatchRule && block.ruleSwitchSize && stageSize <= block.ruleSwitchSize
        ? block.lateMatchRule
        : block.matchRule),
    };
  });
}

function splitTournamentUnits(units: MatchUnit[], bracketCount: number): MatchUnit[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, units.length));
  const brackets = Array.from({ length: count }, () => [] as MatchUnit[]);
  units.forEach((unit, index) => brackets[index % count].push(unit));
  return brackets.filter((bracket) => bracket.length > 0);
}

function hasCompletedResult(match: LeagueMatch): boolean {
  if (match.status === "done") return true;
  return (
    match.score_a != null &&
    match.score_b != null &&
    Number(match.score_a) !== Number(match.score_b)
  );
}

function getRankedPlayersFromPreviousRound(
  players: ProgramPlayer[],
  sourceMatches: LeagueMatch[],
  previousRound: number,
  matchRule?: string | null,
  manualParticipantOrder?: string[],
): ProgramPlayer[] | null {
  const previousMatches = sourceMatches.filter(
    (match) =>
      (match.program_round ?? match.round_number) === previousRound &&
      !match.bracket &&
      !match.is_no_game &&
      match.participant_a_id &&
      match.participant_b_id,
  );

  if (previousMatches.length === 0 || previousMatches.some((match) => !hasCompletedResult(match))) {
    return null;
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const playerIndex = new Map(players.map((player, index) => [player.id, index]));
  const manualIndex = new Map((manualParticipantOrder ?? []).map((id, index) => [id, index]));
  const divisionNumber = (player: ProgramPlayer) => {
    const parsed = Number.parseInt(String(player.division ?? "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER;
  };
  const compareFinalTieBreak = (left: ProgramPlayer, right: ProgramPlayer) => {
    const divisionDiff = divisionNumber(right) - divisionNumber(left);
    if (divisionDiff !== 0) return divisionDiff;
    const manualDiff = (manualIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (manualIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (manualDiff !== 0) return manualDiff;
    return (playerIndex.get(left.id) ?? 0) - (playerIndex.get(right.id) ?? 0);
  };
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
  const isThreeSetRule = matchRule === "3세트제" || matchRule === "THREE_SET";
  const tieGroups = isThreeSetRule
    ? players.reduce((groups, player) => {
        const setTotal = stats.get(player.id)?.setTotal ?? 0;
        groups.set(setTotal, [...(groups.get(setTotal) ?? []), player]);
        return groups;
      }, new Map<number, ProgramPlayer[]>())
    : byWins;

  const tieWon = new Map<string, number>();
  const tieLost = new Map<string, number>();
  players.forEach((player) => {
    tieWon.set(player.id, 0);
    tieLost.set(player.id, 0);
  });

  for (const group of tieGroups.values()) {
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
    const leftTieLost = tieLost.get(left.id) ?? 0;
    const rightTieLost = tieLost.get(right.id) ?? 0;
    if (isThreeSetRule) {
      if (leftStats.setTotal !== rightStats.setTotal) {
        return rightStats.setTotal - leftStats.setTotal;
      }
      const leftTieWon = tieWon.get(left.id) ?? 0;
      const rightTieWon = tieWon.get(right.id) ?? 0;
      if (leftTieWon !== rightTieWon) return rightTieWon - leftTieWon;
      if (leftTieLost !== rightTieLost) return leftTieLost - rightTieLost;
      return compareFinalTieBreak(left, right);
    }

    if (leftStats.wins !== rightStats.wins) return rightStats.wins - leftStats.wins;
    const leftRatio = leftTieLost === 0 ? Infinity : (tieWon.get(left.id) ?? 0) / leftTieLost;
    const rightRatio = rightTieLost === 0 ? Infinity : (tieWon.get(right.id) ?? 0) / rightTieLost;
    if (leftRatio !== rightRatio) return rightRatio - leftRatio;

    return compareFinalTieBreak(left, right);
  });
}

function getRankedGroupsFromPreviousRound(
  players: ProgramPlayer[],
  sourceMatches: LeagueMatch[],
  previousRound: number,
  matchRule?: string | null,
): ProgramPlayer[][] | null {
  const previousMatches = sourceMatches.filter(
    (match) =>
      (match.program_round ?? match.round_number) === previousRound &&
      !match.bracket &&
      !match.is_no_game &&
      match.match_label &&
      match.participant_a_id &&
      match.participant_b_id,
  );
  if (previousMatches.length === 0 || previousMatches.some((match) => !hasCompletedResult(match))) return null;

  const labels = [...new Set(previousMatches.map((match) => match.match_label as string))].sort();
  const playerById = new Map(players.map((player) => [player.id, player]));
  return labels.map((label) => {
    const labelMatches = previousMatches.filter((match) => match.match_label === label);
    const ids = new Set(labelMatches.flatMap((match) => [match.participant_a_id, match.participant_b_id]).filter(Boolean) as string[]);
    const groupPlayers = [...ids].flatMap((id) => {
      const player = playerById.get(id);
      return player ? [player] : [];
    });
    return getRankedPlayersFromPreviousRound(
      groupPlayers,
      labelMatches,
      previousRound,
      matchRule,
    ) ?? groupPlayers;
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
      previousBlock?.matchRule,
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
    previousBlock?.matchRule,
  );
  return ranked
    ? [ranked.flatMap((player) => {
        const unit = unitById.get(player.id);
        return unit ? [unit] : [];
      })]
    : null;
}

function getSavedRankedUnitPools(
  option: ProgramOption | null,
  sourceRound: number,
  units: MatchUnit[],
): MatchUnit[][] | null {
  const snapshot = option?.roundStandings?.find(
    (item) => item.round === sourceRound,
  );
  if (!snapshot) return null;

  const unitById = new Map(
    units.flatMap((unit) => unit.id ? [[unit.id, unit] as const] : []),
  );
  const placeholderPools = buildRankPlaceholderPools(
    snapshot.pools.map((pool) => pool.participantIds.length),
  );
  const pools = snapshot.pools.map((pool, poolIndex) => {
    if (!pool.complete) return placeholderPools[poolIndex] ?? [];
    return pool.participantIds.flatMap((id) => {
      const unit = unitById.get(id);
      return unit ? [unit] : [];
    });
  });

  return pools.length > 0 && pools.every((pool) => pool.length > 0)
    ? pools
    : null;
}

export function buildProgramRoundStandingsSnapshot(
  option: ProgramOption | null,
  round: number,
  sourceMatches: LeagueMatch[],
): ProgramRoundStandingsSnapshot | null {
  const block = option?.blocks?.[round - 1];
  if (!block) return null;

  const roundMatches = sourceMatches.filter(
    (match) =>
      (match.program_round ?? match.round_number) === round &&
      !match.is_no_game,
  );
  if (roundMatches.length === 0) return null;

  const unitById = new Map<string, MatchUnit>();
  roundMatches.forEach((match) => {
    if (match.participant_a_id && !match.participant_a_id.startsWith("placeholder-")) {
      unitById.set(match.participant_a_id, {
        id: match.participant_a_id,
        name: match.participant_a_name,
        division: match.participant_a_division,
        seedLabel: match.participant_a_seed_label ?? undefined,
      });
    }
    if (match.participant_b_id && !match.participant_b_id.startsWith("placeholder-")) {
      unitById.set(match.participant_b_id, {
        id: match.participant_b_id,
        name: match.participant_b_name,
        division: match.participant_b_division,
        seedLabel: match.participant_b_seed_label ?? undefined,
      });
    }
  });

  if (block.format === "GROUP") {
    const labels = [...new Set(
      roundMatches.map((match) => match.match_label).filter(Boolean) as string[],
    )].sort((left, right) =>
      (Number.parseInt(left, 10) || 0) - (Number.parseInt(right, 10) || 0)
    );
    if (labels.length === 0) return null;

    const rankingPlayers = asRankingPlayers([...unitById.values()]);
    const playerById = new Map(rankingPlayers.map((player) => [player.id, player]));
    const pools = labels.map((label) => {
      const labelMatches = roundMatches.filter((match) => match.match_label === label);
      const seedByParticipantId = new Map<string, number>();
      labelMatches.forEach((match) => {
        const aSeed = match.participant_a_seed_label == null
          ? null
          : Number(match.participant_a_seed_label);
        const bSeed = match.participant_b_seed_label == null
          ? null
          : Number(match.participant_b_seed_label);
        if (match.participant_a_id && aSeed != null && Number.isFinite(aSeed)) {
          seedByParticipantId.set(match.participant_a_id, aSeed);
        }
        if (match.participant_b_id && bSeed != null && Number.isFinite(bSeed)) {
          seedByParticipantId.set(match.participant_b_id, bSeed);
        }
      });
      const participantIds = [...new Set(
        labelMatches.flatMap((match) =>
          [match.participant_a_id, match.participant_b_id].filter(Boolean) as string[]
        ),
      )].sort((left, right) =>
        (seedByParticipantId.get(left) ?? Number.MAX_SAFE_INTEGER)
        - (seedByParticipantId.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
      const groupPlayers = participantIds.flatMap((id) => {
        const player = playerById.get(id);
        return player ? [player] : [];
      });
      const rankedPlayers = getRankedPlayersFromPreviousRound(
        groupPlayers,
        labelMatches,
        round,
        block.matchRule,
        option.roundTieBreaks?.find(
          (tieBreak) => tieBreak.round === round && tieBreak.poolLabel === label,
        )?.participantIds,
      );

      return {
        label,
        complete: rankedPlayers !== null,
        participantIds: (rankedPlayers ?? groupPlayers).map((player) => player.id),
      };
    });

    return {
      round,
      complete: pools.every((pool) => pool.complete),
      pools,
      updatedAt: new Date().toISOString(),
    };
  }

  const rankedPools = getRankedUnitPools(
    [...unitById.values()],
    roundMatches,
    round,
    block,
  );
  if (!rankedPools) return null;

  return {
    round,
    complete: true,
    pools: rankedPools.map((pool, index) => ({
      label: `${index + 1}`,
      complete: true,
      participantIds: pool.flatMap((unit) => unit.id ? [unit.id] : []),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function withProgramRoundStandingsSnapshot(
  option: ProgramOption,
  round: number,
  sourceMatches: LeagueMatch[],
): ProgramOption {
  const snapshot = buildProgramRoundStandingsSnapshot(option, round, sourceMatches);
  const existing = option.roundStandings?.find((item) => item.round === round);
  const remaining = (option.roundStandings ?? []).filter((item) => item.round !== round);

  if (!snapshot) {
    return existing
      ? { ...option, roundStandings: remaining }
      : option;
  }

  const existingPools = existing?.pools.map((pool) => ({
    label: pool.label,
    complete: pool.complete,
    participantIds: pool.participantIds,
  }));
  const nextPools = snapshot.pools.map((pool) => ({
    label: pool.label,
    complete: pool.complete,
    participantIds: pool.participantIds,
  }));
  if (
    existing?.complete === snapshot.complete &&
    JSON.stringify(existingPools) === JSON.stringify(nextPools)
  ) {
    return option;
  }

  return {
    ...option,
    roundStandings: [...remaining, snapshot].sort((left, right) => left.round - right.round),
  };
}

function distributeRankedUnitPoolsToBrackets(
  rankedPools: MatchUnit[][],
  bracketCount: number,
): MatchUnit[][] {
  const count = Math.min(Math.max(1, bracketCount), Math.max(1, rankedPools.flat().length));
  const brackets = Array.from(
    { length: count },
    () => [] as Array<{ unit: MatchUnit; poolIndex: number; rankIndex: number }>,
  );
  rankedPools.forEach((pool, poolIndex) => {
    pool.forEach((unit, rankIndex) => {
      brackets[(poolIndex + rankIndex) % count].push({
        unit: {
          ...unit,
          seedLabel: `${poolIndex + 1}-${rankIndex + 1}`,
        },
        poolIndex,
        rankIndex,
      });
    });
  });
  return brackets
    .filter((bracket) => bracket.length > 0)
    .map((bracket) =>
      bracket
        .sort(
          (left, right) =>
            left.rankIndex - right.rankIndex || left.poolIndex - right.poolIndex,
        )
        .map(({ unit }) => unit),
    );
}

function buildFourGroupSixteenSeedOrder(rankedPools: MatchUnit[][]): MatchUnit[] | null {
  if (rankedPools.length !== 4 || rankedPools.some((pool) => pool.length !== 4)) {
    return null;
  }

  const [group1, group2, group3, group4] = rankedPools;
  const bracketSlots = [
    group1[0], group2[3],
    group3[2], group4[1],
    group1[1], group2[2],
    group3[3], group4[0],
    group3[0], group4[3],
    group1[2], group2[1],
    group3[1], group4[2],
    group1[3], group2[0],
  ];
  const seedAtSlot = seededBracket(16);
  const seedOrder = Array<MatchUnit>(16);

  bracketSlots.forEach((unit, slotIndex) => {
    seedOrder[seedAtSlot[slotIndex] - 1] = unit;
  });

  return seedOrder;
}

type RankedSeedUnit = {
  unit: MatchUnit;
  poolIndex: number;
  rankIndex: number;
};

function rotateItems<T>(items: T[], offset: number): T[] {
  if (items.length < 2) return [...items];
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function buildRankOrderVariants(items: RankedSeedUnit[]): RankedSeedUnit[][] {
  if (items.length < 2) return [[...items]];
  const variants: RankedSeedUnit[][] = [];
  const seen = new Set<string>();
  const bases = [[...items], [...items].reverse()];

  bases.forEach((base) => {
    for (let offset = 0; offset < base.length; offset += 1) {
      const variant = rotateItems(base, offset);
      const key = variant.map((entry) => entry.poolIndex).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(variant);
      }
    }
  });
  if (variants.length <= 24) return variants;
  const step = variants.length / 24;
  return Array.from({ length: 24 }, (_, index) => variants[Math.floor(index * step)]);
}

function tournamentMeetingRound(leftSlot: number, rightSlot: number, bracketSize: number): number {
  const rounds = Math.log2(bracketSize);
  for (let round = 1; round <= rounds; round += 1) {
    const sectionSize = 2 ** round;
    if (Math.floor(leftSlot / sectionSize) === Math.floor(rightSlot / sectionSize)) {
      return round;
    }
  }
  return rounds;
}

function scoreCrossGroupSeedOrder(
  seedOrder: RankedSeedUnit[],
  totalEntrants: number,
  bracketSize: number,
  maxRank: number,
): number {
  const slotBySeed = new Map(
    seededBracket(bracketSize).map((seed, slotIndex) => [seed, slotIndex]),
  );
  const placed = seedOrder.map((entry, index) => ({
    ...entry,
    seed: index + 1,
    slot: slotBySeed.get(index + 1) ?? index,
  }));
  let score = 0;

  for (let leftIndex = 0; leftIndex < placed.length; leftIndex += 1) {
    const left = placed[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < placed.length; rightIndex += 1) {
      const right = placed[rightIndex];
      if (left.poolIndex !== right.poolIndex) continue;
      const meetingRound = tournamentMeetingRound(left.slot, right.slot, bracketSize);
      if (meetingRound === 1) score += 1_000_000;
      score += (Math.log2(bracketSize) - meetingRound + 1) * 5_000;
      if (left.rankIndex === 0 || right.rankIndex === 0) {
        score += (Math.log2(bracketSize) - meetingRound + 1) * 10_000;
      }
    }
  }

  for (let slotIndex = 0; slotIndex < bracketSize; slotIndex += 2) {
    const left = placed.find((entry) => entry.slot === slotIndex);
    const right = placed.find((entry) => entry.slot === slotIndex + 1);
    if (!left || !right) continue;
    if (left.rankIndex === 0 && right.rankIndex === 0) score += 500_000;
    score += Math.abs((left.rankIndex + 1) + (right.rankIndex + 1) - (maxRank + 1)) * 100;
  }

  const byeCount = bracketSize - totalEntrants;
  if (byeCount > 0) {
    placed.forEach((entry) => {
      const pairedSlot = entry.slot % 2 === 0 ? entry.slot + 1 : entry.slot - 1;
      const hasOpponent = placed.some((candidate) => candidate.slot === pairedSlot);
      if (!hasOpponent) {
        score += entry.rankIndex * 20_000;
      }
    });
  }

  return score;
}

function buildCrossGroupTournamentSeedOrder(rankedPools: MatchUnit[][]): MatchUnit[] {
  const exactFourGroupOrder = buildFourGroupSixteenSeedOrder(rankedPools);
  if (exactFourGroupOrder) return exactFourGroupOrder;

  const rankedTiers = Array.from(
    { length: Math.max(...rankedPools.map((pool) => pool.length)) },
    (_, rankIndex) =>
      rankedPools.flatMap((pool, poolIndex) => {
        const unit = pool[rankIndex];
        return unit ? [{ unit, poolIndex, rankIndex }] : [];
      }),
  ).filter((tier) => tier.length > 0);
  const totalEntrants = rankedTiers.reduce((sum, tier) => sum + tier.length, 0);
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, totalEntrants)));
  const maxRank = rankedTiers.length;
  let candidates: Array<{ order: RankedSeedUnit[]; score: number }> = [{ order: [], score: 0 }];

  rankedTiers.forEach((tier) => {
    const variants = buildRankOrderVariants(tier);
    const nextCandidates = candidates.flatMap((candidate) =>
      variants.map((variant) => {
        const order = [...candidate.order, ...variant];
        return {
          order,
          score: scoreCrossGroupSeedOrder(order, totalEntrants, bracketSize, maxRank),
        };
      }),
    );
    nextCandidates.sort((left, right) => left.score - right.score);
    candidates = nextCandidates.slice(0, 32);
  });

  return (candidates[0]?.order ?? rankedTiers.flat()).map(({ unit }) => unit);
}

function balancedSizes(total: number, preferredGroupCount: number) {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, total));
  return Array.from(
    { length: groupCount },
    (_, index) => Math.floor(total / groupCount) + (index < total % groupCount ? 1 : 0),
  );
}

function buildTeamFormationSizes(total: number, teamPlayerCount: number) {
  if (total <= 0) return [];
  if (total < 4) return [total];
  const preferredSize = Math.max(2, teamPlayerCount);
  const teamCount = Math.max(1, Math.min(Math.floor(total / 2), Math.ceil(total / preferredSize)));
  return Array.from(
    { length: teamCount },
    (_, index) => Math.floor(total / teamCount) + (index < total % teamCount ? 1 : 0),
  );
}

function distributeQualifiedPoolsToFinalGroups(
  pools: MatchUnit[][],
  advanceCount: number,
  preferredGroupCount: number,
): MatchUnit[][] {
  const groupCount = Math.max(1, Math.min(preferredGroupCount, pools.length));
  const finalGroups = Array.from({ length: groupCount }, () => [] as MatchUnit[]);

  // Cross-seed source pools from the outside in (1, N, 2, N-1, ...), then
  // rotate the destination group for every rank. This keeps qualifiers from
  // the same preliminary pool apart for as many ranks as the group count allows.
  const crossSeededPools: MatchUnit[][] = [];
  for (let left = 0, right = pools.length - 1; left <= right; left += 1, right -= 1) {
    crossSeededPools.push(pools[left]);
    if (left !== right) crossSeededPools.push(pools[right]);
  }
  const poolGroupSizes = balancedSizes(crossSeededPools.length, groupCount);
  const poolChunks: MatchUnit[][][] = [];
  let poolOffset = 0;
  poolGroupSizes.forEach((poolCount) => {
    poolChunks.push(crossSeededPools.slice(poolOffset, poolOffset + poolCount));
    poolOffset += poolCount;
  });

  for (let rankIndex = 0; rankIndex < advanceCount; rankIndex += 1) {
    poolChunks.forEach((chunk, chunkIndex) => {
      const destinationIndex = (chunkIndex + rankIndex) % groupCount;
      chunk.forEach((pool) => {
        if (pool[rankIndex]) finalGroups[destinationIndex].push(pool[rankIndex]);
      });
    });
  }

  return finalGroups;
}

function buildRankPlaceholderPools(
  groupSizes: number[],
  maxRank?: number,
): MatchUnit[][] {
  return groupSizes.map((size, groupIndex) =>
    Array.from({ length: Math.min(size, maxRank ?? size) }, (_, rankIndex) => ({
      id: `placeholder-${groupIndex + 1}-${rankIndex + 1}`,
      name: `${groupIndex + 1}조 ${rankIndex + 1}위`,
      division: null,
      level: rankIndex + 1,
      seedLabel: `${groupIndex + 1}-${rankIndex + 1}`,
    })),
  );
}

function buildSingleLeagueRankPlaceholderPool(
  participantCount: number,
  maxRank?: number,
): MatchUnit[][] {
  const placeholders: MatchUnit[] = Array.from(
    { length: Math.min(participantCount, maxRank ?? participantCount) },
    (_, index) => ({
    id: `placeholder-rank-${index + 1}`,
    name: `${index + 1}위`,
    division: null,
    level: index + 1,
    seedLabel: String(index + 1),
  }));
  return [placeholders];
}

function buildTournamentRankPlaceholderPool(sourceRound: number, advanceCount: number): MatchUnit[][] {
  return [Array.from({ length: advanceCount }, (_, index) => ({
    id: `placeholder-tournament-r${sourceRound}-rank-${index + 1}`,
    name: `${sourceRound}라운드 ${index + 1}위`,
    division: null,
    level: index + 1,
    seedLabel: String(index + 1),
  }))];
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

export function storeProgramOption(leagueId: string, option: ProgramOption) {
  localStorage.setItem(`league-program-${leagueId}`, JSON.stringify(option));
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
        seedLabel: match.participant_a_seed_label ?? undefined,
      }
    : {
        id: match.participant_b_id,
        name: match.participant_b_name,
        division: match.participant_b_division,
        seedLabel: match.participant_b_seed_label ?? undefined,
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
        seedLabel: match.participant_b_seed_label ?? undefined,
      }
    : {
        id: match.participant_a_id,
        name: match.participant_a_name,
        division: match.participant_a_division,
        seedLabel: match.participant_a_seed_label ?? undefined,
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
        parent.participant_a_seed_label = winner.seedLabel;
      } else if (parent) {
        parent.participant_b_id = winner.id;
        parent.participant_b_name = winner.name;
        parent.participant_b_division = winner.division;
        parent.participant_b_seed_label = winner.seedLabel;
      }
    }

    const loser = getTournamentLoser(match);
    if (loser && match.loser_next_match_id && match.loser_next_slot) {
      const parent = matchMap.get(match.loser_next_match_id);
      if (parent && match.loser_next_slot === "a") {
        parent.participant_a_id = loser.id;
        parent.participant_a_name = loser.name;
        parent.participant_a_division = loser.division;
        parent.participant_a_seed_label = loser.seedLabel;
      } else if (parent) {
        parent.participant_b_id = loser.id;
        parent.participant_b_name = loser.name;
        parent.participant_b_division = loser.division;
        parent.participant_b_seed_label = loser.seedLabel;
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
  // Kept in the public signature for callers that assemble prior-round matches.
  // Final-round qualification now comes exclusively from persisted standings.
  void sourceMatches;
  const storedBlock = option?.blocks?.[round - 1];
  const currentRound = option?.rounds?.[round - 1];
  if (!storedBlock || participants.length < 2) return [];
  const previousRound = round > 1 ? option?.rounds?.[round - 2] : undefined;
  const previousTeamBlock = round > 1 ? option?.blocks?.[round - 2] : undefined;
  const inheritsPreviousTeamFormation =
    storedBlock.type === "TEAM" &&
    (currentRound?.inheritPreviousTeamFormation ?? storedBlock.inheritPreviousTeamFormation) &&
    previousTeamBlock?.type === "TEAM";
  const block: ProgramBlock = {
    ...storedBlock,
    groupSizes: currentRound?.groupSizes ?? storedBlock.groupSizes,
    teamGroupSizes: currentRound?.teamGroupSizes ?? storedBlock.teamGroupSizes,
    teamPlayerCount: currentRound?.teamPlayerCount ?? storedBlock.teamPlayerCount,
    teamFormationSizes: currentRound?.teamFormationSizes ?? storedBlock.teamFormationSizes,
    groupShuffleSeed: currentRound?.groupShuffleSeed ?? storedBlock.groupShuffleSeed,
    groupAssignments: currentRound?.groupAssignments ?? storedBlock.groupAssignments,
    teamAssignments: inheritsPreviousTeamFormation
      ? previousRound?.teamAssignments ?? previousTeamBlock?.teamAssignments
      : currentRound?.teamAssignments ?? storedBlock.teamAssignments,
    doublesAssignments: currentRound?.doublesAssignments ?? storedBlock.doublesAssignments,
    teamShuffleSeed: inheritsPreviousTeamFormation
      ? previousRound?.teamShuffleSeed ?? previousTeamBlock?.teamShuffleSeed
      : currentRound?.teamShuffleSeed ?? storedBlock.teamShuffleSeed,
    unitClubMode: inheritsPreviousTeamFormation
      ? previousRound?.unitClubMode ?? previousTeamBlock?.unitClubMode
      : currentRound?.unitClubMode ?? storedBlock.unitClubMode,
    halfSplitOnlyMatches:
      currentRound?.halfSplitOnlyMatches ?? storedBlock.halfSplitOnlyMatches,
    participantOrder:
      currentRound?.participantOrder ?? storedBlock.participantOrder,
  };
  const deletedMatchIds = new Set(block.deletedMatchIds ?? []);
  const withoutDeleted = (matches: LeagueMatch[]) =>
    matches
      .filter((match) => !deletedMatchIds.has(match.id))
      .map((match) => ({
        ...match,
        is_program: true,
        program_round: round,
        program_block_type: block.type,
      }));

  const players = toProgramPlayers(participants);
  const defaultFormationSeed = round * 1000;
  const teamFormationPlayers = shuffleWithinLevel(players, block.teamShuffleSeed ?? defaultFormationSeed + 101);
  const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
  const teamFormationSizes = block.teamFormationSizes?.length
    ? block.teamFormationSizes
    : buildTeamFormationSizes(players.length, block.teamPlayerCount ?? 4);
  let matchUnits: MatchUnit[] = block.type === "TEAM"
    ? block.teamAssignments?.length
      ? teamUnitsFromAssignments(block.teamAssignments, players)
      : toTeamUnitsFromGroupSizes(teamFormationPlayers, teamFormationSizes, block.unitClubMode ?? "mixed")
    : block.type === "DOUBLES"
      ? toDoublesUnits(players, block.doublesAssignments, block.unitClubMode ?? "mixed")
      : players;

  // The internal top-vs-bottom mode must start from the canonical seed order.
  // Reusing a previously saved bracket edit order can interleave the two sides
  // (for example 1, 10, 2, 9...) and turns NO-GAME cells into a checkerboard.
  if (block.participantOrder?.length && !block.halfSplitOnlyMatches) {
    const order = new Map(block.participantOrder.map((id, index) => [id, index]));
    matchUnits = [...matchUnits].sort((left, right) =>
      ((left.id ? order.get(left.id) : undefined) ?? Number.MAX_SAFE_INTEGER)
      - ((right.id ? order.get(right.id) : undefined) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  if (matchUnits.length < 2) {
    return [];
  }

  const isFinalRound =
    round > 1 &&
    (
      currentRound?.option === "FINAL" ||
      block.roundOption === "FINAL" ||
      block.title.includes("본선")
    );
  const sourceRound = block.sourceRoundId ?? round - 1;
  const previousBlock = option?.blocks?.[sourceRound - 1];
  // A later round never recalculates standings from its own generation path.
  // It only consumes the snapshot finalized and saved by the source round.
  const rankedPools = isFinalRound
    ? getSavedRankedUnitPools(option, sourceRound, matchUnits)
    : null;
  const finalMode = block.finalAdvancementMode ?? "top-n";
  const advanceCount = Math.max(1, block.advanceCount ?? 2);
  const advancesEveryone = finalMode === "all";
  const tournamentBuilder = block.tournamentMode === "upper-lower"
    ? buildUpperLowerTournamentMatches
    : buildTournamentMatches;
  const previousGroupSizes = previousBlock?.groupSizes ?? option?.groupSizes ?? [];
  const placeholderPools = isFinalRound && !rankedPools
    ? previousBlock?.format === "GROUP" && previousGroupSizes.length > 0
      ? buildRankPlaceholderPools(previousGroupSizes)
      : previousBlock?.format === "LEAGUE"
        ? buildSingleLeagueRankPlaceholderPool(matchUnits.length)
        : previousBlock?.format === "TOURNAMENT"
          ? buildTournamentRankPlaceholderPool(sourceRound, advanceCount)
          : null
    : null;
  const finalPools = rankedPools ?? placeholderPools;
  const selectedFinalUnits = finalPools
    ? advancesEveryone
      ? finalPools.flat()
      : Array.from({ length: advanceCount }, (_, rankIndex) => rankIndex)
          .flatMap((rankIndex) =>
            finalPools.flatMap((pool) => pool[rankIndex] ? [pool[rankIndex]] : [])
          )
    : [];

  if (block.format === "TOURNAMENT") {
    if (isFinalRound) {
      const bracketCount = block.tournamentBracketCount ?? 1;
      const qualifiedPools = finalPools?.map((pool) => advancesEveryone ? pool : pool.slice(0, advanceCount));
      const crossGroupSeedOrder =
        bracketCount === 1 && qualifiedPools
          ? buildCrossGroupTournamentSeedOrder(qualifiedPools)
          : null;
      const tournamentBrackets = crossGroupSeedOrder?.length
        ? [crossGroupSeedOrder]
        : qualifiedPools?.length
          ? distributeRankedUnitPoolsToBrackets(qualifiedPools, bracketCount)
          : [];
      return withoutDeleted(tournamentBrackets.flatMap((bracketPlayers, bracketIndex) =>
        tournamentBuilder(
          leagueId,
          round - 1,
          block,
          bracketPlayers,
          finalPools ? "seed" : undefined,
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
      if (selectedFinalUnits.length < 2) return [];
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
      if (!finalPools) return [];

      let finalGroups: Array<{ name: string; players: MatchUnit[] }> = [];
      if (finalMode === "upper-lower-groups") {
        const upper = finalPools.flatMap((pool) => pool.slice(0, Math.ceil(pool.length / 2)));
        const lower = finalPools.flatMap((pool) => pool.slice(Math.ceil(pool.length / 2)));
        finalGroups = [
          { name: "상위부", players: upper },
          { name: "하위부", players: lower },
        ].filter((group) => group.players.length > 1);
      } else if (finalMode === "rank-groups") {
        const maxRank = Math.max(0, ...finalPools.map((pool) => pool.length));
        finalGroups = Array.from({ length: maxRank }, (_, rankIndex) => ({
          name: `${rankIndex + 1}위조`,
          players: finalPools.flatMap((pool) => pool[rankIndex] ? [pool[rankIndex]] : []),
        })).filter((group) => group.players.length > 1);
      } else {
        const preferredGroupCount = Math.max(1, block.groupSizes?.length ?? finalPools.length);
        finalGroups = distributeQualifiedPoolsToFinalGroups(
          finalPools,
          advanceCount,
          preferredGroupCount,
        ).map((players, index) => ({
          name: `${index + 1}조`,
          players,
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
      : block.type === "DOUBLES" && groupSizes.reduce((sum, size) => sum + size, 0) !== matchUnits.length
        ? balancedSizes(matchUnits.length, Math.min(2, matchUnits.length))
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
