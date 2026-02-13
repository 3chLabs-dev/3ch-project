import * as React from "react";
import { useState } from "react";
import { Box, Button, CssBaseline, IconButton, TextField, Typography } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import AppTheme from "../../shared-theme/AppTheme";
import { styled } from "@mui/material/styles";
import Stack from "@mui/material/Stack";

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
    height: 44,
    fontSize: "1rem",
    fontWeight: 800,
    textTransform: "none",
    ...forceSolid("#2F80ED", "#2B74D6", "#fff"),
} as const;

export default function PasswordResetRequestPage(props: Record<string, unknown>) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (v: string) => {
        if (!v) return "이메일을 입력해주세요.";
        if (!emailRegex.test(v)) return "이메일 형식에 맞게 입력해주세요.";
        return "";
    };

    const canSubmit = email.trim().length > 0 && emailRegex.test(email);


    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />

            <SignInContainer direction="column" justifyContent="flex-start">
                <Box
                    sx={{
                        width: "100%",
                        maxWidth: 420,
                        mx: "auto",
                        minHeight: "100dvh",
                    }}
                >
                    {/* 헤더 */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton
                            onClick={() => navigate("/login")}
                            disableRipple
                            sx={{ p: 0.5, "&:hover": { background: "transparent" } }}
                        >
                            <ArrowBackIosNewIcon sx={{ fontSize: 22 }} />
                        </IconButton>

                        <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
                            비밀번호 찾기
                        </Typography>
                    </Box>

                    {/* 안내 문구 */}
                    <Typography
                        sx={{
                            mt: 3,
                            fontSize: 14,
                            color: "#222",
                            fontWeight: 700,
                            whiteSpace: "pre-line",
                            lineHeight: 1.55,
                        }}
                    >
                        비밀번호는 암호화 저장되어{"\n"}
                        분실 시 찾을 수 없는 정보 입니다.{"\n"}
                        인증메일을 통해 암호를 재설정해주세요.
                    </Typography>

                    {/* 폼 */}
                    <Box
                        component="form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const msg = validateEmail(email);
                            setEmailError(msg);
                            if (msg) return;

                            alert("인증메일 발송(임시)");
                        }}
                        sx={{ mt: 5 }}
                    >
                        <TextField
                            placeholder="아이디(이메일)"
                            type="email"
                            fullWidth
                            sx={inputSx}
                            value={email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const v = e.target.value;
                                setEmail(v);
                                if (emailError) setEmailError(validateEmail(v));
                            }}
                            onBlur={() => setEmailError(validateEmail(email))}
                            error={!!emailError}
                            helperText={emailError || " "}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            disabled={!canSubmit}
                            sx={{
                                ...primaryBtnSx,
                                mt: 2,
                                opacity: canSubmit ? 1 : 0.35, 
                            }}
                        >
                            인증메일 발송
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>
        </AppTheme>
    );
}
