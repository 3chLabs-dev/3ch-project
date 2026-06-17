import type { AuthUser } from "../store/authSlice";
import { baseApi } from "./baseApi";

export type League = {
  id: string;
  name: string;
  sport?: string;
  start_date?: string;
  status?: string;
  participant_count?: number;
  group_name?: string;
  league_code?: string;
  title?: string;
  type?: string;
  format?: string;
  recruit_count?: number;
};

export type Group = {
  id: string;
  name: string;
  sport?: string;
  region_city?: string;
  region_district?: string;
  member_count?: number;
  role?: string;
  division?: string | null;
  club_code?: string;
  distance_km?: number | null;
};

export type HomeSummary = {
  my_groups: Array<{
    league_id: string;
    league_name: string;
    participant_name: string;
    division?: string | null;
    format?: string | null;
  }>;
  my_matches: Array<{
    match_id: string;
    league_name: string;
    opponent_name?: string | null;
    status: string;
    match_order?: number;
    my_division?: string | null;
    opponent_division?: string | null;
  }>;
  my_wins: Array<{ league_id: string; league_name: string; prize_name: string; draw_name?: string }>;
};

export type UserPreferences = {
  show_group: boolean;
  show_game: boolean;
  show_win: boolean;
};

export type GroupDetail = {
  group: Group & { description?: string; address?: string; founded_at?: string };
  members: Array<{ id: string; user_id: number; name?: string; email: string; role: string; division?: string | null }>;
  myRole: string;
};

export type Participant = {
  id: string;
  name: string;
  division?: string | null;
  paid: boolean;
  arrived: boolean;
  after: boolean;
};

export type LeagueMatch = {
  id: string;
  match_order: number;
  participant_a_name?: string | null;
  participant_b_name?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  status: "pending" | "playing" | "done";
  court?: string | null;
};

export type DrawListItem = { id: string; name: string; draw_code?: string; prize_count: number; winner_count: number; total_quantity: number };
export type DrawDetail = {
  draw: { id: string; name: string; created_at: string };
  prizes: Array<{ id: string; prize_name: string; quantity: number; winners: Array<{ id: string; participant_name: string; participant_division?: string | null }> }>;
};
export type Notice = { id: number; category?: string; title: string; content_preview?: string; content?: string; created_at: string };
export type Faq = { id: number; tab: string; section: string; question: string; answer: string };
export type Guide = { id: number; tab: "leader" | "member"; section: string; content: string };
export type Policy = { id: number; label: string; effective_date: string; body: string; is_current: boolean };
export type Inquiry = { id: number; category: string; title: string; status: string; created_at: string; replied_at?: string | null; content?: string; reply?: string | null };
export type Subscription = { plan: string; amount: number; started_at: string; expires_at: string };
export type SupportMessage = { id: number; sender_type: "user" | "admin"; content: string; created_at: string };
export type SportRankingSummary = {
  sport: string;
  club_count: number;
  my_ranking: null | { member_id: number; rank: number | null; rating: number; wins: number; losses: number; matches_played: number; win_rate: number; streak: number };
  top3: Array<{ member_id: number; name: string; rank: number | null; rating: number }>;
};

export const mobileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<
      { ok: boolean; token: string; user: AuthUser },
      { email: string; password: string }
    >({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    register: builder.mutation<{ ok: boolean; user: AuthUser }, { email: string; password: string; name: string }>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    getMe: builder.query<{ ok: boolean; user: AuthUser }, void>({ query: () => "/auth/me" }),
    updateMe: builder.mutation<{ ok: boolean }, { name?: string; password?: string }>({
      query: (body) => ({ url: "/auth/member", method: "PUT", body }),
    }),
    getLeagues: builder.query<{ leagues: League[] }, { groupId?: string } | void>({
      query: (args) => ({
        url: "/league",
        params: { page: 1, limit: 30, ...(args?.groupId ? { group_id: args.groupId } : {}) },
      }),
      transformResponse: (response: { leagues?: League[]; rows?: League[] } | League[]) => ({
        leagues: Array.isArray(response)
          ? response
          : response.leagues ?? response.rows ?? [],
      }),
      providesTags: ["League"],
    }),
    getMyGroups: builder.query<{ groups: Group[] }, void>({
      query: () => "/group",
      providesTags: ["Group"],
    }),
    getHomeSummary: builder.query<HomeSummary, { groupId?: string | null } | void>({
      query: (args) => ({
        url: "/user/me/home-summary",
        params: args?.groupId ? { group_id: args.groupId } : {},
      }),
      transformResponse: (response: { ok: boolean } & HomeSummary) => ({
        my_groups: response.my_groups ?? [],
        my_matches: response.my_matches ?? [],
        my_wins: response.my_wins ?? [],
      }),
      providesTags: ["Home"],
    }),
    getPreferences: builder.query<UserPreferences, void>({
      query: () => "/user/me/preferences",
      transformResponse: (response: { ok: boolean; preferences: UserPreferences }) => response.preferences,
      providesTags: ["UserPreferences"],
    }),
    updatePreferences: builder.mutation<UserPreferences, UserPreferences>({
      query: (body) => ({ url: "/user/me/preferences", method: "PUT", body }),
      transformResponse: (response: { ok: boolean; preferences: UserPreferences }) => response.preferences,
      invalidatesTags: ["UserPreferences"],
    }),
    searchGroups: builder.query<{ groups: Group[] }, { q?: string; regionCity?: string; limit?: number; sortByRegion?: boolean }>({
      query: ({ q, regionCity, limit = 30, sortByRegion }) => ({
        url: "/group/search",
        params: {
          ...(q ? { q } : {}),
          ...(regionCity ? { region_city: regionCity } : {}),
          ...(sortByRegion !== undefined ? { sort_by_region: sortByRegion } : {}),
          limit,
        },
      }),
    }),
    recommendGroups: builder.mutation<{ ok: boolean; clubs: Group[]; message?: string | null }, { lat: number; lng: number; sport?: string }>({
      query: (body) => ({ url: "/group/recommend", method: "POST", body }),
    }),
    getGroupDetail: builder.query<GroupDetail, string>({
      query: (id) => `/group/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Group", id }],
    }),
    joinGroup: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/group/${id}/join`, method: "POST" }),
      invalidatesTags: ["Group"],
    }),
    leaveGroup: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/group/${id}/leave`, method: "DELETE" }),
      invalidatesTags: ["Group"],
    }),
    createGroup: builder.mutation<{ message: string; group: Group }, { name: string; description?: string; sport?: string; region_city?: string }>({
      query: (body) => ({ url: "/group", method: "POST", body }),
      invalidatesTags: ["Group"],
    }),
    getGroupRanking: builder.query<{ rankings: Array<{ member_id: number; name: string; rank: number; rating: number; wins: number; losses: number; win_rate: number }> }, string>({
      query: (id) => `/group/${id}/ranking`,
    }),
    getLeague: builder.query<{ league: League }, string>({
      query: (id) => `/league/${id}`,
      providesTags: (_r, _e, id) => [{ type: "League", id }],
    }),
    getParticipants: builder.query<{ participants: Participant[] }, string>({
      query: (id) => `/league/${id}/participants`,
      providesTags: (_r, _e, id) => [{ type: "League", id: `participants-${id}` }],
    }),
    addParticipants: builder.mutation<unknown, { leagueId: string; participants: Array<{ name: string; division: string }> }>({
      query: ({ leagueId, participants }) => ({ url: `/league/${leagueId}/participants`, method: "POST", body: { participants } }),
      invalidatesTags: (_r, _e, { leagueId }) => [{ type: "League", id: `participants-${leagueId}` }],
    }),
    updateParticipant: builder.mutation<unknown, { leagueId: string; participantId: string; updates: Partial<Participant> }>({
      query: ({ leagueId, participantId, updates }) => ({ url: `/league/${leagueId}/participants/${participantId}`, method: "PUT", body: updates }),
      invalidatesTags: (_r, _e, { leagueId }) => [{ type: "League", id: `participants-${leagueId}` }],
    }),
    getMatches: builder.query<{ matches: LeagueMatch[] }, string>({
      query: (id) => `/league/${id}/matches`,
      providesTags: (_r, _e, id) => [{ type: "League", id: `matches-${id}` }],
    }),
    initMatches: builder.mutation<{ matches: LeagueMatch[] }, string>({
      query: (id) => ({ url: `/league/${id}/matches/init`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "League", id: `matches-${id}` }],
    }),
    updateMatch: builder.mutation<unknown, { leagueId: string; matchId: string; updates: Partial<LeagueMatch> }>({
      query: ({ leagueId, matchId, updates }) => ({ url: `/league/${leagueId}/matches/${matchId}`, method: "PATCH", body: updates }),
      invalidatesTags: (_r, _e, { leagueId }) => [{ type: "League", id: `matches-${leagueId}` }],
    }),
    createLeague: builder.mutation<{ league: League }, { name: string; title: string; type: string; sport: string; start_date: string; group_id?: string }>({
      query: (body) => ({ url: "/league", method: "POST", body }),
      invalidatesTags: ["League"],
    }),
    getDraws: builder.query<{ draws: DrawListItem[] }, string>({
      query: (leagueId) => `/draw/${leagueId}`,
    }),
    getDrawDetail: builder.query<DrawDetail, { leagueId: string; drawId: string }>({
      query: ({ leagueId, drawId }) => `/draw/${leagueId}/${drawId}`,
    }),
    getNotices: builder.query<{ notices: Notice[] }, void>({ query: () => "/notices?limit=50" }),
    getNotice: builder.query<Notice, number>({ query: (id) => `/notices/${id}` }),
    getFaqs: builder.query<{ faqs: Faq[] }, void>({ query: () => "/faqs" }),
    getGuides: builder.query<{ guides: Guide[] }, "leader" | "member">({
      query: (tab) => ({ url: "/guides", params: { tab } }),
    }),
    getPolicy: builder.query<Policy, "terms" | "privacy">({ query: (type) => `/policies/${type}/current` }),
    getInquiries: builder.query<{ inquiries: Inquiry[] }, void>({ query: () => "/inquiries/my" }),
    getInquiry: builder.query<Inquiry, number>({ query: (id) => `/inquiries/my/${id}` }),
    createInquiry: builder.mutation<Inquiry, { category: string; title: string; content: string; contact_email?: string }>({
      query: (body) => ({ url: "/inquiries", method: "POST", body }),
    }),
    getSubscription: builder.query<{ ok: boolean; subscription: Subscription | null }, void>({
      query: () => "/payment/subscriptions/me",
    }),
    getSupportChat: builder.query<{ room: { id: number; status: "open" | "closed" }; messages: SupportMessage[] }, void>({
      query: () => "/support-chat",
      providesTags: ["SupportChat"],
    }),
    sendSupportMessage: builder.mutation<SupportMessage, string>({
      query: (content) => ({ url: "/support-chat/messages", method: "POST", body: { content } }),
      invalidatesTags: ["SupportChat"],
    }),
    getMySportRankings: builder.query<{ ok: boolean; sports: SportRankingSummary[] }, void>({
      query: () => "/user/me/sport-rankings",
    }),
    getSportRanking: builder.query<{
      ok: boolean;
      sport: string;
      summary: { ranked_count: number; match_count: number; updated_at?: string | null };
      my_ranking: null | { member_id: number; rank: number | null; rating: number; wins: number; losses: number; streak: number };
      rankings: Array<{ member_id: number; name: string; rank: number | null; rating: number; wins: number; losses: number; win_rate: number; streak: number }>;
    }, string>({
      query: (sport) => `/user/me/sport-rankings/${encodeURIComponent(sport)}`,
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useUpdateMeMutation,
  useGetLeaguesQuery,
  useGetMyGroupsQuery,
  useGetHomeSummaryQuery,
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useSearchGroupsQuery,
  useRecommendGroupsMutation,
  useGetGroupDetailQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
  useCreateGroupMutation,
  useGetGroupRankingQuery,
  useGetLeagueQuery,
  useGetParticipantsQuery,
  useAddParticipantsMutation,
  useUpdateParticipantMutation,
  useGetMatchesQuery,
  useInitMatchesMutation,
  useUpdateMatchMutation,
  useCreateLeagueMutation,
  useGetDrawsQuery,
  useGetDrawDetailQuery,
  useGetNoticesQuery,
  useGetNoticeQuery,
  useGetFaqsQuery,
  useGetGuidesQuery,
  useGetPolicyQuery,
  useGetInquiriesQuery,
  useGetInquiryQuery,
  useCreateInquiryMutation,
  useGetSubscriptionQuery,
  useGetSupportChatQuery,
  useSendSupportMessageMutation,
  useGetMySportRankingsQuery,
  useGetSportRankingQuery,
} = mobileApi;
