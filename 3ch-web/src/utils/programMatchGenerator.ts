import type { LeagueMatch, LeagueParticipantItem } from "../features/league/leagueApi";
import { distributeSnake } from "../features/league/algorithms/distributeSnake";
import type { ProgramOption, ProgramBlock } from "../features/league/types/tournament.types";

type ProgramPlayer = {
  id: string;
  name: string;
  division: string | null;
  level: number;
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

function makeMatch(
  id: string,
  order: number,
  a: { id: string | null; name: string | null; division?: string | null },
  b: { id: string | null; name: string | null; division?: string | null },
  roundNumber?: number,
  bracket?: string | null,
  label?: string,
): LeagueMatch {
  return {
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
}

function buildRoundRobinMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: ProgramPlayer[],
  groupName?: string,
): LeagueMatch[] {
  const matches: LeagueMatch[] = [];
  let order = 1;

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      matches.push(makeMatch(
        `program-${leagueId}-r${roundIndex + 1}-${groupName ?? "all"}-${order}`,
        order,
        players[i],
        players[j],
        roundIndex + 1,
        null,
        block.format === "GROUP" && groupName ? groupName : undefined,
      ));
      order += 1;
    }
  }

  return matches;
}

function pairLabel(players: ProgramPlayer[]) {
  return players.map((player) => player.name).join(" / ");
}

function buildTeamLikeMatches(
  leagueId: string,
  roundIndex: number,
  block: ProgramBlock,
  players: ProgramPlayer[],
): LeagueMatch[] {
  const unitSize = block.type === "DOUBLES" ? 2 : 4;
  const units = [];
  for (let i = 0; i < players.length; i += unitSize) {
    const unit = players.slice(i, i + unitSize);
    if (unit.length === unitSize) units.push(unit);
  }

  const unitPlayers = units.map((unit, index) => ({
    id: `${unit.map((player) => player.id).join("+")}`,
    name: `${block.type === "DOUBLES" ? "페어" : "팀"} ${index + 1}: ${pairLabel(unit)}`,
    division: null,
  }));

  const matches: LeagueMatch[] = [];
  let order = 1;
  for (let i = 0; i < unitPlayers.length; i += 1) {
    for (let j = i + 1; j < unitPlayers.length; j += 1) {
      matches.push(makeMatch(
        `program-${leagueId}-r${roundIndex + 1}-team-${order}`,
        order,
        unitPlayers[i],
        unitPlayers[j],
        roundIndex + 1,
      ));
      order += 1;
    }
  }
  return matches;
}

function buildTournamentMatches(
  leagueId: string,
  roundIndex: number,
  players: ProgramPlayer[],
): LeagueMatch[] {
  const matches: LeagueMatch[] = [];
  for (let i = 0; i < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1] ?? { id: null, name: "BYE", division: null };
    matches.push(makeMatch(
      `program-${leagueId}-r${roundIndex + 1}-t-${Math.floor(i / 2) + 1}`,
      Math.floor(i / 2) + 1,
      a,
      b,
      1,
      "upper",
      `1-${Math.floor(i / 2) + 1}`,
    ));
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

  if (block.type === "DOUBLES" || block.type === "TEAM") {
    return buildTeamLikeMatches(leagueId, round - 1, block, players);
  }

  if (block.format === "TOURNAMENT") {
    return buildTournamentMatches(leagueId, round - 1, players);
  }

  if (block.format === "GROUP") {
    const groupSizes = block.groupSizes?.length ? block.groupSizes : option?.groupSizes ?? [players.length];
    const groups = distributeSnake(players, groupSizes);
    return groups.flatMap((group, groupIndex) =>
      buildRoundRobinMatches(
        leagueId,
        round - 1,
        block,
        group.players as ProgramPlayer[],
        `${groupIndex + 1}조`,
      ).map((match, index) => ({
        ...match,
        id: `${match.id}-${index + 1}`,
        match_order: index + 1,
      })),
    ).map((match, index) => ({ ...match, match_order: index + 1 }));
  }

  return buildRoundRobinMatches(leagueId, round - 1, block, players);
}
