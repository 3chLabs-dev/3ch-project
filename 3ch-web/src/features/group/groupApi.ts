import { baseApi } from "../api/baseApi";
import type { RootState } from "../../app/store";
import {
  LOCAL_DEV_GROUPS,
  createLocalDevPreMember,
  deleteLocalDevPreMember,
  findLocalDevGroup,
  getLocalDevGroupMembers,
  getLocalDevPreMembers,
  getLocalDevProfileByToken,
  isLocalDevToken,
  requestLocalDevPreMemberClaim,
  reviewLocalDevPreMemberClaim,
} from "../../utils/localDevAuth";

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
  display_order?: number | null;
  is_primary?: boolean;
  is_pre_registered?: boolean;
  management_permissions?: ManagementPermissions;
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
  user_id: number | null;
  name?: string;
  email?: string | null;
  is_pre_member?: boolean;
  external_aliases?: Array<{ id: string; alias: string; source: string }>;
  claim_id?: string | null;
  claim_status?: "pending" | "approved" | "declined" | null;
  requested_by_id?: number | null;
  requester_name?: string | null;
  management_permissions?: ManagementPermissions;
}

export interface ManagementPermissions {
  members: boolean;
  ranking: boolean;
  league: boolean;
  draw: boolean;
}

export interface GroupPreMember {
  id: string;
  name: string;
  division?: string | null;
  status: "active" | "linked" | "deleted";
  created_at: string;
  claim_id?: string | null;
  claim_status?: "pending" | "approved" | "declined" | null;
  requested_by_id?: number | null;
  requester_name?: string | null;
  requested_at?: string | null;
}

export interface GroupPreMembersResponse {
  pre_members: GroupPreMember[];
  myRole?: string | null;
}

export interface SearchGroupsParams {
  q?: string;
  sport?: string;
  region_city?: string;
  region_district?: string;
  limit?: number;
  sort_by_region?: boolean;
  include_joined?: boolean;
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
  myPermissions?: ManagementPermissions;
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
  is_pre_registered?: boolean;
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
  seasons: Array<Pick<GroupRankingSeason, "id" | "name" | "start_date" | "end_date" | "is_default" | "is_display_default">>;
  selected_season_id: string | null;
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

export interface LeagueVenuePlace {
  id: string;
  name: string;
  address: string;
  region_city: string | null;
  region_district: string | null;
  lat: number;
  lng: number;
}

export interface GroupRankingSeason {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  auto_renew?: boolean;
  is_default?: boolean;
  is_display_default?: boolean;
  point_rules?: GroupRankingPointRules;
  created_at?: string;
}

export interface GroupRankingPointRules {
  attendance: {
    league: number;
    tournament: number;
  };
  matchPoints: {
    mode: "sets" | "win";
    winPoints: number;
    eventTypes: {
      singles: boolean;
      doubles: boolean;
      team: boolean;
    };
    formats: {
      league: boolean;
      group: boolean;
      tournament: boolean;
    };
  };
  rankings: {
    league: { enabled: boolean; first: number; second: number; third: number; fourth: number; thirdFourth?: number };
    group: { enabled: boolean; first: number; second: number; third: number; fourth: number; thirdFourth?: number };
    tournamentUpper: { enabled: boolean; first: number; second: number; third: number; fourth: number; thirdFourth?: number };
    tournamentLower: { enabled: boolean; first: number; second: number; third: number; fourth: number; thirdFourth?: number };
  };
}

export interface GroupPointRankingResponse {
  group: { id: string; name: string; sport?: string | null };
  year: number;
  scope: "club" | "national";
  available_years: number[];
  season_id?: string | null;
  season?: GroupRankingSeason | null;
  seasons: GroupRankingSeason[];
  no_active_season?: boolean;
  point_rules: GroupRankingPointRules;
  myRole: string;
  myPermissions?: ManagementPermissions;
  currentUserId: number;
  league: {
    rankings: PointRankingRow[];
  };
  tournament: {
    rankings: PointRankingRow[];
  };
}

const LOCAL_DEFAULT_POINT_RULES: GroupRankingPointRules = {
  attendance: { league: 10, tournament: 20 },
  matchPoints: {
    mode: "sets",
    winPoints: 3,
    eventTypes: { singles: true, doubles: true, team: true },
    formats: { league: true, group: true, tournament: true },
  },
  rankings: {
    league: { enabled: true, first: 30, second: 20, third: 15, fourth: 10 },
    group: { enabled: true, first: 30, second: 20, third: 15, fourth: 10 },
    tournamentUpper: { enabled: true, first: 50, second: 30, third: 20, fourth: 15 },
    tournamentLower: { enabled: true, first: 20, second: 15, third: 10, fourth: 5 },
  },
};

const localRankingSeasonKey = (groupId: string) => `woorileague.localDev.rankingSeasons.${groupId}`;

function readLocalRankingSeasons(groupId: string): GroupRankingSeason[] {
  try {
    const stored = window.localStorage.getItem(localRankingSeasonKey(groupId));
    if (stored) return JSON.parse(stored) as GroupRankingSeason[];
  } catch {
    // Fall through to the default season.
  }
  const year = new Date().getFullYear();
  return [{
    id: `local-season-${year}`,
    name: `${year} 시즌`,
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    auto_renew: false,
    is_default: true,
    is_display_default: true,
    point_rules: LOCAL_DEFAULT_POINT_RULES,
    created_at: `${year}-01-01T00:00:00.000Z`,
  }];
}

function writeLocalRankingSeasons(groupId: string, seasons: GroupRankingSeason[]) {
  window.localStorage.setItem(localRankingSeasonKey(groupId), JSON.stringify(seasons));
}

function buildLocalPointRows(groupId: string): PointRankingRow[] {
  return getLocalDevGroupMembers(groupId).map((member, index) => {
    const wins = Math.max(0, 7 - index);
    const losses = index;
    const matchesPlayed = wins + losses;
    const scorePoints = wins * 3;
    const attendancePoints = Math.max(1, 8 - index);
    const bonusPoints = index === 0 ? 30 : index === 1 ? 20 : index < 4 ? 10 : 0;
    return {
      member_id: member.user_id ?? 990000 + index,
      name: member.name,
      division: member.division,
      rank: index + 1,
      attendance_count: attendancePoints,
      championships: index === 0 ? 1 : 0,
      matches_played: matchesPlayed,
      wins,
      losses,
      win_rate: matchesPlayed ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0,
      score_points: scorePoints,
      attendance_points: attendancePoints,
      bonus_points: bonusPoints,
      total_points: scorePoints + attendancePoints + bonusPoints,
    };
  }).sort((a, b) => b.total_points - a.total_points)
    .map((row, index) => ({ ...row, rank: index + 1 }));
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

export interface GroupMemberHeadToHeadResponse {
  requester: { user_id: number; name: string };
  opponent: { user_id: number; name: string };
  summary: { wins: number; losses: number; matches_played: number };
  matches: Array<{
    source_type: "league";
    match_id: string;
    league_id: string;
    league_name: string;
    match_date?: string | null;
    stage: string;
    event_type: "단식";
    format: "단일리그" | "조별리그" | "토너먼트";
    match_rule: string;
    round_label?: string | null;
    requester_score: number;
    opponent_score: number;
    winner: "requester" | "opponent";
  }>;
}

export const groupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyGroups: builder.query<GetGroupsResponse, void>({
      async queryFn(_arg, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        if (profile) return { data: { groups: [profile.group] } };
        const result = await fetchWithBQ("/group");
        return result.error ? { error: result.error } : { data: result.data as GetGroupsResponse };
      },
      providesTags: ["Group"],
    }),

    updateMyGroupPreferences: builder.mutation<
      { message: string },
      { orderedGroupIds: string[]; primaryGroupId: string }
    >({
      query: ({ orderedGroupIds, primaryGroupId }) => ({
        url: "/group/preferences",
        method: "PUT",
        body: {
          ordered_group_ids: orderedGroupIds,
          primary_group_id: primaryGroupId,
        },
      }),
      invalidatesTags: ["Group"],
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
      async queryFn(id, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const localGroup = findLocalDevGroup(id);
        if (profile && localGroup) {
          const isOwner = profile.group.id === localGroup.id;
          return {
            data: {
              group: {
                id: localGroup.id,
                name: localGroup.name,
                club_code: localGroup.club_code,
                sport: localGroup.sport,
                region_city: localGroup.region_city,
                region_district: localGroup.region_district,
                created_at: localGroup.created_at,
                creator_name: localGroup.creator_name,
              },
              members: [
                ...getLocalDevGroupMembers(localGroup.id),
                ...getLocalDevPreMembers(localGroup.id)
                  .filter((member) => member.status === "active")
                  .map((member) => ({
                    id: member.id,
                    role: "member",
                    division: member.division,
                    joined_at: member.created_at,
                    user_id: null,
                    name: member.name,
                    email: null,
                    is_pre_member: true,
                    claim_id: member.claim_id,
                    claim_status: member.claim_status,
                    requested_by_id: member.requested_by_id,
                    requester_name: member.requester_name,
                  })),
              ],
              myRole: isOwner ? "owner" : "",
              links: [],
            },
          };
        }
        const result = await fetchWithBQ(`/group/${id}`);
        return result.error ? { error: result.error } : { data: result.data as GetGroupDetailResponse };
      },
      providesTags: (_result, _error, id) => [{ type: "Group", id }],
    }),

    searchGroups: builder.query<SearchGroupsResponse, SearchGroupsParams>({
      async queryFn(params, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        if (isLocalDevToken(token)) {
          const query = params.q?.trim().toLocaleLowerCase() ?? "";
          const groups = LOCAL_DEV_GROUPS
            .filter((group) => !query || group.name.toLocaleLowerCase().includes(query))
            .filter((group) => !params.sport || group.sport === params.sport)
            .filter((group) => !params.region_city || group.region_city === params.region_city)
            .filter((group) => !params.region_district || group.region_district === params.region_district)
            .slice(0, params.limit ?? LOCAL_DEV_GROUPS.length)
            .map(({ role: _role, division: _division, ...group }) => group);
          return { data: { groups } };
        }
        const sp = new URLSearchParams();
        if (params.q) sp.set("q", params.q);
        if (params.sport) sp.set("sport", params.sport);
        if (params.region_city) sp.set("region_city", params.region_city);
        if (params.region_district) sp.set("region_district", params.region_district);
        if (params.limit) sp.set("limit", String(params.limit));
        if (params.sort_by_region !== undefined) sp.set("sort_by_region", String(params.sort_by_region));
        if (params.include_joined !== undefined) sp.set("include_joined", String(params.include_joined));
        const result = await fetchWithBQ(`/group/search?${sp.toString()}`);
        return result.error ? { error: result.error } : { data: result.data as SearchGroupsResponse };
      },
      providesTags: ["Group"],
    }),

    checkGroupName: builder.query<CheckNameResponse, string>({
      query: (name) => `/group/check-name?name=${encodeURIComponent(name)}`,
    }),

    joinGroup: builder.mutation<{ message: string; claim_requested?: boolean }, string>({
      query: (groupId) => ({
        url: `/group/${groupId}/join`,
        method: "POST",
      }),
      invalidatesTags: ["Group"],
    }),

    getGroupPreMembers: builder.query<GroupPreMembersResponse, string>({
      async queryFn(groupId, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          return {
            data: {
              pre_members: getLocalDevPreMembers(group.id),
              myRole: profile.group.id === group.id ? "owner" : null,
            },
          };
        }
        const result = await fetchWithBQ(`/group/${groupId}/pre-members`);
        return result.error ? { error: result.error } : { data: result.data as GroupPreMembersResponse };
      },
      providesTags: (_result, _error, groupId) => [{ type: "Group", id: `pre-members-${groupId}` }],
    }),

    createGroupPreMember: builder.mutation<
      { message: string; pre_member: GroupPreMember },
      { groupId: string; name: string; division?: string }
    >({
      async queryFn({ groupId, name, division }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          if (profile.group.id !== group.id) {
            return { error: { status: 403, data: { message: "클럽 리더만 사전등록할 수 있습니다." } } };
          }
          const pre_member = createLocalDevPreMember(group.id, name, division);
          return { data: { message: "클럽 회원을 사전등록했습니다.", pre_member } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/pre-members`,
          method: "POST",
          body: { name, division },
        });
        return result.error
          ? { error: result.error }
          : { data: result.data as { message: string; pre_member: GroupPreMember } };
      },
      invalidatesTags: (_r, _e, { groupId }) => [
        { type: "Group", id: `pre-members-${groupId}` },
        { type: "Group", id: groupId },
        "Group",
      ],
    }),

    deleteGroupPreMember: builder.mutation<{ message: string }, { groupId: string; preMemberId: string }>({
      async queryFn({ groupId, preMemberId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          if (profile.group.id !== group.id) {
            return { error: { status: 403, data: { message: "클럽 리더만 삭제할 수 있습니다." } } };
          }
          deleteLocalDevPreMember(group.id, preMemberId);
          return { data: { message: "사전등록 회원을 삭제했습니다." } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/pre-members/${preMemberId}`,
          method: "DELETE",
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string } };
      },
      invalidatesTags: (_r, _e, { groupId }) => [
        { type: "Group", id: `pre-members-${groupId}` },
        { type: "Group", id: groupId },
        "Group",
      ],
    }),

    requestGroupMemberClaim: builder.mutation<{ message: string }, { groupId: string; preMemberId: string }>({
      async queryFn({ groupId, preMemberId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const member = requestLocalDevPreMemberClaim(group.id, preMemberId, profile.user);
          if (!member) {
            return { error: { status: 409, data: { message: "전환할 수 없는 사전등록 회원입니다." } } };
          }
          return { data: { message: "회원 전환을 신청했습니다." } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/pre-members/${preMemberId}/claim-request`,
          method: "POST",
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string } };
      },
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: `pre-members-${groupId}` }],
    }),

    reviewGroupMemberClaim: builder.mutation<
      { message: string },
      { groupId: string; preMemberId: string; action: "approve" | "decline" }
    >({
      async queryFn({ groupId, preMemberId, action }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          if (profile.group.id !== group.id) {
            return { error: { status: 403, data: { message: "클럽 리더만 처리할 수 있습니다." } } };
          }
          const member = reviewLocalDevPreMemberClaim(group.id, preMemberId, action);
          if (!member) {
            return { error: { status: 409, data: { message: "처리할 전환 신청이 없습니다." } } };
          }
          return { data: { message: action === "approve" ? "회원 전환을 승인했습니다." : "회원 전환을 거절했습니다." } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/pre-members/${preMemberId}/claim-request`,
          method: "PATCH",
          body: { action },
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string } };
      },
      invalidatesTags: (_r, _e, { groupId }) => [
        { type: "Group", id: `pre-members-${groupId}` }, { type: "Group", id: groupId }, "Group",
      ],
    }),

    updateMemberRole: builder.mutation<
      { message: string },
      { groupId: string; userId: string; role: "member" | "admin"; managementPermissions: ManagementPermissions }
    >({
      query: ({ groupId, userId, role, managementPermissions }) => ({
        url: `/group/${groupId}/member/${userId}/role`,
        method: "PATCH",
        body: { role, management_permissions: managementPermissions },
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
      ],
    }),

    updateMember: builder.mutation<
      { message: string },
      { groupId: string; userId: string; division?: string; externalAliases?: string[] }
    >({
      query: ({ groupId, userId, division, externalAliases }) => ({
        url: `/group/${groupId}/member/${userId}`,
        method: "PATCH",
        body: { division, external_aliases: externalAliases },
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

    getGroupMemberDetail: builder.query<GroupMemberDetailResponse, { groupId: string; userId: number; seasonId?: string }>({
      query: ({ groupId, userId, seasonId }) => ({
        url: `/group/${groupId}/member/${userId}`,
        params: seasonId ? { season_id: seasonId } : undefined,
      }),
      providesTags: (_result, _error, { groupId, userId }) => [{ type: "Group", id: `member-${groupId}-${userId}` }],
    }),

    getGroupMemberLeagueHistory: builder.query<GroupMemberLeagueHistoryResponse, { groupId: string; userId: number }>({
      query: ({ groupId, userId }) => `/group/${groupId}/member/${userId}/leagues`,
      providesTags: (_result, _error, { groupId, userId }) => [{ type: "Group", id: `member-leagues-${groupId}-${userId}` }],
    }),

    getGroupRanking: builder.query<GroupRankingResponse, { groupId: string }>({
      async queryFn({ groupId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const rankings = getLocalDevGroupMembers(group.id).map((member, index) => {
            const wins = Math.max(0, 7 - index);
            const losses = index;
            const matchesPlayed = wins + losses;
            return {
              member_id: member.user_id ?? 990000 + index,
              name: member.name,
              division: member.division,
              rank: index + 1,
              rating: 1500 - index * 35,
              wins,
              losses,
              matches_played: matchesPlayed,
              win_rate: matchesPlayed ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0,
              streak: index < 3 ? 3 - index : 0,
              last_match_at: new Date().toISOString(),
            };
          });
          return {
            data: {
              group: { id: group.id, name: group.name },
              summary: {
                member_count: rankings.length,
                ranked_count: rankings.length,
                match_count: rankings.reduce((sum, row) => sum + row.matches_played, 0) / 2,
                updated_at: new Date().toISOString(),
              },
              myRole: profile.group.id === group.id ? "owner" : "",
              rankings,
            },
          };
        }
        const result = await fetchWithBQ(`/group/${groupId}/ranking`);
        return result.error ? { error: result.error } : { data: result.data as GroupRankingResponse };
      },
      providesTags: (_result, _error, { groupId }) => [{ type: "Group", id: `ranking-${groupId}` }],
    }),

    getGroupMemberHeadToHead: builder.query<GroupMemberHeadToHeadResponse, { groupId: string; userId: number }>({
      query: ({ groupId, userId }) => `/group/${groupId}/member/${userId}/head-to-head`,
      providesTags: (_result, _error, { groupId, userId }) => [{ type: "Group", id: `member-head-to-head-${groupId}-${userId}` }],
    }),

    searchLeagueVenues: builder.query<{ ok: boolean; places: LeagueVenuePlace[] }, string>({
      query: (query) => `/group/place-search?q=${encodeURIComponent(query)}`,
    }),

    getGroupPointRanking: builder.query<GroupPointRankingResponse, { groupId: string; year?: number; seasonId?: string; scope: "club" | "national" }>({
      async queryFn({ groupId, year, seasonId, scope }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const seasons = readLocalRankingSeasons(group.id);
          const selectedSeason = seasons.find((season) => season.id === seasonId) ?? seasons[0] ?? null;
          const seasonYear = Number(selectedSeason?.start_date.slice(0, 4));
          const activeYear = year ?? (seasonYear || new Date().getFullYear());
          const rows = buildLocalPointRows(group.id);
          return {
            data: {
              group: { id: group.id, name: group.name, sport: group.sport },
              year: activeYear,
              scope,
              available_years: [...new Set(seasons.map((season) => Number(season.start_date.slice(0, 4))))],
              season_id: selectedSeason?.id ?? null,
              season: selectedSeason,
              seasons,
              no_active_season: !selectedSeason,
              point_rules: selectedSeason?.point_rules ?? LOCAL_DEFAULT_POINT_RULES,
              myRole: profile.group.id === group.id ? "owner" : "",
              currentUserId: profile.user.id,
              league: { rankings: rows },
              tournament: { rankings: rows.map((row) => ({ ...row, total_points: Math.max(0, row.total_points - 5) })) },
            },
          };
        }
        const params = new URLSearchParams({ scope });
        if (year) params.set("year", String(year));
        if (seasonId) params.set("season_id", seasonId);
        const result = await fetchWithBQ(`/group/${groupId}/ranking/points?${params.toString()}`);
        return result.error ? { error: result.error } : { data: result.data as GroupPointRankingResponse };
      },
      providesTags: (_result, _error, { groupId, year, seasonId, scope }) => [{ type: "Group", id: `point-ranking-${groupId}-${scope}-${seasonId ?? year ?? "latest"}` }],
    }),

    getGroupRankingSeasons: builder.query<{ seasons: GroupRankingSeason[]; myRole: string }, string>({
      async queryFn(groupId, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          return {
            data: {
              seasons: readLocalRankingSeasons(group.id),
              myRole: profile.group.id === group.id ? "owner" : "",
            },
          };
        }
        const result = await fetchWithBQ(`/group/${groupId}/ranking/seasons`);
        return result.error
          ? { error: result.error }
          : { data: result.data as { seasons: GroupRankingSeason[]; myRole: string } };
      },
      providesTags: (_result, _error, groupId) => [{ type: "Group", id: `ranking-seasons-${groupId}` }],
    }),

    createGroupRankingSeason: builder.mutation<{ message: string; season: GroupRankingSeason }, { groupId: string; name?: string; startDate: string; endDate: string; autoRenew: boolean; pointRules: GroupRankingPointRules }>({
      async queryFn({ groupId, name, startDate, endDate, autoRenew, pointRules }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const seasons = readLocalRankingSeasons(group.id);
          const season: GroupRankingSeason = {
            id: `local-season-${Date.now()}`,
            name: name?.trim() || `${startDate.replaceAll("-", ".")} ~ ${endDate.replaceAll("-", ".")} 시즌`,
            start_date: startDate,
            end_date: endDate,
            auto_renew: autoRenew,
            is_default: false,
            point_rules: pointRules,
            created_at: new Date().toISOString(),
          };
          writeLocalRankingSeasons(group.id, [...seasons, season]);
          return { data: { message: "시즌을 생성했습니다.", season } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/ranking/seasons`,
          method: "POST",
          body: { name: name?.trim() || "", start_date: startDate, end_date: endDate, auto_renew: autoRenew, point_rules: pointRules },
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string; season: GroupRankingSeason } };
      },
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: `ranking-seasons-${groupId}` }, "Group",
      ],
    }),

    transferGroupOwner: builder.mutation<
      { message: string; previous_owner_action: "admin" | "member" | "leave"; benefits_transferred: boolean },
      {
        groupId: string;
        newOwnerUserId: string;
        previousOwnerAction: "admin" | "member" | "leave";
        benefitsAction: "keep" | "transfer";
        division?: string;
        externalAliases?: string[];
      }
    >({
      query: ({ groupId, newOwnerUserId, previousOwnerAction, benefitsAction, division, externalAliases }) => ({
        url: `/group/${groupId}/transfer-owner`,
        method: "POST",
        body: {
          new_owner_user_id: Number(newOwnerUserId),
          previous_owner_action: previousOwnerAction,
          benefits_action: benefitsAction,
          division,
          external_aliases: externalAliases,
        },
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: groupId },
        "Group",
        "League",
      ],
    }),

    updateGroupRankingSeason: builder.mutation<{ message: string; season: GroupRankingSeason }, { groupId: string; seasonId: string; name?: string; startDate: string; endDate: string; autoRenew: boolean; pointRules: GroupRankingPointRules }>({
      async queryFn({ groupId, seasonId, name, startDate, endDate, autoRenew, pointRules }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const seasons = readLocalRankingSeasons(group.id);
          const index = seasons.findIndex((season) => season.id === seasonId);
          if (index < 0) return { error: { status: 404, data: { message: "시즌을 찾을 수 없습니다." } } };
          const season = {
            ...seasons[index],
            name: name?.trim() || `${startDate.replaceAll("-", ".")} ~ ${endDate.replaceAll("-", ".")} 시즌`,
            start_date: startDate,
            end_date: endDate,
            auto_renew: autoRenew,
            point_rules: pointRules,
          };
          seasons[index] = season;
          writeLocalRankingSeasons(group.id, seasons);
          return { data: { message: "시즌을 수정했습니다.", season } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/ranking/seasons/${seasonId}`,
          method: "PUT",
          body: { name: name?.trim() || "", start_date: startDate, end_date: endDate, auto_renew: autoRenew, point_rules: pointRules },
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string; season: GroupRankingSeason } };
      },
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: `ranking-seasons-${groupId}` }, "Group",
      ],
    }),

    setGroupRankingDisplayDefault: builder.mutation<{ message: string; season: Pick<GroupRankingSeason, "id" | "name" | "is_display_default"> }, { groupId: string; seasonId: string }>({
      async queryFn({ groupId, seasonId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          const seasons = readLocalRankingSeasons(group.id).map((season) => ({
            ...season,
            is_display_default: season.id === seasonId,
          }));
          writeLocalRankingSeasons(group.id, seasons);
          const season = seasons.find((item) => item.id === seasonId);
          if (!season) return { error: { status: 404, data: { message: "시즌을 찾을 수 없습니다." } } };
          return { data: { message: "기본 노출 시즌이 변경되었습니다.", season } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/ranking/seasons/${seasonId}/display-default`,
          method: "PUT",
        });
        return result.error
          ? { error: result.error }
          : { data: result.data as { message: string; season: Pick<GroupRankingSeason, "id" | "name" | "is_display_default"> } };
      },
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: `ranking-seasons-${groupId}` }, "Group",
      ],
    }),

    deleteGroupRankingSeason: builder.mutation<{ message: string }, { groupId: string; seasonId: string }>({
      async queryFn({ groupId, seasonId }, api, _extraOptions, fetchWithBQ) {
        const token = (api.getState() as RootState).auth?.token;
        const profile = getLocalDevProfileByToken(token);
        const group = findLocalDevGroup(groupId);
        if (profile && group) {
          writeLocalRankingSeasons(group.id, readLocalRankingSeasons(group.id).filter((season) => season.id !== seasonId));
          return { data: { message: "시즌을 삭제했습니다." } };
        }
        const result = await fetchWithBQ({
          url: `/group/${groupId}/ranking/seasons/${seasonId}`,
          method: "DELETE",
        });
        return result.error ? { error: result.error } : { data: result.data as { message: string } };
      },
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Group", id: `ranking-seasons-${groupId}` }, "Group",
      ],
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
  useUpdateMyGroupPreferencesMutation,
  useCreateGroupMutation,
  useGetGroupDetailQuery,
  useLazyGetGroupDetailQuery,
  useSearchGroupsQuery,
  useLazyCheckGroupNameQuery,
  useJoinGroupMutation,
  useGetGroupPreMembersQuery,
  useCreateGroupPreMemberMutation,
  useDeleteGroupPreMemberMutation,
  useRequestGroupMemberClaimMutation,
  useReviewGroupMemberClaimMutation,
  useUpdateMemberRoleMutation,
  useTransferGroupOwnerMutation,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useLazyGeocodeAddressQuery,
  useLazySearchLeagueVenuesQuery,
  useRecommendGroupsMutation,
  useGetGroupMemberDetailQuery,
  useGetGroupMemberLeagueHistoryQuery,
  useGetGroupMemberHeadToHeadQuery,
  useGetGroupRankingQuery,
  useGetGroupPointRankingQuery,
  useGetGroupRankingSeasonsQuery,
  useCreateGroupRankingSeasonMutation,
  useUpdateGroupRankingSeasonMutation,
  useSetGroupRankingDisplayDefaultMutation,
  useDeleteGroupRankingSeasonMutation,
  useGetGroupRankingDetailQuery,
  useRebuildGroupRankingMutation,
} = groupApi;
