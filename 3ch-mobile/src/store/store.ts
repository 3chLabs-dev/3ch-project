import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "../api/baseApi";
import authReducer from "./authSlice";
import appReducer from "./appSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    app: appReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
