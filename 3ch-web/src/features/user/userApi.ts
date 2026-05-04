import { baseApi } from "../api/baseApi";

export interface UserPreferences {
  show_group: boolean;
  show_game: boolean;
  show_win: boolean;
}

export interface MyGroupItem {
  league_id: string;
  league_name: string;
  league_code: string | null;
  format: string | null;
  division: string | null;
  participant_name: string;
}

export interface MyMatchItem {
  league_id: string;
  league_name: string;
  league_code: string | null;
  match_id: string;
  match_order: number;
  status: string;
  my_score: number | null;
  opponent_score: number | null;
  opponent_name: string | null;
  opponent_division: string | null;
  my_division: string | null;
}

export interface MyWinItem {
  league_id: string;
  league_name: string;
  league_code: string | null;
  draw_name: string;
  draw_code: string | null;
  prize_name: string;
  participant_name: string;
  participant_division: string | null;
}

export interface HomeSummary {
  my_groups: MyGroupItem[];
  my_matches: MyMatchItem[];
  my_wins: MyWinItem[];
}

export interface SportRankingRow {
  member_id: number;
  name: string;
  rank: number | null;
  rating: number;
  wins: number;
  losses: number;
  matches_played: number;
  win_rate: number;
  streak: number;
  last_match_at: string | null;
}

export interface SportRankingPreviewRow {
  member_id: number;
  name: string;
  rank: number | null;
  rating: number;
}

export interface SportRankingSummaryItem {
  sport: string;
  club_count: number;
  my_ranking: Omit<SportRankingRow, "name"> | null;
  top3: SportRankingPreviewRow[];
}

export interface SportRankingEvent {
  group_id: string | null;
  group_name: string | null;
  league_id: string | null;
  league_match_id: string | null;
  before_rating: number;
  after_rating: number;
  delta: number;
  result: string;
  match_type: string;
  opponent_name: string | null;
  created_at: string;
}

export interface SportRankingDetail {
  sport: string;
  summary: {
    ranked_count: number;
    match_count: number;
    updated_at: string | null;
  };
  my_ranking: SportRankingRow | null;
  rankings: SportRankingRow[];
  my_recent_events: SportRankingEvent[];
}

const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPreferences: builder.query<UserPreferences, void>({
      query: () => "/user/me/preferences",
      transformResponse: (res: { ok: boolean; preferences: UserPreferences }) =>
        res.preferences,
      providesTags: ["UserPreferences"],
    }),
    updatePreferences: builder.mutation<UserPreferences, UserPreferences>({
      query: (prefs) => ({
        url: "/user/me/preferences",
        method: "PUT",
        body: prefs,
      }),
      transformResponse: (res: { ok: boolean; preferences: UserPreferences }) =>
        res.preferences,
      invalidatesTags: ["UserPreferences"],
    }),
    savePushSubscription: builder.mutation<void, PushSubscriptionJSON>({
      query: (sub) => ({
        url: "/user/me/push-subscription",
        method: "POST",
        body: sub,
      }),
    }),
    deletePushSubscription: builder.mutation<void, { endpoint: string }>({
      query: (body) => ({
        url: "/user/me/push-subscription",
        method: "DELETE",
        body,
      }),
    }),
    getHomeSummary: builder.query<HomeSummary, { groupId?: string | null }>({
      query: ({ groupId }) => ({
        url: "/user/me/home-summary",
        params: groupId ? { group_id: groupId } : {},
      }),
      transformResponse: (res: { ok: boolean } & HomeSummary) => ({
        my_groups: res.my_groups,
        my_matches: res.my_matches,
        my_wins: res.my_wins,
      }),
    }),
    getMySportRankings: builder.query<{ sports: SportRankingSummaryItem[] }, void>({
      query: () => "/user/me/sport-rankings",
      transformResponse: (res: { ok: boolean; sports: SportRankingSummaryItem[] }) => ({
        sports: res.sports,
      }),
      providesTags: ["UserRanking"],
    }),
    getSportRanking: builder.query<SportRankingDetail, { sport: string }>({
      query: ({ sport }) => `/user/me/sport-rankings/${encodeURIComponent(sport)}`,
      transformResponse: (res: { ok: boolean } & SportRankingDetail) => ({
        sport: res.sport,
        summary: res.summary,
        my_ranking: res.my_ranking,
        rankings: res.rankings,
        my_recent_events: res.my_recent_events,
      }),
      providesTags: (_result, _error, { sport }) => [{ type: "UserRanking", id: `sport-${sport}` }],
    }),
  }),
});

export const {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useSavePushSubscriptionMutation,
  useDeletePushSubscriptionMutation,
  useGetHomeSummaryQuery,
  useGetMySportRankingsQuery,
  useGetSportRankingQuery,
} = userApi;
