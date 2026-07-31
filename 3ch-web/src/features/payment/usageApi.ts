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
  };
};

export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyFeatureUsage: builder.query<FeatureUsageResponse, void>({
      query: () => "/payment/usage/me",
    }),
  }),
});

export const { useGetMyFeatureUsageQuery } = usageApi;
