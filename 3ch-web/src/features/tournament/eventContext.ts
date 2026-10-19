import { useGetLeagueQuery, useGetLeagueParticipantsQuery } from "../league/leagueApi";
import { useGetTournamentQuery, useGetTournamentParticipantsAllQuery } from "./tournamentApi";

import { isTournamentEvent, eventSourceId } from "./eventPaths";
export { tournamentEventId, drawPath } from "./eventPaths";

type Options = { permission?: "draw" | "settlement"; skip?: boolean; refetchOnMountOrArgChange?: boolean };
export function useEventCompetitionQuery(id: string, options: Options = {}) {
  const { permission, ...queryOptions } = options;
  const tournament = isTournamentEvent(id);
  const leagueQuery = useGetLeagueQuery(id, { ...queryOptions, skip: options.skip || tournament });
  const tournamentQuery = useGetTournamentQuery(eventSourceId(id), { ...queryOptions, skip: options.skip || !tournament });
  if (!tournament) return { ...leagueQuery, data: leagueQuery.data ? { ...leagueQuery.data, canManage: undefined as boolean | undefined } : undefined };
  const item = tournamentQuery.data?.tournament;
  return { ...tournamentQuery, data: item ? { canManage: permission === "draw" ? item.can_manage_draw : permission === "settlement" ? item.can_manage_settlement : item.can_manage, league: { id: item.id, name: item.title, title: item.title, group_id: item.host_group_id, start_date: item.starts_at, bank_account: item.bank_account ?? "", entry_fee: String(item.entry_fee ?? "") } } : undefined };
}
export function useEventParticipantsQuery(id: string, options: Options = {}) {
  const tournament = isTournamentEvent(id);
  const leagueQuery = useGetLeagueParticipantsQuery(id, { ...options, skip: options.skip || tournament });
  const tournamentQuery = useGetTournamentParticipantsAllQuery(eventSourceId(id), { ...options, skip: options.skip || !tournament });
  if (!tournament) return leagueQuery;
  return { ...tournamentQuery, data: tournamentQuery.data ? { participants: tournamentQuery.data.participants.map((person) => ({ ...person, name: `${person.name} (${person.club_name || "개인"})`, division: person.member_division, is_bot: false, after: false, paid: person.status === "confirmed", arrived: false })) } : undefined };
}
