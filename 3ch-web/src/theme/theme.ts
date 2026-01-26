import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f5f6f8",
      paper: "#ffffff",
    },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: [
      "Pretendard",
      "Apple SD Gothic Neo",
      "Noto Sans KR",
      "system-ui",
      "sans-serif",
    ].join(","),
  },
});
