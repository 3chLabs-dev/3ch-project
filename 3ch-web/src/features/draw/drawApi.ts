import { baseApi } from "../api/baseApi";

// ─── 추첨 타입 정의 ───────────────────────────────────────

export interface DrawListItem {
  id: string;
  name: string;
  created_at: string;
  prize_count: number;
  total_quantity: number;
  winner_count: number;
  creator_name?: string;
}

export interface GetDrawsResponse {
  draws: DrawListItem[];
}

export interface DrawWinnerItem {
  id: string;
  participant_name: string;
  participant_division: string | null;
  display_order: number;
}

export interface DrawPrizeItem {
  id: string;
  prize_name: string;
  quantity: number;
  display_order: number;
  winners: DrawWinnerItem[];
}

export interface DrawDetail {
  id: string;
  name: string;
  created_at: string;
}

export interface GetDrawDetailResponse {
  draw: DrawDetail;
  prizes: DrawPrizeItem[];
}

export interface CreateDrawRequest {
  leagueId: string;
  name: string;
  prizes: {
    prize_name: string;
    quantity: number;
    winners: { participant_name: string; participant_division?: string }[];
  }[];
}

export interface CreateDrawResponse {
  message: string;
  draw_id: string;
}

export interface UpdateDrawRequest {
  leagueId: string;
  drawId: string;
  name: string;
  newLeagueId?: string;
}

export interface UpdateDrawResponse {
  message: string;
  draw: { id: string; name: string; created_at: string };
}

export interface DeleteDrawResponse {
  message: string;
}

export interface RunDrawRequest {
  leagueId: string;
  drawId: string;
  prizes: {
    prize_name: string;
    quantity: number;
    winners: { participant_name: string; participant_division?: string }[];
  }[];
}

export interface RunDrawResponse {
  message: string;
}

export interface DrawPrizeWinnersRequest {
  leagueId: string;
  drawId: string;
  prizeId: string;
  winners: { participant_name: string; participant_division?: string | null }[];
}

export interface DrawPrizeWinnersResponse {
  message: string;
}

// ─── RTK Query 엔드포인트 ────────────────────────────────

export const drawApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDraws: builder.query<GetDrawsResponse, string>({
      query: (leagueId) => `/draw/${leagueId}`,
      providesTags: (_result, _error, leagueId) => [{ type: "Draw" as const, id: leagueId }],
    }),

    createDraw: builder.mutation<CreateDrawResponse, CreateDrawRequest>({
      query: ({ leagueId, ...body }) => ({
        url: `/draw/${leagueId}`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { leagueId }) => [{ type: "Draw" as const, id: leagueId }],
    }),

    getDrawDetail: builder.query<GetDrawDetailResponse, { leagueId: string; drawId: string }>({
      query: ({ leagueId, drawId }) => `/draw/${leagueId}/${drawId}`,
      providesTags: (_result, _error, { drawId }) => [{ type: "Draw" as const, id: drawId }],
    }),

    updateDraw: builder.mutation<UpdateDrawResponse, UpdateDrawRequest>({
      query: ({ leagueId, drawId, name, newLeagueId }) => ({
        url: `/draw/${leagueId}/${drawId}`,
        method: "PATCH",
        body: { name, new_league_id: newLeagueId },
      }),
      invalidatesTags: (_result, _error, { leagueId, drawId, newLeagueId }) => [
        { type: "Draw" as const, id: leagueId },
        { type: "Draw" as const, id: drawId },
        ...(newLeagueId ? [{ type: "Draw" as const, id: newLeagueId }] : []),
      ],
    }),

    deleteDraw: builder.mutation<DeleteDrawResponse, { leagueId: string; drawId: string }>({
      query: ({ leagueId, drawId }) => ({
        url: `/draw/${leagueId}/${drawId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { leagueId, drawId }) => [
        { type: "Draw" as const, id: leagueId },
        { type: "Draw" as const, id: drawId },
      ],
    }),

    runDraw: builder.mutation<RunDrawResponse, RunDrawRequest>({
      query: ({ leagueId, drawId, prizes }) => ({
        url: `/draw/${leagueId}/${drawId}/run`,
        method: "POST",
        body: { prizes },
      }),
      invalidatesTags: (_result, _error, { leagueId, drawId }) => [
        { type: "Draw" as const, id: leagueId },
        { type: "Draw" as const, id: drawId },
      ],
    }),

    drawPrizeWinners: builder.mutation<DrawPrizeWinnersResponse, DrawPrizeWinnersRequest>({
      query: ({ leagueId, drawId, prizeId, winners }) => ({
        url: `/draw/${leagueId}/${drawId}/prizes/${prizeId}/winners`,
        method: "POST",
        body: { winners },
      }),
      invalidatesTags: (_result, _error, { leagueId, drawId }) => [
        { type: "Draw" as const, id: leagueId },
        { type: "Draw" as const, id: drawId },
      ],
    }),
  }),
});

export const {
  useGetDrawsQuery,
  useCreateDrawMutation,
  useGetDrawDetailQuery,
  useUpdateDrawMutation,
  useDeleteDrawMutation,
  useRunDrawMutation,
  useDrawPrizeWinnersMutation,
} = drawApi;
