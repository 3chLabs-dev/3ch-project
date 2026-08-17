import { baseApi } from "../api/baseApi";

export type FeatureBalance = {
  unlimited: boolean;
  remaining: number | null;
  expiresAt?: string | null;
};

export type FeatureUsageResponse = {
  ok: boolean;
  usage: {
    league_create: FeatureBalance;
    vision_scan: FeatureBalance;
    draw_create: FeatureBalance;
    premium_promotion: FeatureBalance;
  };
};

export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyFeatureUsage: builder.query<FeatureUsageResponse, number | void>({
      query: () => "/payment/usage/me",
    }),
  }),
});

export const {
  useGetMyFeatureUsageQuery,
  useLazyGetMyFeatureUsageQuery,
} = usageApi;
