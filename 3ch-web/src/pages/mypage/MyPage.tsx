import { Box, Typography, Stack, Divider, IconButton, List, ListItemButton, ListItemText } from "@mui/material";
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

            {/* 유저 이름 */}
            <Typography sx={{ mt: 2, fontSize: 12, fontWeight: 900 }}>
                {token ? displayName : "로그인이 필요합니다"}
            </Typography>

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
                            fontSize: 14,
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
