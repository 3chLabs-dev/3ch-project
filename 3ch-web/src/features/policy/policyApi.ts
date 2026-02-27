import { baseApi } from "../api/baseApi";

export interface PolicyVersionMeta {
  id: number;
  label: string;
  effective_date: string;
  is_current: boolean;
}

export interface PolicyVersionDetail extends PolicyVersionMeta {
  body: string;
}

export type PolicyType = "terms" | "privacy";

export const policyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPolicyVersions: builder.query<{ versions: PolicyVersionMeta[] }, PolicyType>({
      query: (type) => `/policies/${type}/versions`,
      providesTags: (_result, _error, type) => [{ type: "Policy" as const, id: type }],
      keepUnusedDataFor: 0,
    }),
    getPolicyVersion: builder.query<PolicyVersionDetail, { type: PolicyType; id: number }>({
      query: ({ type, id }) => `/policies/${type}/versions/${id}`,
      providesTags: (_result, _error, { id }) => [{ type: "Policy" as const, id }],
      keepUnusedDataFor: 0,
    }),
    getCurrentPolicyVersion: builder.query<PolicyVersionDetail, PolicyType>({
      query: (type) => `/policies/${type}/current`,
      providesTags: (_result, _error, type) => [{ type: "Policy" as const, id: `${type}-current` }],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetPolicyVersionsQuery,
  useGetPolicyVersionQuery,
  useGetCurrentPolicyVersionQuery,
} = policyApi;
