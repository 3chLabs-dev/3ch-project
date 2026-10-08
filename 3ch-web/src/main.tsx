import React from "react";
import ReactDOM from "react-dom/client";

// Kakao SDK 초기화
declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: object) => void;
      };
    };
  }
}
const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
if (kakaoKey && window.Kakao && !window.Kakao.isInitialized()) {
  window.Kakao.init(kakaoKey);
}
import { RouterProvider } from "react-router-dom";
import { Provider } from "react-redux";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { store } from "./app/store";
import { router } from "./routes";
import { theme } from "./theme/theme";

// Older public snapshots captured MUI portals outside #root. createRoot only
// replaces #root, so those inert dialogs must be removed before mounting.
document.querySelectorAll('body > .MuiModal-root').forEach((node) => node.remove());
document.getElementById('root')?.removeAttribute('aria-hidden');
document.body.style.removeProperty('overflow');
document.body.style.removeProperty('padding-right');

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
