import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

//유저 정보 꺼내기 위한
export type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
  auth_provider: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem("user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: typeof window === "undefined" ? null : window.localStorage.getItem("token"),
  user: readStoredUser(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
    logout(state) {
      state.token = null;
      state.user = null;
    },
  },
});

export const { setToken, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
