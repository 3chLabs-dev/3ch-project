import { Box, Button, CssBaseline, IconButton, Typography } from "@mui/material";
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


// const forceSolid = (bg: string, hover: string, color: string) => ({
//     backgroundColor: `${bg} !important`,
//     color: `${color} !important`,
//     backgroundImage: "none !important",
//     boxShadow: "none !important",
//     border: "none !important",
//     "&:hover": {
//         backgroundColor: `${hover} !important`,
//         backgroundImage: "none !important",
//         boxShadow: "none !important",
//     },
// });

// const primaryBtnSx = {
//     borderRadius: 999,
//     height: 44,
//     fontSize: "1rem",
//     fontWeight: 800,
//     textTransform: "none",
//     ...forceSolid("#2F80ED", "#2F80ED", "#fff"),
// } as const;

const primaryBtnSx = {
  borderRadius: 999,
  height: 44,
  fontSize: "1rem",
  fontWeight: 800,
  textTransform: "none",
  backgroundColor: "#2F80ED",
  color: "#fff",
  boxShadow: "none",
  "&:hover": {
    backgroundColor: "#2F80ED",
    boxShadow: "none",
  },
  "&:active": {
    backgroundColor: "#2F80ED",
  },
};

export default function PasswordHelpPage(props: Record<string, unknown>) {
    const navigate = useNavigate();


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
                        비밀번호는 암호화 저장되어 분실 시 찾을 수 없는 정보 입니다.{"\n"}
                        채팅 문의를 통해 임시 비밀번호 발급을 요청해 주세요.
                    </Typography>

                    {/* 폼 */}
                    <Box sx={{ mt: 2 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disableElevation
                            onClick={() => window.dispatchEvent(new Event("open-support-chat"))}
                            sx={{
                                ...primaryBtnSx,
                                mt: 2,
                            }}
                        >
                            채팅 문의
                        </Button>
                    </Box>
                </Box>
            </SignInContainer>
        </AppTheme>
    );
}
