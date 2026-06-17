import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../store/store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://woorileague.com/api";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Group", "League", "Home", "UserPreferences", "SupportChat"],
  endpoints: () => ({}),
});
