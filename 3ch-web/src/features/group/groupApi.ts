import { baseApi } from "../api/baseApi";

export interface Group {
  id: string;
  name: string;
  club_code?: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  created_at: string;
  creator_name?: string;
  member_count: number;
  role: string;
  division?: string | null;
}

export interface GetGroupsResponse {
  groups: Group[];
}

export interface CreateGroupLinkRequest {
  label?: string;
  url: string;
  sort_order?: number;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  founded_at?: string;
  address?: string;
  address_detail?: string;
  lat?: number;
  lng?: number;
  links?: CreateGroupLinkRequest[];
}

export interface CheckNameResponse {
  available: boolean;
}

export interface CreateGroupResponse {
  message: string;
  group: { id: string; name: string; description?: string };
}

export interface GroupMember {
  id: string;
  role: string;
  division?: string | null;
  joined_at: string;
  user_id: number;
  name?: string;
  email: string;
}

export interface SearchGroupsParams {
  q?: string;
  region_city?: string;
  region_district?: string;
  limit?: number;
  sort_by_region?: boolean;
}

export interface SearchGroupsResponse {
  groups: Omit<Group, "role">[];
}

export interface GroupLink {
  id?: string;
  label?: string | null;
  url: string;
  sort_order?: number;
}

export interface GetGroupDetailResponse {
  group: {
    id: string;
    name: string;
    club_code?: string;
    description?: string;
    sport?: string;
    type?: string;
    region_city?: string;
    region_district?: string;
    founded_at?: string;
    address?: string;
    address_detail?: string;
    lat?: number;
    lng?: number;
    created_at: string;
    creator_name?: string;
  };
  members: GroupMember[];
  myRole: string;
  links?: GroupLink[];
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  founded_at?: string;
  address?: string;
  address_detail?: string;
  lat?: number;
  lng?: number;
  links?: GroupLink[];
}

export interface GeocodeResponse {
  ok: boolean;
  lat?: number;
  lng?: number;
  error?: string;
}

export interface RecommendedClub {
  id: string;
  name: string;
  club_code?: string;
  sport?: string;
  region_city?: string;
  region_district?: string;
  address?: string;
  member_count: number;
  distance_km: number | null;
}

export interface RecommendGroupsRequest {
  lat: number;
  lng: number;
  sport?: string;
}

export interface RecommendGroupsResponse {
  ok: boolean;
  clubs: RecommendedClub[];
  message: string | null;
}

export interface GroupMemberDetailResponse {
  member: {
    user_id: number;
    name: string;
    email: string;
    role: string;
    division?: string | null;
    joined_at: string;
  };
  stats: {
    year: number;
    attendance: number;
    league_attendance: number;
    tournament_attendance: number;
    wins: number;
    losses: number;
    championships: number;
  };
  ranking_summary: {
    rank: number | null;
    rating: number;
    wins: number;
    losses: number;
    matches_played: number;
    win_rate: number;
    streak: number;
    last_match_at?: string | null;
  } | null;
  clubs: { id: string; name: string; sport?: string | null; role: string }[];
}

export interface GroupRankingRow {
  member_id: number;
  name: string;
  division?: string | null;
  rank: number | null;
  rating: number;
  wins: number;
  losses: number;
  matches_played: number;
  win_rate: number;
  streak: number;
  last_match_at?: string | null;
}

export interface GroupRankingResponse {
  group: { id: string; name: string };
  summary: {
    member_count: number;
    ranked_count: number;
    match_count: number;
    updated_at?: string | null;
  };
  myRole: string;
  rankings: GroupRankingRow[];
}

export interface GroupRankingDetailResponse {
  member: {
    member_id: number;
    name: string;
    division?: string | null;
  };
  ranking: GroupRankingRow & {
    best_win_rating?: number | null;
  };
  recent_events: Array<{
    league_id?: string | null;
    league_match_id?: string | null;
    before_rating: number;
    after_rating: number;
    delta: number;
    result: "win" | "loss";
    match_type: "league" | "tournament";
    opponent_name?: string | null;
    created_at: string;
  }>;
}

export interface PointRankingRow {
  member_id: number;
  name: string;
  division?: string | null;
  rank: number | null;
  attendance_count: number;
  championships: number;
  matches_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  score_points: number;
  attendance_points: number;
  bonus_points: number;
  total_points: number;
}

export interface GroupPointRankingResponse {
  group: { id: string; name: string; sport?: string | null };
  year: number;
  scope: "club" | "national";
  available_years: number[];
  myRole: string;
  currentUserId: number;
  league: {
    rankings: PointRankingRow[];
  };
  tournament: {
    rankings: PointRankingRow[];
  };
}

export interface GroupMemberLeagueHistoryResponse {
  member: {
    user_id: number;
    name: string;
    email: string;
    role: string;
    division?: string | null;
    joined_at: string;
  };
  histories: Array<{
    league_id: string;
    league_name: string;
    format?: string | null;
    type?: string | null;
    sport?: string | null;
    start_date?: string | null;
    status?: string | null;
    division?: string | null;
    participant_name: string;
    wins: number;
    losses: number;
    matches_played: number;
    has_league_stage: boolean;
    has_tournament_stage: boolean;
  }>;
}

export const groupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyGroups: builder.query<GetGroupsResponse, void>({
      query: () => "/group",
      providesTags: ["Group"],
    }),

    createGroup: builder.mutation<CreateGroupResponse, CreateGroupRequest>({
      query: (body) => ({
        url: "/group",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Group"],
    }),

    getGroupDetail: builder.query<GetGroupDetailResponse, string>({
      query: (id) => `/group/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Group", id }],
    }),

    searchGroups: builder.query<SearchGroupsResponse, SearchGroupsParams>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params.q) sp.set("q", params.q);
        if (params.region_city) sp.set("region_city", params.region_city);
        if (params.region_district) sp.set("region_district", params.region_district);
        if (params.limit) sp.set("limit", String(params.limit));
        if (params.sort_by_region !== undefined) sp.set("sort_by_region", String(params.sort_by_region));
        return `/group/search?${sp.toString()}`;
      },
      providesTags: ["Group"],
    }),

    checkGroupName: builder.query<CheckNameResponse, string>({
      query: (name) => `/group/check-name?name=${encodeURIComponent(name)}`,
    }),

    joinGroup: builder.mutation<{ message: string }, string>({
      query: (groupId) => ({
        url: `/group/${groupId}/join`,
        method: "POST",
      }),
      invalidatesTags: ["Group"],
    }),

    updateMemberRole: builder.mutation<
      { message: string },
      { groupId: string; userId: string; role: "member" | "admin" }
    >({
      query: ({ groupId, userId, role }) => ({
        url: `/group/${groupId}/member/${userId}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
      ],
    }),

    updateMember: builder.mutation<
      { message: string },
      { groupId: string; userId: string; division?: string }
    >({
      query: ({ groupId, userId, division }) => ({
        url: `/group/${groupId}/member/${userId}`,
        method: "PATCH",
        body: { division },
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
      ],
    }),

    removeMember: builder.mutation<
      { message: string },
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/group/${groupId}/member/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
        "Group",
      ],
    }),

    updateGroup: builder.mutation<
      { message: string },
      { groupId: string; data: UpdateGroupRequest }
    >({
      query: ({ groupId, data }) => ({
        url: `/group/${groupId}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
        "Group",
      ],
    }),

    deleteGroup: builder.mutation<{ message: string }, string>({
      query: (groupId) => ({
        url: `/group/${groupId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Group"],
    }),

    leaveGroup: builder.mutation<{ message: string }, string>({
      query: (groupId) => ({
        url: `/group/${groupId}/leave`,
        method: "DELETE",
      }),
      invalidatesTags: ["Group"],
    }),

    geocodeAddress: builder.query<GeocodeResponse, string>({
      query: (address) => `/group/geocode?address=${encodeURIComponent(address)}`,
    }),

    recommendGroups: builder.mutation<RecommendGroupsResponse, RecommendGroupsRequest>({
      query: (body) => ({
        url: "/group/recommend",
        method: "POST",
        body,
      }),
    }),

    getGroupMemberDetail: builder.query<GroupMemberDetailResponse, { groupId: string; userId: number }>({
      query: ({ groupId, userId }) => `/group/${groupId}/member/${userId}`,
      providesTags: (_result, _error, { groupId, userId }) => [{ type: "Group", id: `member-${groupId}-${userId}` }],
    }),

    getGroupMemberLeagueHistory: builder.query<GroupMemberLeagueHistoryResponse, { groupId: string; userId: number }>({
      query: ({ groupId, userId }) => `/group/${groupId}/member/${userId}/leagues`,
      providesTags: (_result, _error, { groupId, userId }) => [{ type: "Group", id: `member-leagues-${groupId}-${userId}` }],
    }),

    getGroupRanking: builder.query<GroupRankingResponse, { groupId: string }>({
      query: ({ groupId }) => `/group/${groupId}/ranking`,
      providesTags: (_result, _error, { groupId }) => [{ type: "Group", id: `ranking-${groupId}` }],
    }),

    getGroupPointRanking: builder.query<GroupPointRankingResponse, { groupId: string; year?: number; scope: "club" | "national" }>({
      query: ({ groupId, year, scope }) => ({
        url: `/group/${groupId}/ranking/points`,
        params: {
          scope,
          ...(year ? { year } : {}),
        },
      }),
      providesTags: (_result, _error, { groupId, year, scope }) => [{ type: "Group", id: `point-ranking-${groupId}-${scope}-${year ?? "latest"}` }],
    }),

    getGroupRankingDetail: builder.query<GroupRankingDetailResponse, { groupId: string; memberId: number }>({
      query: ({ groupId, memberId }) => `/group/${groupId}/ranking/${memberId}`,
      providesTags: (_result, _error, { groupId, memberId }) => [{ type: "Group", id: `ranking-${groupId}-${memberId}` }],
    }),

    rebuildGroupRanking: builder.mutation<{ message: string }, { groupId: string }>({
      query: ({ groupId }) => ({
        url: `/group/${groupId}/ranking/rebuild`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: `ranking-${groupId}` },
        "Group",
      ],
    }),
  }),
});

export const {
  useGetMyGroupsQuery,
  useCreateGroupMutation,
  useGetGroupDetailQuery,
  useSearchGroupsQuery,
  useLazyCheckGroupNameQuery,
  useJoinGroupMutation,
  useUpdateMemberRoleMutation,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useLazyGeocodeAddressQuery,
  useRecommendGroupsMutation,
  useGetGroupMemberDetailQuery,
  useGetGroupMemberLeagueHistoryQuery,
  useGetGroupRankingQuery,
  useGetGroupPointRankingQuery,
  useGetGroupRankingDetailQuery,
  useRebuildGroupRankingMutation,
} = groupApi;
