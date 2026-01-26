import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
    // prepareHeaders: (headers, { getState }) => {
    prepareHeaders: (headers) => {
      // TODO: 토큰 붙일 때 사용
      // const token = (getState() as any).auth?.token;
      // if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: () => ({}),
});
