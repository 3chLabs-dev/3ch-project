import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type AdminUser = {
  id: number;
  email: string;
  name: string | null;
};

type AdminState = {
  token: string | null;
  user: AdminUser | null;
};

const STORAGE_KEY = "admin_token";

const initialState: AdminState = {
  token: localStorage.getItem(STORAGE_KEY),
  user: null,
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    adminLogin(state, action: PayloadAction<{ token: string; user: AdminUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem(STORAGE_KEY, action.payload.token);
    },
    adminLogout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(STORAGE_KEY);
    },
    setAdminUser(state, action: PayloadAction<AdminUser>) {
      state.user = action.payload;
    },
  },
});

export const { adminLogin, adminLogout, setAdminUser } = adminSlice.actions;
export default adminSlice.reducer;
