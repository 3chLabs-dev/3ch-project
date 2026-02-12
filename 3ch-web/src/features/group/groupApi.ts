import { baseApi } from "../api/baseApi";

export interface Group {
  id: string;
  name: string;
  description?: string;
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

export interface GetGroupDetailResponse {
  group: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    creator_name?: string;
  };
  members: GroupMember[];
  myRole: string;
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

    checkGroupName: builder.query<CheckNameResponse, string>({
      query: (name) => `/group/check-name?name=${encodeURIComponent(name)}`,
    }),
  }),
});

export const {
  useGetMyGroupsQuery,
  useCreateGroupMutation,
  useGetGroupDetailQuery,
  useLazyCheckGroupNameQuery,
} = groupApi;
