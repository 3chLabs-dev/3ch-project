import type {
  AddParticipantsRequest,
  CreateLeagueRequest,
  League,
  LeagueListItem,
  LeagueMatch,
  LeagueParticipantItem,
  UpdateMatchRequest,
  UpdateParticipantRequest,
} from "../features/league/leagueApi";
import { LOCAL_DEV_GROUP, LOCAL_DEV_USER } from "./localDevAuth";

const LOCAL_DEV_LEAGUES_KEY = "local-dev-leagues";
const LOCAL_DEV_PARTICIPANTS_KEY = "local-dev-participants";
const LOCAL_DEV_PROGRAMS_KEY = "local-dev-programs";
const LOCAL_DEV_MATCHES_KEY = "local-dev-matches";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalDevLeagues() {
  return readJson<LeagueListItem[]>(LOCAL_DEV_LEAGUES_KEY, []);
}

export function getLocalDevLeague(id: string) {
  return getLocalDevLeagues().find((league) => league.id === id || league.league_code === id) ?? null;
}

export function getLocalDevParticipants(leagueId: string) {
  const all = readJson<Record<string, LeagueParticipantItem[]>>(LOCAL_DEV_PARTICIPANTS_KEY, {});
  return all[leagueId] ?? [];
}

export function getLocalDevMatches(leagueId: string) {
  const all = readJson<Record<string, LeagueMatch[]>>(LOCAL_DEV_MATCHES_KEY, {});
  return all[leagueId] ?? [];
}

function saveLocalDevMatches(leagueId: string, matches: LeagueMatch[]) {
  const all = readJson<Record<string, LeagueMatch[]>>(LOCAL_DEV_MATCHES_KEY, {});
  all[leagueId] = matches;
  writeJson(LOCAL_DEV_MATCHES_KEY, all);
}

export function initLocalDevMatches(leagueId: string, force = false) {
  const existing = getLocalDevMatches(leagueId);
  if (existing.length > 0 && !force) return existing;

  const participants = getLocalDevParticipants(leagueId);
  const matches: LeagueMatch[] = [];
  let matchOrder = 1;

  for (let a = 0; a < participants.length; a += 1) {
    for (let b = a + 1; b < participants.length; b += 1) {
      const participantA = participants[a];
      const participantB = participants[b];
      matches.push({
        id: `${leagueId}-M${matchOrder}`,
        match_order: matchOrder,
        participant_a_id: participantA.id,
        participant_b_id: participantB.id,
        participant_a_name: participantA.name,
        participant_a_division: participantA.division ?? null,
        participant_b_name: participantB.name,
        participant_b_division: participantB.division ?? null,
        score_a: null,
        score_b: null,
        court: null,
        status: "pending",
        bracket: null,
      });
      matchOrder += 1;
    }
  }

  saveLocalDevMatches(leagueId, matches);
  return matches;
}

export function updateLocalDevMatch(leagueId: string, matchId: string, updates: UpdateMatchRequest) {
  const matches = getLocalDevMatches(leagueId).map((match) => (
    match.id === matchId ? { ...match, ...updates } : match
  ));
  saveLocalDevMatches(leagueId, matches);
  return matches.find((match) => match.id === matchId) ?? null;
}

function saveLocalDevParticipants(leagueId: string, participants: LeagueParticipantItem[]) {
  const all = readJson<Record<string, LeagueParticipantItem[]>>(LOCAL_DEV_PARTICIPANTS_KEY, {});
  all[leagueId] = participants;
  writeJson(LOCAL_DEV_PARTICIPANTS_KEY, all);
}

function updateLeagueParticipantCount(leagueId: string, participantCount: number) {
  const leagues = getLocalDevLeagues().map((league) =>
    league.id === leagueId ? { ...league, participant_count: participantCount } : league,
  );
  writeJson(LOCAL_DEV_LEAGUES_KEY, leagues);
}

export function createLocalDevLeague(
  body: CreateLeagueRequest & {
    group_id?: string;
    format?: string;
    recruit_count?: number;
    participant_count?: number;
    sort_order?: string;
    participants?: { division: string; name: string; member_id?: number | null; paid?: boolean; arrived?: boolean; after?: boolean }[];
    tournament_seeding?: string;
    tournament_advancement?: string;
    tournament_rules?: string;
    advance_count?: number;
    advance_method?: string;
    finals_advance?: number;
  },
) {
  const now = new Date().toISOString();
  const id = `LOCAL${Date.now()}`;
  const league: LeagueListItem = {
    id,
    league_code: id,
    name: body.name,
    description: body.description,
    title: body.title,
    type: body.type,
    format: body.format,
    sport: body.sport,
    start_date: body.start_date,
    end_date: body.end_date,
    court_count: body.court_count,
    rules: body.rules,
    sort_order: body.sort_order,
    recruit_count: body.recruit_count ?? body.participants?.length ?? 0,
    participant_count: body.participants?.length ?? body.participant_count ?? 0,
    group_id: body.group_id ?? LOCAL_DEV_GROUP.id,
    group_name: LOCAL_DEV_GROUP.name,
    status: "draft",
    tournament_seeding: body.tournament_seeding,
    tournament_advancement: body.tournament_advancement,
    tournament_rules: body.tournament_rules,
    advance_count: body.advance_count,
    advance_method: body.advance_method,
    finals_advance: body.finals_advance,
    created_by_id: LOCAL_DEV_USER.id,
    creator_name: LOCAL_DEV_USER.name ?? "",
    created_at: now,
    updated_at: now,
  };

  writeJson(LOCAL_DEV_LEAGUES_KEY, [league, ...getLocalDevLeagues()]);

  const participants: LeagueParticipantItem[] = (body.participants ?? []).map((participant, index) => ({
    id: `${id}-P${index + 1}`,
    league_id: id,
    division: participant.division,
    name: participant.name,
    member_id: participant.member_id ?? null,
    paid: participant.paid ?? false,
    arrived: participant.arrived ?? false,
    after: participant.after ?? false,
    sort_order: index + 1,
    created_at: now,
    group_name: LOCAL_DEV_GROUP.name,
  }));
  saveLocalDevParticipants(id, participants);

  return league as League;
}

export function addLocalDevParticipants({ leagueId, participants }: AddParticipantsRequest) {
  const now = new Date().toISOString();
  const current = getLocalDevParticipants(leagueId);
  const nextParticipants = [
    ...current,
    ...participants.map((participant, index) => ({
      id: `${leagueId}-P${current.length + index + 1}-${Date.now()}`,
      league_id: leagueId,
      division: participant.division,
      name: participant.name,
      member_id: participant.member_id ?? null,
      paid: false,
      arrived: false,
      after: false,
      sort_order: current.length + index + 1,
      created_at: now,
      group_name: LOCAL_DEV_GROUP.name,
    })),
  ];
  saveLocalDevParticipants(leagueId, nextParticipants);
  updateLeagueParticipantCount(leagueId, nextParticipants.length);
  return nextParticipants;
}

export function updateLocalDevParticipant(leagueId: string, participantId: string, updates: UpdateParticipantRequest) {
  const participants = getLocalDevParticipants(leagueId).map((participant) =>
    participant.id === participantId ? { ...participant, ...updates } : participant,
  );
  saveLocalDevParticipants(leagueId, participants);
  return participants.find((participant) => participant.id === participantId) ?? null;
}

export function deleteLocalDevParticipant(leagueId: string, participantId: string) {
  const participants = getLocalDevParticipants(leagueId).filter((participant) => participant.id !== participantId);
  saveLocalDevParticipants(leagueId, participants);
  updateLeagueParticipantCount(leagueId, participants.length);
}

export function getLocalDevProgram(leagueId: string) {
  const programs = readJson<Record<string, unknown>>(LOCAL_DEV_PROGRAMS_KEY, {});
  return programs[leagueId] ?? null;
}

export function saveLocalDevProgram(leagueId: string, programData: unknown) {
  const programs = readJson<Record<string, unknown>>(LOCAL_DEV_PROGRAMS_KEY, {});
  programs[leagueId] = programData;
  writeJson(LOCAL_DEV_PROGRAMS_KEY, programs);
  return programData;
}

export function deleteLocalDevProgram(leagueId: string) {
  const programs = readJson<Record<string, unknown>>(LOCAL_DEV_PROGRAMS_KEY, {});
  delete programs[leagueId];
  writeJson(LOCAL_DEV_PROGRAMS_KEY, programs);
}
