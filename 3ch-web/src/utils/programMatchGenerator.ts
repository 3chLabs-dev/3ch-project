import type { LeagueMatch, LeagueParticipantItem } from "../features/league/leagueApi";
import { distributeSnake } from "../features/league/algorithms/distributeSnake";
import type { ProgramBlock, ProgramOption } from "../features/league/types/tournament.types";
import { generateRoundRobin } from "./leagueUtils";

type ProgramPlayer = {
  id: string;
  name: string;
  division: string | null;
  level: number;
};

type MatchUnit = {
  id: string | null;
  name: string | null;
  division?: string | null;
  level?: number;
  roster?: string[];
  rosterDetails?: Array<{ name: string; division: string | null }>;
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

function makeMatch(
  id: string,
  order: number,
  a: { id: string | null; name: string | null; division?: string | null },
  b: { id: string | null; name: string | null; division?: string | null },
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
) {
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, players.length)));
  const emptySlots = Array.from<MatchUnit | null>({ length: bracketSize }).fill(null);
  const seeding = block.tournamentSeeding ?? "seed";

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

function buildTournamentMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: MatchUnit[],
): LeagueMatch[] {
  const matches: LeagueMatch[] = [];
  const slots = buildTournamentSlots(leagueId, roundIndex, block, players);
  const bracketSize = slots.length;
  let previousRoundIds: string[] = [];

  for (let bracketRound = 1, matchCount = bracketSize / 2; matchCount >= 1; bracketRound += 1, matchCount /= 2) {
    const currentRoundIds: string[] = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const matchId = `program-${leagueId}-r${roundIndex + 1}-t-r${bracketRound}-m${matchIndex + 1}`;
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
        bracketRound === 1 ? `1-${matchIndex + 1}` : `R${bracketRound}`,
      );
      matches.push(match);
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

export function getStoredProgramOption(leagueId: string): ProgramOption | null {
  try {
    const raw = localStorage.getItem(`league-program-${leagueId}`);
    return raw ? (JSON.parse(raw) as ProgramOption) : null;
  } catch {
    return null;
  }
}

export function generateProgramRoundMatches(
  leagueId: string,
  option: ProgramOption | null,
  participants: LeagueParticipantItem[],
  round: number,
): LeagueMatch[] {
  const block = option?.blocks?.[round - 1];
  if (!block || participants.length < 2) return [];

  const players = toProgramPlayers(participants);
  const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
  const matchUnits: MatchUnit[] = block.type === "TEAM"
    ? toTeamUnitsFromGroupSizes(players, groupSizes)
    : block.type === "DOUBLES"
      ? toDoublesUnits(players)
      : players;

  if (matchUnits.length < 2) {
    return [];
  }

  if (block.format === "TOURNAMENT") {
    return buildTournamentMatches(leagueId, round - 1, block, matchUnits);
  }

  if (block.type === "TEAM") {
    return buildUnitRoundRobinMatches(leagueId, round - 1, block, matchUnits);
  }

  if (block.format === "GROUP") {
    const groups = distributeSnake(matchUnits as ProgramPlayer[], groupSizes);
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
