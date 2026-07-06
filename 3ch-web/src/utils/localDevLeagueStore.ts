import type {
  AddParticipantsRequest,
  CreateLeagueRequest,
  League,
  LeagueListItem,
  LeagueParticipantItem,
  UpdateParticipantRequest,
} from "../features/league/leagueApi";
import { LOCAL_DEV_GROUP, LOCAL_DEV_USER } from "./localDevAuth";

const LOCAL_DEV_LEAGUES_KEY = "local-dev-leagues";
const LOCAL_DEV_PARTICIPANTS_KEY = "local-dev-participants";

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
