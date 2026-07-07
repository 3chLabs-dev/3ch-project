import { baseApi } from "../api/baseApi";
import type { RootState } from "../../app/store";
import { isLocalDevToken } from "../../utils/localDevAuth";
import {
  addLocalDevParticipants,
  deleteLocalDevProgram,
  deleteLocalDevParticipant,
  getLocalDevLeague,
  getLocalDevLeagues,
  getLocalDevParticipants,
  getLocalDevProgram,
  saveLocalDevProgram,
  updateLocalDevParticipant,
} from "../../utils/localDevLeagueStore";

/**
 * API 요청 타입 정의
 */
export interface CreateLeagueRequest {
  name: string;
  description?: string;
  title?: string;
  type: string;
  sport: string;
  start_date: string;
  rules?: string;
}

export interface UpdateLeagueRequest {
  name?: string;
  description?: string;
  title?: string;
  type?: string;
  format?: string;
  sport?: string;
  start_date?: string;
  rules?: string;
  notice?: string;
  sort_order?: string;
  recruit_count?: number;
  status?: "draft" | "active" | "completed";
  join_permission?: "public" | "club_only";
  tournament_seeding?: string;
  tournament_advancement?: string;
  tournament_rules?: string;
  advance_count?: number | null;
  advance_method?: string;
  finals_advance?: number | null;
}

/**
 * API 응답 타입 정의
 */
export interface League {
  id: string;
  name: string;
  league_code?: string;
  description?: string;
  title?: string;
  type: string;
  format?: string;
  sport: string;
  start_date: string;
  rules?: string;
  notice?: string;
  sort_order?: string;
  recruit_count?: number;
  participant_count?: number;
  join_permission?: "public" | "club_only";
  group_id?: string;
  status: "draft" | "active" | "completed";
  tournament_seeding?: string;
  tournament_advancement?: string;
  tournament_rules?: string;
  advance_count?: number | null;
  advance_method?: string;
  finals_advance?: number | null;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLeagueResponse {
  message: string;
  league: League;
}

export interface GetLeagueResponse {
  league: League;
}

export interface LeagueListItem extends League {
  creator_name?: string;
  recruit_count: number;
  participant_count: number;
  group_id?: string;
  group_name?: string;
}

export interface LeagueParticipantItem {
  id: string;
  league_id: string;
  division?: string | null;
  name: string;
  member_id?: number | null;
  paid: boolean;
  arrived: boolean;
  after: boolean;
  sort_order?: number | null;
  created_at: string;
  group_name?: string | null;
}

export interface GetLeagueParticipantsResponse {
  participants: LeagueParticipantItem[];
}

export interface GetLeaguesParams {
  page?: number;
  limit?: number;
  sport?: string;
  status?: string;
  group_id?: string;
  my_groups?: boolean;
  user_id?: number;
}

export interface GetLeaguesResponse {
  leagues: LeagueListItem[];
  total: number;
  page: number;
  limit: number;
}

function normalizeLeaguesResponse(raw: unknown): GetLeaguesResponse {
  const data = (raw ?? {}) as Record<string, unknown>;
  const leagues = Array.isArray(data.leagues)
    ? (data.leagues as LeagueListItem[])
    : Array.isArray(data.rows)
      ? (data.rows as LeagueListItem[])
      : Array.isArray(raw)
        ? (raw as LeagueListItem[])
        : [];

  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.count === "number"
        ? data.count
        : leagues.length;

  const page = typeof data.page === "number" ? data.page : 1;
  const limit = typeof data.limit === "number" ? data.limit : leagues.length || 10;

  return { leagues, total, page, limit };
}

export interface UpdateLeagueResponse {
  message: string;
  league: League;
}

export interface UpdateParticipantRequest {
  division?: string;
  name?: string;
  paid?: boolean;
  arrived?: boolean;
  after?: boolean;
}

export interface UpdateParticipantResponse {
  message: string;
  participant: LeagueParticipantItem;
}

export interface DeleteParticipantResponse {
  message: string;
}

export interface LeagueMatch {
  id: string;
  match_order: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  participant_a_name: string | null;
  participant_a_division: string | null;
  participant_b_name: string | null;
  participant_b_division: string | null;
  score_a: number | null;
  score_b: number | null;
  court: string | null;
  status: "pending" | "playing" | "done";
  bracket?: string | null;
  round_number?: number | null;
  match_label?: string | null;
  next_match_id?: string | null;
  next_slot?: string | null;
  loser_next_match_id?: string | null;
  loser_next_slot?: string | null;
}

export interface InitTournamentRequest {
  leagueId: string;
  bracket_size: number;
  seeding?: string;
  advancement?: string;
  force?: boolean;
}

export interface GetLeagueMatchesResponse {
  matches: LeagueMatch[];
}

export interface UpdateMatchRequest {
  score_a?: number | null;
  score_b?: number | null;
  court?: string | null;
  status?: "pending" | "playing" | "done";
}

export interface LeagueOmrMark {
  matchId: string;
  playerId: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScanLeagueOmrRequest {
  leagueId: string;
  file: File;
  scenarios: { name?: string; marks: LeagueOmrMark[] }[];
  darknessThreshold?: number;
  marginThreshold?: number;
}

export interface ScanLeagueOmrResponse {
  engine: string;
  scenario: string;
  recognizedCount: number;
  completeMatchCount?: number;
  validMatchCount?: number;
  result: Record<string, Record<string, number>>;
  scenarios: Array<{
    name: string;
    imageVariant?: string;
    candidate?: string | null;
    transform?: string;
    xOffset?: number;
    yOffset?: number;
    recognizedCount: number;
    completeMatchCount?: number;
    validMatchCount?: number;
    confidence?: number;
    candidates?: Array<{
      name: string;
      recognizedCount: number;
      completeMatchCount?: number;
      validMatchCount?: number;
      confidence?: number;
      transform?: string;
      xOffset?: number;
      yOffset?: number;
    }>;
  }>;
}

export interface ScanOcrRequest {
  file: File;
  language?: string;
  psm?: number;
  maxSide?: number;
}

export interface ScanOcrResponse {
  engine: string;
  language: string;
  text: string;
  image: {
    width: number;
    height: number;
  };
  lines: Array<{
    text: string;
    confidence: number | null;
    bbox: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
  }>;
  words?: Array<{
    text: string;
    confidence: number | null;
    bbox: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
  }>;
}

export interface AddParticipantsRequest {
  leagueId: string;
  participants: { division: string; name: string; member_id?: number | null }[];
}

export interface AddParticipantsResponse {
  message: string;
  participants: LeagueParticipantItem[];
}

export interface SaveLeagueGroupingItem {
  participant_id: string;
  group_name: string;
}

export interface SaveLeagueGroupingRequest {
  leagueId: string;
  groupings: SaveLeagueGroupingItem[];
}

export interface SaveLeagueGroupingResponse {
  message: string;
}

export interface LeagueProgramRecord {
  id: string;
  league_id: string;
  program_data: unknown;
  created_by_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GetLeagueProgramResponse {
  program: LeagueProgramRecord | null;
}

export interface SaveLeagueProgramRequest {
  leagueId: string;
  program: unknown;
}

/**
 * RTK Query API endpoints
 */
export const leagueApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * 리그 목록 조회
     */
    getLeagues: builder.query<GetLeaguesResponse, GetLeaguesParams | void>({
      async queryFn(params, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          let leagues = getLocalDevLeagues();
          if (params?.group_id) leagues = leagues.filter((league) => league.group_id === params.group_id);
          return { data: normalizeLeaguesResponse({ leagues, total: leagues.length, page: 1, limit: leagues.length || 10 }) };
        }

        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set("page", String(params.page));
        if (params?.limit) searchParams.set("limit", String(params.limit));
        if (params?.sport) searchParams.set("sport", params.sport);
        if (params?.status) searchParams.set("status", params.status);
        if (params?.group_id) searchParams.set("group_id", params.group_id);
        if (params?.my_groups) searchParams.set("my_groups", "true");
        if (params?.user_id) searchParams.set("user_id", String(params.user_id));
        const qs = searchParams.toString();
        const result = await fetchWithBQ(`/league${qs ? `?${qs}` : ""}`);
        if (result.error) return { error: result.error };
        return { data: normalizeLeaguesResponse(result.data) };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.leagues.map((league) => ({ type: "League" as const, id: league.id })),
              { type: "League" as const, id: "LIST" },
            ]
          : [{ type: "League" as const, id: "LIST" }],
    }),

    /**
     * 리그 생성
     */
    createLeague: builder.mutation<CreateLeagueResponse, CreateLeagueRequest>({
      query: (body) => ({
        url: "/league",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "League", id: "LIST" }],
    }),

    /**
     * 리그 조회
     */
    getLeague: builder.query<GetLeagueResponse, string>({
      async queryFn(id, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          const league = getLocalDevLeague(id);
          return league ? { data: { league } } : { error: { status: 404, data: "Not Found" } };
        }
        const result = await fetchWithBQ(`/league/${id}`);
        return result.error ? { error: result.error } : { data: result.data as GetLeagueResponse };
      },
      providesTags: (_result, _error, id) => [{ type: "League", id }],
    }),

    getLeagueParticipants: builder.query<GetLeagueParticipantsResponse, string>({
      async queryFn(id, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          return { data: { participants: getLocalDevParticipants(id) } };
        }
        const result = await fetchWithBQ(`/league/${id}/participants`);
        return result.error ? { error: result.error } : { data: result.data as GetLeagueParticipantsResponse };
      },
      providesTags: (_result, _error, id) => [{ type: "League", id }],
    }),

    /**
     * 리그 수정
     */
    updateLeague: builder.mutation<
      UpdateLeagueResponse,
      { id: string; updates: UpdateLeagueRequest }
    >({
      query: ({ id, updates }) => ({
        url: `/league/${id}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "League", id },
        { type: "League", id: "LIST" },
      ],
    }),

    /**
     * 참가자 정보 수정
     */
    updateParticipant: builder.mutation<
      UpdateParticipantResponse,
      { leagueId: string; participantId: string; updates: UpdateParticipantRequest }
    >({
      async queryFn({ leagueId, participantId, updates }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          const participant = updateLocalDevParticipant(leagueId, participantId, updates);
          return participant
            ? { data: { message: "updated", participant } }
            : { error: { status: 404, data: "Not Found" } };
        }
        const result = await fetchWithBQ({
          url: `/league/${leagueId}/participants/${participantId}`,
          method: "PUT",
          body: updates,
        });
        return result.error ? { error: result.error } : { data: result.data as UpdateParticipantResponse };
      },
      async onQueryStarted({ leagueId, participantId, updates }, { dispatch, queryFulfilled }) {
        // 낙관적 업데이트: 서버 응답 전 UI 즉시 반영
        const patchResult = dispatch(
          leagueApi.util.updateQueryData("getLeagueParticipants", leagueId, (draft) => {
            const participant = draft.participants.find((p) => p.id === participantId);
            if (participant) Object.assign(participant, updates);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo(); // 서버 실패 시 롤백
        }
      },
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
      ],
    }),

    deleteParticipant: builder.mutation<
    DeleteParticipantResponse,
    { leagueId: string; participantId: string }
  >({
    async queryFn({ leagueId, participantId }, api, _extraOptions, fetchWithBQ) {
      const token = (api.getState() as RootState).auth?.token;
      if (isLocalDevToken(token)) {
        deleteLocalDevParticipant(leagueId, participantId);
        return { data: { message: "deleted" } };
      }
      const result = await fetchWithBQ({
        url: `/league/${leagueId}/participants/${participantId}`,
        method: "DELETE",
      });
      return result.error ? { error: result.error } : { data: result.data as DeleteParticipantResponse };
    },
    invalidatesTags: (_result, _error, { leagueId }) => [
      { type: "League", id: leagueId },
      { type: "League", id: "LIST" },
      ],
    }),

    addParticipants: builder.mutation<AddParticipantsResponse, AddParticipantsRequest>({
      async queryFn({ leagueId, participants }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          return { data: { message: "created", participants: addLocalDevParticipants({ leagueId, participants }) } };
        }
        const result = await fetchWithBQ({
          url: `/league/${leagueId}/participants`,
          method: "POST",
          body: { participants },
        });
        return result.error ? { error: result.error } : { data: result.data as AddParticipantsResponse };
      },
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
      ],
    }),

    deleteLeague: builder.mutation<{ message: string }, { leagueId: string }>({
      query: ({ leagueId }) => ({
        url: `/league/${leagueId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "League", id: "LIST" }],
    }),

    getLeagueProgram: builder.query<GetLeagueProgramResponse, string>({
      async queryFn(id, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          const programData = getLocalDevProgram(id);
          return {
            data: {
              program: programData
                ? {
                    id: `${id}-program`,
                    league_id: id,
                    program_data: programData,
                    created_at: new Date(0).toISOString(),
                    updated_at: new Date().toISOString(),
                  }
                : null,
            },
          };
        }
        const result = await fetchWithBQ(`/league/${id}/program`);
        return result.error ? { error: result.error } : { data: result.data as GetLeagueProgramResponse };
      },
      providesTags: (_result, _error, id) => [{ type: "League", id: `program-${id}` }],
    }),

    saveLeagueProgram: builder.mutation<GetLeagueProgramResponse, SaveLeagueProgramRequest>({
      async queryFn({ leagueId, program }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          const programData = saveLocalDevProgram(leagueId, program);
          return {
            data: {
              program: {
                id: `${leagueId}-program`,
                league_id: leagueId,
                program_data: programData,
                created_at: new Date(0).toISOString(),
                updated_at: new Date().toISOString(),
              },
            },
          };
        }
        const result = await fetchWithBQ({
          url: `/league/${leagueId}/program`,
          method: "PUT",
          body: { program_data: program },
        });
        return result.error ? { error: result.error } : { data: result.data as GetLeagueProgramResponse };
      },
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: `program-${leagueId}` },
        { type: "League", id: leagueId },
      ],
    }),

    deleteLeagueProgram: builder.mutation<{ ok: boolean }, { leagueId: string }>({
      async queryFn({ leagueId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          deleteLocalDevProgram(leagueId);
          return { data: { ok: true } };
        }
        const result = await fetchWithBQ({
          url: `/league/${leagueId}/program`,
          method: "DELETE",
        });
        return result.error ? { error: result.error } : { data: result.data as { ok: boolean } };
      },
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: `program-${leagueId}` },
        { type: "League", id: leagueId },
      ],
    }),

    getLeagueMatches: builder.query<GetLeagueMatchesResponse, string>({
      query: (id) => `/league/${id}/matches`,
      providesTags: (_result, _error, id) => [{ type: "League", id: `matches-${id}` }],
    }),

    initLeagueMatches: builder.mutation<GetLeagueMatchesResponse, { id: string; force?: boolean }>({
      query: ({ id, force }) => ({ url: `/league/${id}/matches/init${force ? "?force=true" : ""}`, method: "POST" }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "League", id: `matches-${id}` }],
    }),

    extendLeagueMatches: builder.mutation<
      GetLeagueMatchesResponse,
      { id: string }
    >({
      query: ({ id }) => ({
        url: `/league/${id}/matches/extend`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "League", id: `matches-${id}` },
      ],
    }),

    updateLeagueMatch: builder.mutation<
      { match: LeagueMatch },
      { leagueId: string; matchId: string; updates: UpdateMatchRequest }
    >({
      query: ({ leagueId, matchId, updates }) => ({
        url: `/league/${leagueId}/matches/${matchId}`,
        method: "PATCH",
        body: updates,
      }),
      async onQueryStarted({ leagueId, matchId, updates }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          leagueApi.util.updateQueryData("getLeagueMatches", leagueId, (draft) => {
            const m = draft.matches.find((x) => x.id === matchId);
            if (m) Object.assign(m, updates);
          })
        );
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "League", id: `matches-${leagueId}` }],
    }),

    scanLeagueOmr: builder.mutation<ScanLeagueOmrResponse, ScanLeagueOmrRequest>({
      query: ({ leagueId, file, scenarios, darknessThreshold, marginThreshold }) => {
        const formData = new FormData();
        formData.append("image", file);
        formData.append(
          "payload",
          JSON.stringify({
            scenarios,
            darknessThreshold,
            marginThreshold,
          }),
        );
        return {
          url: `/league/${leagueId}/omr/scan`,
          method: "POST",
          body: formData,
        };
      },
    }),

    scanOcr: builder.mutation<ScanOcrResponse, ScanOcrRequest>({
      query: ({ file, language, psm, maxSide }) => {
        const formData = new FormData();
        formData.append("image", file);
        if (language) formData.append("language", language);
        if (psm !== undefined) formData.append("psm", String(psm));
        if (maxSide !== undefined) formData.append("maxSide", String(maxSide));
        return {
          url: "/ocr/scan",
          method: "POST",
          body: formData,
        };
      },
    }),

    reorderLeagueMatches: builder.mutation<{ ok: boolean }, { leagueId: string; order: string[] }>({
      query: ({ leagueId, order }) => ({
        url: `/league/${leagueId}/matches/reorder`,
        method: "PATCH",
        body: { order },
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "League", id: `matches-${leagueId}` }],
    }),

    deleteLeagueMatch: builder.mutation<{ ok: boolean }, { leagueId: string; matchId: string }>({
      query: ({ leagueId, matchId }) => ({
        url: `/league/${leagueId}/matches/${matchId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "League", id: `matches-${leagueId}` }],
    }),

    notifyLeagueMatch: builder.mutation<{ ok: boolean }, { leagueId: string; matchId: string }>({
      query: ({ leagueId, matchId }) => ({
        url: `/league/${leagueId}/matches/${matchId}/notify`,
        method: "POST",
      }),
    }),

    reorderLeagueParticipants: builder.mutation<{ ok: boolean }, { leagueId: string; order: string[] }>({
      query: ({ leagueId, order }) => ({
        url: `/league/${leagueId}/participants/reorder`,
        method: "PATCH",
        body: { order },
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "League", id: leagueId }],
    }),

    deleteAllLeagueMatches: builder.mutation<{ ok: boolean }, { leagueId: string }>({
      query: ({ leagueId }) => ({
        url: `/league/${leagueId}/matches`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: `matches-${leagueId}` },
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
      ],
    }),

    initTournamentMatches: builder.mutation<GetLeagueMatchesResponse, InitTournamentRequest>({
      query: ({ leagueId, bracket_size, seeding, advancement, force }) => ({
        url: `/league/${leagueId}/matches/init-tournament`,
        method: "POST",
        body: { bracket_size, seeding, advancement, force },
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: `matches-${leagueId}` },
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
      ],
    }),

    assignMatchParticipant: builder.mutation<
      { match: LeagueMatch },
      { leagueId: string; matchId: string; participant_a_id?: string | null; participant_b_id?: string | null }
    >({
      query: ({ leagueId, matchId, participant_a_id, participant_b_id }) => ({
        url: `/league/${leagueId}/matches/${matchId}`,
        method: "PATCH",
        body: { participant_a_id, participant_b_id },
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "League", id: `matches-${leagueId}` }],
    }),

    /**
     * 조 편성 결과 저장
     */
    saveLeagueGrouping: builder.mutation<SaveLeagueGroupingResponse, SaveLeagueGroupingRequest>({
      query: ({ leagueId, groupings }) => ({
        url: `/league/${leagueId}/grouping`,
        method: "POST",
        body: { groupings },
      }),
      
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
        { type: "League", id: `matches-${leagueId}` }, 
      ],
    }),
  }),
});

/**
 * Auto-generated hooks
 */
export const {
  useGetLeaguesQuery,
  useCreateLeagueMutation,
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useUpdateLeagueMutation,
  useUpdateParticipantMutation,
  useDeleteParticipantMutation,
  useAddParticipantsMutation,
  useDeleteLeagueMutation,
  useGetLeagueProgramQuery,
  useSaveLeagueProgramMutation,
  useDeleteLeagueProgramMutation,
  useGetLeagueMatchesQuery,
  useInitLeagueMatchesMutation,
  useUpdateLeagueMatchMutation,
  useScanLeagueOmrMutation,
  useScanOcrMutation,
  useReorderLeagueMatchesMutation,
  useDeleteLeagueMatchMutation,
  useNotifyLeagueMatchMutation,
  useReorderLeagueParticipantsMutation,
  useDeleteAllLeagueMatchesMutation,
  useInitTournamentMatchesMutation,
  useAssignMatchParticipantMutation,
  useExtendLeagueMatchesMutation,
  useSaveLeagueGroupingMutation,
} = leagueApi;
