import * as React from 'react';
import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import AppTheme from '../shared-theme/AppTheme.tsx';
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import axios from 'axios';
import { Link as RouterLink } from "react-router-dom";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";


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


const primaryBtnSx = {
    borderRadius: 999,
    py: 1.2,
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "none",
    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
};

export default function SignUp(props) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState(""); // ✅ 추가
    const [username, setUsername] = useState("");

    const [emailError, setEmailError] = useState("");
    const [pwError, setPwError] = useState("");
    const [confirmError, setConfirmError] = useState("");
    const [nameError, setNameError] = useState("");

    const [agree, setAgree] = useState({
        all: false,
        age: false,      // 만 14세 이상 (필수)
        terms: false,    // 서비스 이용약관 (필수)
        privacy: false,  // 개인정보 수집 및 이용 (필수)
    });

    const setAll = (checked) => {
        setAgree({
            all: checked,
            age: checked,
            terms: checked,
            privacy: checked,
        });
    };

    const toggleOne = (key) => (e) => {
        const checked = e.target.checked;
        setAgree((prev) => {
            const next = { ...prev, [key]: checked };
            const allChecked = next.age && next.terms && next.privacy;
            return { ...next, all: allChecked };
        });
    };

    const toggleAll = (e) => {
        setAll(e.target.checked);
    };

    // ✅ 비번 보기(누르는 동안만 보이게)
    const [showPw, setShowPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);

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

    const validateName = (v) => {
        if (!v) return "이름을 입력해주세요.";
        return "";
    };

    const validateConfirm = (pw, cpw) => {
        if (!cpw) return "비밀번호 확인을 입력해주세요.";
        if (pw !== cpw) return "비밀번호가 일치하지 않습니다.";
        return "";
    };

    // ✅ 실시간으로 “일치합니다” 초록 문구
    const confirmHelper = useMemo(() => {
        if (!confirmPassword) return " ";
        if (password && confirmPassword && password === confirmPassword) {
            return "비밀번호가 일치합니다.";
        }
        return confirmError || " ";
    }, [password, confirmPassword, confirmError]);

    const confirmHelperSx = useMemo(() => {
        if (password && confirmPassword && password === confirmPassword) {
            return { "& .MuiFormHelperText-root": { color: "success.main" } };
        }
        return {};
    }, [password, confirmPassword]);

    // ✅ 버튼 활성 조건: 전부 값 존재 + 에러 없음 + 비번 일치
    const canSubmit = useMemo(() => {
        const filled =
            email.trim() && password.trim() && confirmPassword.trim() && username.trim();
        const noErrors = !emailError && !pwError && !confirmError && !nameError;
        const match = password && confirmPassword && password === confirmPassword;
        const requiredAgree = agree.age && agree.terms && agree.privacy;

        return Boolean(filled && noErrors && match && requiredAgree);
    }, [email, password, confirmPassword, username, emailError, pwError, confirmError, nameError, agree]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const eMsg = validateEmail(email);
        const pMsg = validatePw(password);
        const cMsg = validateConfirm(password, confirmPassword);
        const nMsg = validateName(username);

        setEmailError(eMsg);
        setPwError(pMsg);
        setConfirmError(cMsg);
        setNameError(nMsg);

        if (eMsg || pMsg || cMsg || nMsg) return;

        // ✅ 여기서 회원가입 요청 axios.post(...)
        // axios.post("/api/signup", { email, password, username })
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
                        <Typography sx={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                            회원가입
                        </Typography>
                        <Box sx={{ height: 6 }} />
                    </Box>

                    <Box
                        component="form"
                        noValidate
                        onSubmit={handleSubmit}
                        sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}
                    >
                        {/* 이메일 */}
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
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setEmailError(validateEmail(email))}
                            error={!!emailError}
                            helperText={emailError || " "}
                        />

                        {/* 비밀번호 */}
                        <TextField
                            id="password"
                            type={showPw ? "text" : "password"}
                            name="password"
                            placeholder="비밀번호"
                            autoComplete="new-password"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={password}
                            onChange={(e) => {
                                const v = e.target.value;
                                setPassword(v);
                                if (pwError) setPwError(validatePw(v));

                                // 비번 바뀌면 확인도 다시 검사
                                if (confirmPassword) setConfirmError(validateConfirm(v, confirmPassword));
                            }}
                            onBlur={() => setPwError(validatePw(password))}
                            error={!!pwError}
                            helperText={pwError || " "}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            edge="end"
                                            // ✅ 누르는 동안만 보이게(마우스/터치)
                                            onClick={() => setShowPw((prev) => !prev)}
                                            tabIndex={-1}
                                        >
                                            {showPw ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* 비밀번호 확인 */}
                        <TextField
                            id="confirmPassword"
                            type={showConfirmPw ? "text" : "password"}
                            name="confirmPassword"
                            placeholder="비밀번호 확인"
                            autoComplete="new-password"
                            required
                            fullWidth
                            variant="outlined"
                            sx={{ ...inputSx, ...confirmHelperSx }}
                            value={confirmPassword}
                            onChange={(e) => {
                                const v = e.target.value;
                                setConfirmPassword(v);
                                setConfirmError(validateConfirm(password, v));
                            }}
                            onBlur={() => setConfirmError(validateConfirm(password, confirmPassword))}
                            error={!!confirmError && !(password && confirmPassword && password === confirmPassword)}
                            helperText={confirmHelper}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            edge="end"
                                            onClick={() => setShowConfirmPw((prev) => !prev)}
                                            tabIndex={-1}
                                        >
                                            {showConfirmPw ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* 이름 */}
                        <TextField
                            id="username"
                            type="text"
                            name="username"
                            placeholder="이름"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}  // ✅ 여기 핵심
                            onBlur={() => setNameError(validateName(username))}
                            error={!!nameError}
                            helperText={nameError || " "}
                        />

                        <Box
                            sx={{
                                mt: 0.5,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                backgroundColor: "#fff",
                                px: 1.5,
                                py: 1.2,
                            }}
                        >
                            <FormControlLabel
                                sx={{
                                    m: 0,
                                    "& .MuiFormControlLabel-label": { fontWeight: 700 },
                                }}
                                control={
                                    <Checkbox
                                        checked={agree.all}
                                        onChange={toggleAll}
                                        size="small"
                                    />
                                }
                                label="약관 전체 동의"
                            />

                            <Divider sx={{ my: 0.8 }} />

                            <FormControlLabel
                                sx={{ m: 0 }}
                                control={
                                    <Checkbox
                                        checked={agree.age}
                                        onChange={toggleOne("age")}
                                        size="small"
                                    />
                                }
                                label="만 14세 이상입니다.(필수)"
                            />

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mt: 0.2,
                                }}
                            >
                                <FormControlLabel
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox
                                            checked={agree.terms}
                                            onChange={toggleOne("terms")}
                                            size="small"
                                        />
                                    }
                                    label="서비스 이용약관 동의(필수)"
                                />
                                <Link
                                    component={RouterLink}
                                    to="/terms"
                                    underline="none"
                                    sx={{ fontSize: "0.9rem", fontWeight: 600 }}
                                >
                                    보기 ＞
                                </Link>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mt: 0.2,
                                }}
                            >
                                <FormControlLabel
                                    sx={{ m: 0 }}
                                    control={
                                        <Checkbox
                                            checked={agree.privacy}
                                            onChange={toggleOne("privacy")}
                                            size="small"
                                        />
                                    }
                                    label="개인정보 수집 및 이용 동의(필수)"
                                />
                                <Link
                                    component={RouterLink}
                                    to="/privacy"
                                    underline="none"
                                    sx={{ fontSize: "0.9rem", fontWeight: 600 }}
                                >
                                    보기 ＞
                                </Link>
                            </Box>
                        </Box>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            sx={{
                                ...primaryBtnSx,
                                // ✅ 비활성 스타일 (원하는 톤으로 조절 가능)
                                opacity: canSubmit ? 1 : 0.35,
                            }}
                            disabled={!canSubmit}   // ✅ 전부 통과해야 활성화
                        >
                            회원가입
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>
        </AppTheme>
    );
}