import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";

const GROUP_KEY = "woori_league_preferred_group";

type AppState = {
  preferredGroupId: string | null;
  hydrated: boolean;
};

export const hydrateApp = createAsyncThunk("app/hydrate", async () =>
  SecureStore.getItemAsync(GROUP_KEY),
);

export const persistPreferredGroup = createAsyncThunk(
  "app/persistPreferredGroup",
  async (groupId: string | null) => {
    if (groupId) await SecureStore.setItemAsync(GROUP_KEY, groupId);
    else await SecureStore.deleteItemAsync(GROUP_KEY);
    return groupId;
  },
);

const appSlice = createSlice({
  name: "app",
  initialState: { preferredGroupId: null, hydrated: false } as AppState,
  reducers: {
    setPreferredGroup(state, action: PayloadAction<string | null>) {
      state.preferredGroupId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateApp.fulfilled, (state, action) => {
        state.preferredGroupId = action.payload;
        state.hydrated = true;
      })
      .addCase(hydrateApp.rejected, (state) => {
        state.hydrated = true;
      })
      .addCase(persistPreferredGroup.fulfilled, (state, action) => {
        state.preferredGroupId = action.payload;
      });
  },
});

export const { setPreferredGroup } = appSlice.actions;
export default appSlice.reducer;
