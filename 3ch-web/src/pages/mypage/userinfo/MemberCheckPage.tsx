import { useMemo, useState } from "react";
import { Box, Button, CssBaseline, IconButton, InputAdornment, TextField, Typography, } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AppTheme from "../../shared-theme/AppTheme";
import { styled } from "@mui/material/styles";
import Stack from "@mui/material/Stack";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

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
    "& .MuiOutlinedInput-root .MuiInputAdornment-root .MuiIconButton-root": {
        borderRadius: 0.6,
        padding: "0px",
    },
} as const;

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
    ...forceSolid("#4A90E2", "#3C7FCC", "#fff"),
} as const;

const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,12}$/;

const validatePw = (v: string): string => {
    if (!v) return "비밀번호를 입력해주세요.";
    if (!pwRegex.test(v)) return "숫자+영문+특수기호를 모두 포함한 8~12자로 입력해주세요.";
    return "";
};

export default function MemberCheckPage() {
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [pwError, setPwError] = useState("");
    const [apiError, setApiError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [showPw, setShowPw] = useState(false);

    // ✅ 버튼 활성 조건(입력 + 에러 없음 + 로딩 아님)
    const canSubmit = useMemo(() => {
        const filled = password.trim().length > 0;
        const noErrors = !pwError;
        return Boolean(filled && noErrors && !isLoading);
    }, [password, pwError, isLoading]);

    const handleCheck = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setApiError("");

        const msg = validatePw(password);
        setPwError(msg);
        if (msg) return;

        setIsLoading(true);
        try {
            await axios.post(
                `${apiBaseUrl}/auth/member/verify-password`,
                { password },
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );
            
            sessionStorage.setItem("member_edit_verified", "true");
            navigate("/member/edit", { replace: true });
        } catch (error) {
            console.error(error);
            setApiError("비밀번호가 올바르지 않습니다.");
        } finally {
            setIsLoading(false);
        }
    };
    

    return (
        <AppTheme>
            <CssBaseline enableColorScheme />

            <SignInContainer direction="column" justifyContent="flex-start">
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 420,
                        mx: "auto",
                        minHeight: "100dvh",
                        backgroundColor: "transparent",
                    }}
                >
                    {/* 헤더 */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton onClick={() => navigate(-1)} sx={{ p: 0.5 }}>
                            <ArrowBackIosNewIcon />
                        </IconButton>
                        <Typography sx={{ fontSize: 18, fontWeight: 900 }}>회원정보 수정</Typography>
                    </Box>

                    <Typography
                        sx={{
                            mt: 3,
                            fontSize: 14,
                            color: "text.secondary",
                            fontWeight: 700,
                            whiteSpace: "pre-line",
                        }}
                    >
                        정보를 안전하게 보호하기 위해{"\n"}비밀번호를 입력해주세요.
                    </Typography>

                    <Box component="form" onSubmit={handleCheck} sx={{ mt: 4 }}>
                        {apiError && (
                            <Typography color="error" variant="body2" sx={{ textAlign: "center", mb: 1 }}>
                                {apiError}
                            </Typography>
                        )}

                        <TextField
                            placeholder="비밀번호"
                            type={showPw ? "text" : "password"}
                            fullWidth
                            sx={inputSx}
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                            onBlur={() => setPwError(validatePw(password))}
                            error={!!pwError}
                            helperText={pwError || " "}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton edge="end" onClick={() => setShowPw((p) => !p)} tabIndex={-1}>
                                            {showPw ? <Visibility /> : <VisibilityOff />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            disabled={!canSubmit}
                            sx={{ ...primaryBtnSx, mt: 3, opacity: canSubmit ? 1 : 0.35 }}
                        >
                            확인
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>
        </AppTheme>
    );
}