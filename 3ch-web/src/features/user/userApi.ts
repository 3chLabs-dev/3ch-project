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
  }),
});

export const {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useSavePushSubscriptionMutation,
  useDeletePushSubscriptionMutation,
  useGetHomeSummaryQuery,
} = userApi;
