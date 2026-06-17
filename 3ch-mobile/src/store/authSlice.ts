import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "woori_league_token";
const USER_KEY = "woori_league_user";

export type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
  auth_provider?: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
};

export const hydrateAuth = createAsyncThunk("auth/hydrate", async () => {
  const [token, userJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  return {
    token,
    user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
  };
});

export const persistLogin = createAsyncThunk(
  "auth/persistLogin",
  async ({ token, user }: { token: string; user: AuthUser }) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    return { token, user };
  },
);

export const persistLogout = createAsyncThunk("auth/persistLogout", async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
});

const initialState: AuthState = {
  token: null,
  user: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.hydrated = true;
      })
      .addCase(hydrateAuth.rejected, (state) => {
        state.hydrated = true;
      })
      .addCase(persistLogin.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(persistLogout.fulfilled, (state) => {
        state.token = null;
        state.user = null;
      });
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
