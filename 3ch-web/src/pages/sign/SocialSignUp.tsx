import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import AppTheme from "../shared-theme/AppTheme.tsx";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { useAppDispatch } from "../../app/hooks";
import { setToken, setUser } from "../../features/auth/authSlice";

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
        py: 1.25,
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

export default function SocialSignUp() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const ticket = useMemo(() => {
        return new URLSearchParams(window.location.search).get("ticket") ?? "";
    }, []);

    const [name, setName] = useState<string>("");
    const [nameError, setNameError] = useState<string>("");
    const [apiError, setApiError] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const validateName = (v: string): string => {
        if (!v) return "이름을 입력해주세요.";
        if (v.length > 50) return "이름은 10자 이내로 입력해주세요.";
        return "";
    };

    const canSubmit = useMemo(() => {
        const filled = name.trim();
        const noErrors = !nameError;
        return Boolean(ticket && filled && noErrors && !isLoading);
    }, [ticket, name, nameError, isLoading]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setApiError("");

        const nMsg = validateName(name);
        setNameError(nMsg);
        if (nMsg) return;

        if (!ticket) {
            setApiError("가입 티켓이 없습니다. 다시 소셜 로그인을 진행해주세요.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await axios.post(`${apiBaseUrl}/auth/social/complete`, {
                ticket,
                name,
            });

            const token = res.data?.token;
            const user = res.data?.user;

            if (!token) {
                setApiError("토큰을 받지 못했습니다.");
                return;
            }

            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(user));

            dispatch(setToken(token));
            dispatch(setUser(user));

            navigate("/", { replace: true });
        } catch (error) {
            console.error(error);
            setApiError("이름 설정 중 오류가 발생했습니다.");
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
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        backgroundColor: "transparent",
                    }}
                >
                    <Box sx={{ textAlign: "center", py: 1.5 }}>
                        <Typography sx={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                            이름 설정
                        </Typography>
                        <Typography sx={{ mt: 0.5 }} color="text.secondary">
                            우리리그에서 사용할 이름을 입력해주세요.
                        </Typography>
                        <Box sx={{ height: 6 }} />
                    </Box>

                    <Box
                        component="form"
                        noValidate
                        onSubmit={handleSubmit}
                        sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                    >
                        {apiError && (
                            <Typography color="error" variant="body2" sx={{ textAlign: "center", mb: 1 }}>
                                {apiError}
                            </Typography>
                        )}

                        <TextField
                            id="name"
                            type="text"
                            name="name"
                            placeholder="이름"
                            required
                            fullWidth
                            variant="outlined"
                            sx={inputSx}
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            onBlur={() => setNameError(validateName(name))}
                            error={!!nameError}
                            helperText={nameError || " "}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disableElevation
                            sx={{ ...primaryBtnSx, opacity: canSubmit ? 1 : 0.35 }}
                            disabled={!canSubmit}
                        >
                            완료
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>
        </AppTheme>
    );
}
