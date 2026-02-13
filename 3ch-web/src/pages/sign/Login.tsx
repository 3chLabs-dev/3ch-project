import * as React from "react";
import { useState, useEffect } from "react";
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
import googleAuth from "../util/googleAuth";
import kakaoAuth from "../util/kakaoAuth";
import naverAuth from "../util/naverAuth";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setToken, setUser } from "../../features/auth/authSlice";

import emailIcon from "../../icon/free-icon-email-813667.png";
import kakaoIcon from "../../icon/free-icon-kakao-talk-3991999.png";
import naverIcon from "../../icon/naver-icon.png";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

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
    paddingTop: "0px",
    paddingBottom: "2px", 
  },
  "& .MuiInputBase-input::placeholder": {
    fontSize: "0.88rem",
    opacity: 0.6,
  },
  "& .MuiOutlinedInput-root": {
    borderRadius: 0.6,
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
  paddingTop: "0px",
  paddingBottom: "2px", 
  fontSize: "1rem",
  fontWeight: 700,
  textTransform: "none",
  ...forceSolid("#4A90E2", "#4A90E2", "#fff"),
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

type SocialIconProps = {
  src: string;
  alt: string;
};

function SocialIcon({ src, alt }: SocialIconProps) {
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{ width: 26, height: 26, objectFit: "contain" }}
    />
  );
}

// 아이콘 위치 조절
const ICON_SIZE = 26;
const ICON_LEFT_PAD = 80;
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

      <Box sx={{ textAlign: "center" }}>{label}</Box>
      <Box />
    </Box>
  );
}

export default function Login(props: Record<string, unknown>) {
  const navigate = useNavigate();
    const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [pwError, setPwError] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

  const validateEmail = (v: string) => {
    if (!v) return "이메일을 입력해주세요.";
    if (!emailRegex.test(v)) return "이메일 형식에 맞게 입력해주세요.";
    return "";
  };

  const validatePw = (v: string) => {
    if (!v) return "비밀번호를 입력해주세요.";
    if (!pwRegex.test(v))
      return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const eMsg = validateEmail(email);
    const pMsg = validatePw(password);

    setEmailError(eMsg);
    setPwError(pMsg);

    if (eMsg || pMsg) return; 

try {
      const res = await axios.post(`${apiBaseUrl}/auth/login`, { email, password });

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token) {
        alert("토큰을 받지 못했습니다.");
        return;
      }

      // ✅ 로컬스토리지 저장
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // ✅ 리덕스 저장
      dispatch(setToken(token));
      dispatch(setUser(user));

      alert("로그인 성공");
      navigate("/", { replace: true });
    } catch (err) {
      console.log("login fail:", err);
      alert("로그인 실패");
    }
  };

  // 소셜 로그인 요청처리 
useEffect(() => {
  const handler = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    const type = event.data?.type;

    //신규 소셜 이름 입력필요 처리
    if (type === "SOCIAL_NEED_NAME") {
      const ticket = event.data?.ticket;
      if (!ticket) {
        alert("가입 티켓이 없습니다.");
        return;
      }
      navigate(`/social-signup?ticket=${encodeURIComponent(ticket)}`, { replace: true });
      return;
    }
    //기존 유저 진행
    if (type === "SOCIAL_LOGIN_SUCCESS") {
      const token = event.data?.token;
      if (!token) {
        alert("토큰을 받지 못했습니다.");
        return;
      }

      localStorage.setItem("token", token);
      dispatch(setToken(token));

      try {
        const res = await axios.get(`${apiBaseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = res.data?.user;
        if (!user) {
          throw new Error("NO_USER_FROM_ME");
        }

        localStorage.setItem("user", JSON.stringify(user));
        dispatch(setUser(user));

        navigate("/", { replace: true });
      } catch (err) {
        console.log("social me fail:", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch(setToken(null));
        dispatch(setUser(null));

        alert("소셜 로그인 처리 실패 (/api/auth/me 실패)");
      }
      return;
    }

    if (type === "SOCIAL_LOGIN_FAIL") {
      console.log("SOCIAL_LOGIN_FAIL payload:", event.data);
      const reason = event.data?.reason || "UNKNOWN";
      alert(`소셜 로그인 실패: ${reason}`);
      return;
    }
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}, [navigate, dispatch]);


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
            sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
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
                onClick={() => navigate("/password/help")}
              >
                비밀번호 찾기
              </Link>
            </Box>
          </Box>

          <Divider sx={{ my: 0.5, fontSize: "0.9rem" }}>간편 로그인</Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
            {/* 구글 */}
            <Button
              onClick={googleAuth}
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
                "&:hover": {
                backgroundColor: "#fff",   // 살짝 회색
                boxShadow: "none",
              },
              }}
            >
              <SocialBtnInner
                icon={<GoogleIcon sx={{ fontSize: 26 }} />}
                label="구글로 시작하기"
              />
            </Button>

            {/* 카카오 */}
            <Button
              onClick={kakaoAuth}
              fullWidth
              variant="contained"
              disableElevation
              sx={{
                ...socialBtnSx,
                ...forceSolid("#FFEB3B", "#FFEB3B", "#111"),
                p: 0,
              }}
            >
              <SocialBtnInner
                icon={<SocialIcon src={kakaoIcon} alt="kakao" />}
                label="카카오로 시작하기"
              />
            </Button>

            {/* 네이버 */}
            <Button
              onClick={naverAuth}
              fullWidth
              variant="contained"
              disableElevation
              sx={{
                ...socialBtnSx,
                ...forceSolid("#00C63B", "#00C63B", "#fff"),
                p: 0,
              }}
            >
              <SocialBtnInner
                icon={<SocialIcon src={naverIcon} alt="naver" />}
                label="네이버로 시작하기"
              />
            </Button>

            {/* 이메일 */}
            <Button
              fullWidth
              variant="contained"
              disableElevation
              sx={{
                ...socialBtnSx,
                ...forceSolid("#4A90E2", "#4A90E2", "#fff"),
                p: 0,
              }}
              component={RouterLink}
              to="/signup"
            >
              <SocialBtnInner
                icon={<SocialIcon src={emailIcon} alt="email" />}
                label="이메일로 가입하기"
              />
            </Button>
          </Box>
        </Box>
      </SignInContainer>
    </AppTheme>
  );
}
