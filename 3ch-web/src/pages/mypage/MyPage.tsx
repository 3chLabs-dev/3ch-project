import { Box, Typography, Stack, Divider, IconButton, List, ListItemButton, ListItemText, Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";

import { logout } from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

type MenuItem = {
    label: string;
    to: string;
};

const MENU_ITEMS: MenuItem[] = [
    { label: "공지사항", to: "/notice" },
    { label: "고객센터", to: "/support" },
    { label: "후원하기", to: "/donate" },
    { label: "이용약관", to: "/terms" },
    { label: "개인정보 처리방침", to: "/privacy" },
];

export default function MyPage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const user = useAppSelector((state) => state.auth.user);
    const token = useAppSelector((state) => state.auth.token);

    const displayName = user?.name ?? user?.email ?? "사용자";

    const handleEditClick = () => {
    if (user?.auth_provider === "local") {
        navigate("/member/password-check");
    } else {
        navigate("/member/edit");
    }
};

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch(logout());
        navigate("/", { replace: true });
    };

    return (
        <Box sx={{ px: 2, pt: 2 }}>
            {/* 상단 헤더: 로고(또는 타이틀) + 설정 아이콘 */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
                    우리리그
                </Typography>

                <IconButton
                    aria-label="settings"
                    onClick={() => navigate("/settings")}
                    sx={{ ml: 1 }}
                >
                    <SettingsIcon />
                </IconButton>
            </Box>

            {/* ✅ 로그인 상태: 이름(좌) + 회원정보수정(우) / 비로그인: 문구만 */}
            {token ? (
                <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 900, color: "primary.main" }}>
                        {displayName}
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={handleEditClick}
                        sx={{
                            height: 32,
                            px: 1.6,
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 13,
                            bgcolor: "grey.200",
                            color: "text.primary",
                            boxShadow: "none",
                            "&:hover": { bgcolor: "grey.300", boxShadow: "none" },
                        }}
                    >
                        회원정보수정
                    </Button>
                </Box>
            ) : (
                <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 900 }}>
                    로그인이 필요합니다
                </Typography>
                
                <Button
                        variant="contained"
                        onClick={() => navigate("/login")}
                        sx={{
                            height: 32,
                            px: 1.6,
                            borderRadius: 999,
                            fontWeight: 900,
                            fontSize: 13,
                            // bgcolor: "grey.200",
                            // color: "text.primary",
                            // boxShadow: "none",
                            // "&:hover": { bgcolor: "grey.300", boxShadow: "none" },
                        }}
                    >
                        로그인
                    </Button>
                </Box>
                
            )}


            <Divider sx={{ my: 2 }} />

            {/* 메뉴 리스트 */}
            <List disablePadding>
                {MENU_ITEMS.map((item) => (
                    <ListItemButton
                        key={item.to}
                        onClick={() => navigate(item.to)}
                        sx={{
                            px: 0,
                            py: 1.3,
                        }}
                    >
                        <ListItemText
                            primary={
                                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
                                    {item.label}
                                </Typography>
                            }
                        />
                        <ChevronRightIcon sx={{ color: "text.secondary" }} />
                    </ListItemButton>
                ))}
            </List>

            {/* 로그아웃: 개인정보 처리방침 아래, 작고 회색 */}
            {token && (
                <Box sx={{ mt: 1 }}>
                    <Typography
                        onClick={handleLogout}
                        sx={{
                            fontSize: 16,
                            color: "text.disabled",
                            cursor: "pointer",
                            display: "inline-block",
                            py: 1,
                            "&:hover": { color: "text.secondary" },
                        }}
                    >
                        로그아웃
                    </Typography>
                </Box>
            )}

            <Stack sx={{ mt: 3 }} spacing={0.4}>
                <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
                    3ch 사업자 정보
                </Typography>
                {/* <Typography sx={{ fontSize: 12, color: "text.disabled" }}>대표: ...</Typography> */}
            </Stack>
        </Box>
    );
}
