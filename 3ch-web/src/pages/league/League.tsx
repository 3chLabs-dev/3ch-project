import * as React from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import AppTheme from "../shared-theme/AppTheme";
import { GoogleIcon } from "../../components/CustomIcons";
import { Link as RouterLink } from "react-router-dom";

import emailIcon from "../../icon/free-icon-email-813667.png";
import kakaoIcon from "../../icon/free-icon-kakao-talk-3991999.png";
import naverIcon from "../../icon/naver-icon-style.png";

const SignInContainer = styled(Stack)(({ theme }) => ({
  height: "auto",
  overflow: "hidden",
  padding: theme.spacing(2),
  position: "relative",
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
  "&::before": {
    content: '""',
    display: "block",
    position: "absolute",
    zIndex: -1,
    inset: 0,
    backgroundImage:
      "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
    backgroundRepeat: "no-repeat",
  },
}));

const inputSx = {
  "& .MuiInputBase-input": {
    fontSize: "0.98rem",
    py: 1.25,
  },
  "& .MuiInputBase-input::placeholder": {
    fontSize: "0.88rem",
    opacity: 0.6,
  },
  "& .MuiOutlinedInput-root": {
    borderRadius: 1.2,
    backgroundColor: "#fff",
  },
};

// mui에서 검은 하이라이트 강제 제거용
const forceSolid = (bg: string, hover: string, color: string) => ({
  backgroundColor: `${bg} !important`,
  color: `${color} !important`,
  backgroundImage: "none !important",
  boxShadow: "none !important",
  border: "none !important",
  "&:hover": {
    backgroundColor: `${hover} !important`,
    backgroundImage: "none !important",
    boxShadow: "none !important",
  },
});

const primaryBtnSx = {
  borderRadius: 999,
  py: 1.2,
  fontSize: "1rem",
  fontWeight: 700,
  textTransform: "none",
  ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
};

const socialBtnSx = {
  borderRadius: 999,
  py: 1.05,
  fontSize: "0.92rem",
  fontWeight: 400,
  textTransform: "none",
  borderWidth: 1,
  "& .MuiButton-startIcon": {
    marginRight: 1.2,
  },
};

export default function LeagueSchedule(props: Record<string, unknown>) {
  

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
                {/* 구글 */}
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  sx={{
                    ...socialBtnSx,
                    borderColor: "#cfcfcf",
                    color: "#111",
                    backgroundColor: "#fff",
                    backgroundImage: "none !important",
                    boxShadow: "none !important",
                    p: 0,
                  }}
                >
                </Button>
    
                {/* 카카오 */}
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  sx={{
                    ...socialBtnSx,
                    ...forceSolid("#FEE500", "#F5DC00", "#111"),
                    p: 0,
                  }}
                >
                </Button>
    
                {/* 네이버 */}
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  sx={{
                    ...socialBtnSx,
                    ...forceSolid("#03C75A", "#02B152", "#fff"),
                    p: 0,
                  }}
                >
                </Button>
    
                {/* 이메일 */}
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  sx={{
                    ...socialBtnSx,
                    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
                    p: 0,
                  }}
                  component={RouterLink}
                  to="/signup"
                >
                </Button>
              </Box>
  );
}
