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
  useCreateLeagueMutation,
  useGetLeagueQuery,
  useUpdateLeagueMutation,
} = leagueApi;
