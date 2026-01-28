import * as React from 'react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CssBaseline from '@mui/material/CssBaseline';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import AppTheme from '../shared-theme/AppTheme';
import ColorModeSelect from '../shared-theme/ColorModeSelect.jsx';
import { GoogleIcon, SitemarkIcon } from '../../components/CustomIcons.jsx';
import { Link as RouterLink } from "react-router-dom";
import axios from 'axios';
// import { login } from '../../features/auth/authSlice';
// import ForgotPassword from '../components/ForgotPassword.js';
// import { showNotification } from '../../features/ui/notificationSlice';
// import { GoogleAuth } from '../../util/googleAuth.js';
// import { KakaoAuth } from '../../util/kakaoAuth.js';

const SignInContainer = styled(Stack)(({ theme }) => ({
  height: "auto",
  overflow: "hidden",
  padding: theme.spacing(2),
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

// mui에서 검은 행잉 강제 추가 제거
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

//로그인 버튼 (강제 행잉 제거)
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

function IconPlaceholder() {
  return (
    <Box
      sx={{
        width: 26,
        height: 26,
        borderRadius: 0.6,
        backgroundColor: "#111",
        display: "inline-block",
      }}
    />
  );
}

// 아이콘 위치 조절을 위한 버튼 섹션구분
const ICON_SIZE = 26;
const ICON_LEFT_PAD = 80; // 아이콘 위치 조정
const ICON_SLOT_W = ICON_LEFT_PAD + ICON_SIZE;

function SocialBtnInner({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: `${ICON_SLOT_W}px 1fr ${ICON_SLOT_W}px`,
        alignItems: "center",
      }}
    >
      {/* ✅ 아이콘: 왼쪽 패딩만큼만 들어오게 */}
      <Box
        sx={{
          pl: `${ICON_LEFT_PAD}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {icon}
      </Box>

      {/* ✅ 텍스트: 진짜 정중앙 */}
      <Box sx={{ textAlign: "center" }}>{label}</Box>

      {/* ✅ 오른쪽 더미 슬롯 */}
      <Box />
    </Box>
  );
}

export default function Login(props) {
    const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [pwError, setPwError] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

  const validateEmail = (v) => {
    if (!v) return "이메일을 입력해주세요.";
    if (!emailRegex.test(v)) return "이메일 형식에 맞게 입력해주세요.";
    return "";
  };

  const validatePw = (v) => {
    if (!v) return "비밀번호를 입력해주세요.";
    if (!pwRegex.test(v))
      return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
    return "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const eMsg = validateEmail(email);
    const pMsg = validatePw(password);

    setEmailError(eMsg);
    setPwError(pMsg);

    if (eMsg || pMsg) return;

    // 로그인 요청
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />

      <SignInContainer direction="column" justifyContent="flex-start">
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            mx: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            backgroundColor: "transparent",
          }}
        >
          <Box sx={{ textAlign: "center", py: 1.5 }}>
            <Typography
              sx={{
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              로그인
            </Typography>
            <Box sx={{ height: 6 }} />
          </Box>

          <Box
            component="form"
            noValidate
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}
          >
            <TextField
              id="email"
              type="email"
              name="email"
              placeholder="아이디(이메일)"
              autoComplete="email"
              required
              fullWidth
              variant="outlined"
              sx={inputSx}

              value={email}
              onChange={(e) => {
                const v = e.target.value;
                setEmail(v);
                // 입력하면서 실시간으로 에러 지우거나 업데이트:
                // if (emailError) setEmailError(validateEmail(v));
              }}
              onBlur={() => setEmailError(validateEmail(email))}
              error={!!emailError}
              helperText={emailError || " "}
            />

            <TextField
              id="password"
              type="password"
              name="password"
              placeholder="비밀번호"
              autoComplete="current-password"
              required
              fullWidth
              variant="outlined"
              sx={inputSx}

              value={password}
              onChange={(e) => {
                const v = e.target.value;
                setPassword(v);
                if (pwError) setPwError(validatePw(v));
              }}
              onBlur={() => setPwError(validatePw(password))}
              error={!!pwError}
              helperText={pwError || " "}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disableElevation
              sx={primaryBtnSx}
            >
              로그인
            </Button>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Link
                component="button"
                type="button"
                underline="hover"
                sx={{ fontSize: "0.85rem", color: "text.secondary" }}
              >
                비밀번호 찾기
              </Link>
            </Box>
          </Box>

          <Divider sx={{ my: 0.5, fontSize: "0.9rem" }}>간편 로그인</Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
            {/* ✅ 구글 */}
            <Button
              fullWidth
              variant="outlined"
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
              <SocialBtnInner
                icon={<GoogleIcon sx={{ fontSize: 26 }} />}
                label="구글로 시작하기"
              />
            </Button>

            {/* ✅ 카카오 */}
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
              <SocialBtnInner icon={<IconPlaceholder />} label="카카오로 시작하기" />
            </Button>

            {/* ✅ 네이버 */}
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
              <SocialBtnInner icon={<IconPlaceholder />} label="네이버로 시작하기" />
            </Button>

            {/* ✅ 이메일 */}
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
              <SocialBtnInner label="이메일로 가입하기" />
            </Button>
          </Box>
        </Box>
      </SignInContainer>
    </AppTheme>
  );
}

