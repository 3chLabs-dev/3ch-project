import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "../../app/store";
import { logout } from "../auth/authSlice";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth?.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithAuthExpiry: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const hadToken = Boolean((api.getState() as RootState).auth?.token);
  const result = await rawBaseQuery(args, api, extraOptions);

  if (hadToken && result.error?.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    api.dispatch(logout());

    if (sessionStorage.getItem("auth-expiry-redirecting") !== "true") {
      sessionStorage.setItem("auth-expiry-redirecting", "true");
      const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(`/login?reason=session-expired&redirect=${encodeURIComponent(redirect)}`);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuthExpiry,
  tagTypes: ["Group", "League", "Draw", "Policy", "UserPreferences", "UserRanking", "HomeSummary"],
  endpoints: () => ({}),
});
