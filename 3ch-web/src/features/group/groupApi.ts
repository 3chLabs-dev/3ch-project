import { baseApi } from "../api/baseApi";

export interface Group {
  id: string;
  name: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  created_at: string;
  creator_name?: string;
  member_count: number;
  role: string;
}

export interface GetGroupsResponse {
  groups: Group[];
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  founded_at?: string;
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

export interface GetGroupDetailResponse {
  group: {
    id: string;
    name: string;
    description?: string;
    sport?: string;
    type?: string;
    region_city?: string;
    region_district?: string;
    founded_at?: string;
    created_at: string;
    creator_name?: string;
  };
  members: GroupMember[];
  myRole: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  sport?: string;
  type?: string;
  region_city?: string;
  region_district?: string;
  founded_at?: string;
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
  useUpdateGroupMutation,
  useDeleteGroupMutation,
} = groupApi;
