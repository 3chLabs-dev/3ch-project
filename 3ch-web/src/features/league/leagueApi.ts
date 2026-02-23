import { baseApi } from "../api/baseApi";

/**
 * API 요청 타입 정의
 */
export interface CreateLeagueRequest {
  name: string;
  description?: string;
  type: string;
  sport: string;
  start_date: string;
  rules?: string;
}

export interface UpdateLeagueRequest {
  name?: string;
  description?: string;
  type?: string;
  sport?: string;
  start_date?: string;
  rules?: string;
  status?: "draft" | "active" | "completed";
}

/**
 * API 응답 타입 정의
 */
export interface League {
  id: string;
  name: string;
  description?: string;
  type: string;
  sport: string;
  start_date: string;
  rules?: string;
  status: "draft" | "active" | "completed";
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
  paid: boolean;
  arrived: boolean;
  foot_pool: boolean;
  created_at: string;
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
  footPool?: boolean;
}

export interface UpdateParticipantResponse {
  message: string;
  participant: LeagueParticipantItem;
}

export interface DeleteParticipantResponse {
  message: string;
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
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set("page", String(params.page));
        if (params?.limit) searchParams.set("limit", String(params.limit));
        if (params?.sport) searchParams.set("sport", params.sport);
        if (params?.status) searchParams.set("status", params.status);
        if (params?.group_id) searchParams.set("group_id", params.group_id);
        if (params?.my_groups) searchParams.set("my_groups", "true");
        if (params?.user_id) searchParams.set("user_id", String(params.user_id));
        const qs = searchParams.toString();
        return `/league${qs ? `?${qs}` : ""}`;
      },
      transformResponse: (response: unknown) => normalizeLeaguesResponse(response),
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
      query: (id) => `/league/${id}`,
      providesTags: (_result, _error, id) => [{ type: "League", id }],
    }),

    getLeagueParticipants: builder.query<GetLeagueParticipantsResponse, string>({
      query: (id) => `/league/${id}/participants`,
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
      query: ({ leagueId, participantId, updates }) => ({
        url: `/league/${leagueId}/participants/${participantId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [
        { type: "League", id: leagueId },
        { type: "League", id: "LIST" },
      ],
    }),

    deleteParticipant: builder.mutation<
    DeleteParticipantResponse,
    { leagueId: string; participantId: string }
  >({
    query: ({ leagueId, participantId }) => ({
      url: `/league/${leagueId}/participants/${participantId}`,
      method: "DELETE",
    }),
    invalidatesTags: (_result, _error, { leagueId }) => [
      { type: "League", id: leagueId },
      { type: "League", id: "LIST" },
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
} = leagueApi;
