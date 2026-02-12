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

export interface UpdateLeagueResponse {
  message: string;
  league: League;
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
    }),

    /**
     * 리그 조회
     */
    getLeague: builder.query<GetLeagueResponse, string>({
      query: (id) => `/league/${id}`,
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
  useUpdateLeagueMutation,
} = leagueApi;
