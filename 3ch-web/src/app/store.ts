import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { baseApi } from "../features/api/baseApi";
import leagueCreationReducer from "../features/league/leagueCreationSlice";
import leagueRenewalCreationReducer from "../features/league/leagueRenewalCreationSlice";
import adminReducer from "../features/admin/adminSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    admin: adminReducer,
    [baseApi.reducerPath]: baseApi.reducer,
    leagueCreation: leagueCreationReducer,
    leagueRenewalCreation: leagueRenewalCreationReducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
