import { baseApi } from "../api/baseApi";

export type TournamentLeagueType = "SINGLES" | "DOUBLES" | "TEAM";
export type TournamentFormat = "LEAGUE" | "GROUP" | "TOURNAMENT" | "GROUP_TOURNAMENT";

export interface TournamentRoundInput {
  league_type: TournamentLeagueType;
  format: TournamentFormat;
  rules: { match_rule: string; [key: string]: unknown };
}

export interface TournamentDivisionInput {
  name: string;
  recruit_count: number | null;
  rounds: TournamentRoundInput[];
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
  application_deadline_at?: string | null;
  host_group_id: string;
  premium_visible: boolean;
  divisions: TournamentDivisionInput[];
}

export interface TournamentRound extends TournamentRoundInput { id: string; round_no: number }
export interface TournamentDivision { id: string; name: string; status: string; recruit_count: number | null; applicant_count: number; confirmed_count: number; rounds: TournamentRound[] }
export interface TournamentItem { id: string; title: string; notice?: string | null; entry_fee?: number | null; bank_account?: string | null; starts_at: string; ends_at: string | null; application_deadline_at: string | null; premium_visible: boolean; status: string; venue_name?: string | null; venue_address?: string | null; court_count?: number | null; recruit_count?: number | null; host_group_id: string; host_group_name?: string; can_manage?: boolean; can_manage_draw?: boolean; can_manage_settlement?: boolean; can_delete?: boolean; can_apply?: boolean; divisions?: TournamentDivision[] }
export interface TournamentDeleteSummary { draws?: number; settlements?: number; settlement_payments?: number; receipt_scans?: number; divisions: number; rounds: number; participants: number; pools: number; matches: number; recorded_matches: number; invited_groups: number }
export interface TournamentMatch { id: string; division_id: string; program_round: number | null; participant_a_id: string | null; participant_b_id: string | null; score_a: number | null; score_b: number | null; status: string; phase: string; round_no: number | null; pool_name: string | null; match_order: number }
export interface TournamentStanding { id: string; name: string; member_division: string | null; club_name: string; rank: number; played: number; wins: number; losses: number; sets_for: number; sets_against: number }
export interface TournamentRoundResult extends TournamentRound { complete: boolean; match_count: number; completed_match_count: number; standings: TournamentStanding[]; matches: TournamentMatch[]; pools: Array<{ name: string; standings: TournamentStanding[] }> }
export interface TournamentDivisionResult extends Omit<TournamentDivision, "rounds"> { rounds: TournamentRoundResult[]; unassigned_match_count?: number }
export interface TournamentParticipant { can_withdraw?: boolean; id: string; division_id: string; division_name?: string; member_id: number | null; pre_member_id?: string | null; name: string; member_division: string | null; status: "applied" | "confirmed" | "withdrawn"; source_group_id: string | null; club_name: string }
export interface TournamentPool { id: string; pool_no: number; round_no: number; bracket_slot: number; members: Array<Pick<TournamentParticipant, "id" | "name" | "member_division" | "source_group_id" | "club_name"> & { slot_no: number; status?: string }> }

export const tournamentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTournamentEligibility: builder.query<{ can_create: boolean }, void>({
      query: () => "/tournaments/eligibility",
    }),
    createTournament: builder.mutation<{ tournament: { id: string } }, CreateTournamentRequest>({
      query: (body) => ({ url: "/tournaments", method: "POST", body }),
      invalidatesTags: ["Tournament"],
    }),
    getTournaments: builder.query<{ tournaments: TournamentItem[] }, void>({ query: () => "/tournaments", providesTags: ["Tournament"] }),
    getTournament: builder.query<{ tournament: TournamentItem }, string>({ query: (id) => `/tournaments/${id}`, providesTags: ["Tournament"] }),
    getTournamentResults: builder.query<{ divisions: TournamentDivisionResult[] }, string>({ query: (id) => `/tournaments/${id}/results`, providesTags: ["Tournament"] }),
    registerTournamentParticipants: builder.mutation<unknown, { id: string; group_id: string | null; rows: Array<{ division_id: string; name: string; member_division: string; member_id?: number | null; pre_member_id?: string | null }> }>({ query: ({ id, ...body }) => ({ url: `/tournaments/${id}/participants/manual`, method: "POST", body }), invalidatesTags: ["Tournament"] }),
    withdrawTournamentParticipant: builder.mutation<unknown, { id: string; participantId: string; confirmation_intent: "WITHDRAW_TOURNAMENT_PARTICIPANT" }>({ query: ({ id, participantId, ...body }) => ({ url: `/tournaments/${id}/participants/${participantId}/withdraw`, method: "POST", body }), invalidatesTags: ["Tournament"] }),
    getTournamentDeletePreview: builder.query<{ title: string; summary: TournamentDeleteSummary }, string>({ query: (id) => `/tournaments/${id}/delete-preview` }),
    deleteTournament: builder.mutation<{ message: string }, { id: string; confirmation_text: string; expected_summary: TournamentDeleteSummary; confirmation_intent: "DELETE_TOURNAMENT_AND_ALL_DATA" }>({ query: ({ id, ...body }) => ({ url: `/tournaments/${id}`, method: "DELETE", body }), invalidatesTags: ["Tournament"] }),
    updateTournament: builder.mutation<{ tournament: TournamentItem }, { id: string; body: Partial<Pick<CreateTournamentRequest, "title" | "venue_name" | "venue_address" | "court_count" | "recruit_count" | "starts_at" | "ends_at" | "application_deadline_at">> & { notice?: string | null; entry_fee?: number | null; bank_account?: string | null } }>({ query: ({ id, body }) => ({ url: `/tournaments/${id}`, method: "PATCH", body }), invalidatesTags: ["Tournament"] }),
    updateTournamentVisibility: builder.mutation<unknown, { id: string; premium_visible: boolean }>({ query: ({ id, premium_visible }) => ({ url: `/tournaments/${id}/visibility`, method: "PATCH", body: { premium_visible } }), invalidatesTags: ["Tournament"] }),
    updateTournamentDivision: builder.mutation<unknown, { id: string; divisionId: string; name: string; recruit_count: number | null }>({ query: ({ id, divisionId, ...body }) => ({ url: `/tournaments/${id}/divisions/${divisionId}`, method: "PATCH", body }), invalidatesTags: ["Tournament"] }),
    updateTournamentRound: builder.mutation<unknown, { id: string; divisionId: string; roundId: string; body: TournamentRoundInput }>({ query: ({ id, divisionId, roundId, body }) => ({ url: `/tournaments/${id}/divisions/${divisionId}/rounds/${roundId}`, method: "PATCH", body }), invalidatesTags: ["Tournament"] }),
    addTournamentRound: builder.mutation<unknown, { id: string; divisionId: string; body: TournamentRoundInput }>({ query: ({ id, divisionId, body }) => ({ url: `/tournaments/${id}/divisions/${divisionId}/rounds`, method: "POST", body }), invalidatesTags: ["Tournament"] }),
    saveTournamentProgram: builder.mutation<unknown, { id: string; divisionId: string; body: { name: string; recruit_count: number | null; rounds: Array<TournamentRoundInput & { id?: string }> } }>({ query: ({ id, divisionId, body }) => ({ url: `/tournaments/${id}/divisions/${divisionId}/program`, method: "PUT", body }), invalidatesTags: ["Tournament"] }),
    openTournament: builder.mutation<unknown, string>({ query: (id) => ({ url: `/tournaments/${id}/status`, method: "PATCH", body: { status: "open" } }), invalidatesTags: ["Tournament"] }),
    getTournamentParticipants: builder.query<{ participants: TournamentParticipant[] }, { id: string; divisionId: string }>({ query: ({ id, divisionId }) => `/tournaments/${id}/divisions/${divisionId}/participants`, providesTags: ["Tournament"] }),
    getTournamentParticipantsAll: builder.query<{ participants: TournamentParticipant[] }, string>({ query: (id) => `/tournaments/${id}/participants`, providesTags: ["Tournament"] }),
    getTournamentApplicationRoster: builder.query<{ participants: TournamentParticipant[] }, { id: string; groupId: string | null }>({ query: ({ id, groupId }) => `/tournaments/${id}/applications/roster${groupId ? `?group_id=${encodeURIComponent(groupId)}` : ""}`, providesTags: ["Tournament"] }),
    saveTournamentApplicationRoster: builder.mutation<unknown, { id: string; group_id: string | null; rows: Array<{ id?: string; division_id: string; name: string; member_division: string | null; previous_member_division?: string | null; member_id?: number | null; pre_member_id?: string | null; cancel?: boolean }>; confirmation_intent?: "CANCEL_TOURNAMENT_PARTICIPANTS" }>({ query: ({ id, ...body }) => ({ url: `/tournaments/${id}/applications/roster`, method: "PUT", body }), invalidatesTags: ["Tournament"] }),
    confirmTournamentClub: builder.mutation<unknown, { id: string; groupId: string; participant_ids: string[] }>({ query: ({ id, groupId, participant_ids }) => ({ url: `/tournaments/${id}/clubs/${encodeURIComponent(groupId)}/confirm`, method: "POST", body: { participant_ids } }), invalidatesTags: ["Tournament"] }),
    reviewTournamentApplication: builder.mutation<unknown, { id: string; divisionId: string; participantId: string; status: "confirmed" | "rejected"; confirmation_intent?: string }>({ query: ({ id, divisionId, participantId, ...body }) => ({ url: `/tournaments/${id}/divisions/${divisionId}/applications/${participantId}`, method: "PATCH", body }), invalidatesTags: ["Tournament"] }),
    updateTournamentParticipantDivision: builder.mutation<unknown, { id: string; participantId: string; member_division: string; previous_member_division: string | null }>({ query: ({ id, participantId, ...body }) => ({ url: `/tournaments/${id}/participants/${participantId}/division`, method: "PATCH", body }), invalidatesTags: ["Tournament"] }),
    getTournamentPools: builder.query<{ pools: TournamentPool[] }, { id: string; divisionId: string }>({ query: ({ id, divisionId }) => `/tournaments/${id}/divisions/${divisionId}/pools`, providesTags: ["Tournament"] }),
    previewTournamentPools: builder.query<{ participant_ids: string[]; pools: Array<{ pool_no: number; bracket_slot: number; members: TournamentPool["members"] }> }, { id: string; divisionId: string; groupCount: number }>({ query: ({ id, divisionId, groupCount }) => `/tournaments/${id}/divisions/${divisionId}/pools/preview?group_count=${groupCount}` }),
    generateTournamentPools: builder.mutation<unknown, { id: string; divisionId: string; group_count: number; participant_ids: string[] }>({ query: ({ id, divisionId, group_count, participant_ids }) => ({ url: `/tournaments/${id}/divisions/${divisionId}/pools/generate`, method: "POST", body: { group_count, participant_ids } }), invalidatesTags: ["Tournament"] }),
  }),
});

export const { useGetTournamentResultsQuery, useRegisterTournamentParticipantsMutation, useWithdrawTournamentParticipantMutation, useGetTournamentEligibilityQuery, useCreateTournamentMutation, useGetTournamentsQuery, useGetTournamentQuery, useLazyGetTournamentDeletePreviewQuery, useDeleteTournamentMutation, useUpdateTournamentMutation, useUpdateTournamentVisibilityMutation, useUpdateTournamentDivisionMutation, useUpdateTournamentRoundMutation, useAddTournamentRoundMutation, useSaveTournamentProgramMutation, useOpenTournamentMutation, useGetTournamentParticipantsQuery, useGetTournamentParticipantsAllQuery, useGetTournamentApplicationRosterQuery, useSaveTournamentApplicationRosterMutation, useConfirmTournamentClubMutation, useReviewTournamentApplicationMutation, useUpdateTournamentParticipantDivisionMutation, useGetTournamentPoolsQuery, useLazyPreviewTournamentPoolsQuery, useGenerateTournamentPoolsMutation } = tournamentApi;
