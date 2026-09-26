import { baseApi } from "../api/baseApi";

export type TournamentLeagueType = "SINGLES" | "DOUBLES" | "TEAM";
export type TournamentFormat = "LEAGUE" | "GROUP" | "TOURNAMENT" | "GROUP_TOURNAMENT";

export interface TournamentDivisionInput {
  name: string;
  league_type: TournamentLeagueType;
  format: TournamentFormat;
  rules: { match_rule: string; [key: string]: unknown };
  recruit_count: number | null;
}

export interface CreateTournamentRequest {
  title: string;
  description?: string | null;
  sport?: string;
  venue_name?: string | null;
  venue_address?: string | null;
  notice?: string | null;
  court_count?: number | null;
  recruit_count?: number | null;
  starts_at: string;
  ends_at?: string | null;
  host_group_id: string;
  premium_visible: boolean;
  divisions: TournamentDivisionInput[];
}

export const tournamentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTournamentEligibility: builder.query<{ can_create: boolean }, void>({
      query: () => "/tournaments/eligibility",
    }),
    createTournament: builder.mutation<{ tournament: { id: string } }, CreateTournamentRequest>({
      query: (body) => ({ url: "/tournaments", method: "POST", body }),
      invalidatesTags: ["Tournament"],
    }),
  }),
});

export const { useGetTournamentEligibilityQuery, useCreateTournamentMutation } = tournamentApi;
