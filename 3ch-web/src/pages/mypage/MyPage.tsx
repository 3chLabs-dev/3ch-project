import { Box, Typography, Stack, Divider, IconButton, List, ListItemButton, ListItemText, Button, Link, Collapse, } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { logout } from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { baseApi } from "../../features/api/baseApi";
import { resetLeagueCreation } from "../../features/league/leagueCreationSlice";
import { useState } from "react";

type MenuItem = {
    label: string;
    to: string;
};

const MENU_ITEMS: MenuItem[] = [
    { label: "공지사항", to: "/mypage/notice" },
    { label: "고객센터", to: "/mypage/support" },
    { label: "후원하기", to: "/mypage/donate" },
    { label: "이용약관", to: "/mypage/terms" },
    { label: "개인정보 처리방침", to: "/mypage/privacy" },
];

export default function MyPage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const user = useAppSelector((state) => state.auth.user);
    const token = useAppSelector((state) => state.auth.token);

    const displayName = user?.name ?? user?.email ?? "사용자";
    const [bizOpen, setBizOpen] = useState(false);
    const handleEditClick = () => {
        if (user?.auth_provider === "local") {
            navigate("/mypage/member/password-check");
        } else {
            navigate("/mypage/member/edit");
        }
    };

    const handleLogout = () => {
        const ok = window.confirm("로그아웃 하시겠습니까?");
        if (!ok) return; // ✅ 취소면 아무 반응 없이 그대로

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch(logout());
        dispatch(resetLeagueCreation());
        dispatch(baseApi.util.resetApiState());
        navigate("/", { replace: true });
    };

    return (
        <Box>
            {/* 상단 헤더: 로고(또는 타이틀) + 설정 아이콘 */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "-4px" }}>
                <Typography sx={{ fontSize: 24, fontWeight: 900 }}>
                    더보기
                </Typography>

                <IconButton
                    aria-label="settings"
                    onClick={() => navigate("/mypage/settings")}
                    sx={{ ml: 1 }}
                >
                    <SettingsIcon />
                </IconButton>
            </Box>

            {/* ✅ 로그인 상태: 이름(좌) + 회원정보수정(우) / 비로그인: 문구만 */}
            {token ? (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
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

                <Box sx={{ pt: 1 }}>
                <Box
                    onClick={() => setBizOpen((v) => !v)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        userSelect: "none",
                        py: 1,
                    }}
                >
                    <Typography variant="body2" fontWeight={800}>
                        3ch 사업자 정보
                    </Typography>
                    <IconButton size="small" sx={{ transform: bizOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                        <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Collapse in={bizOpen} timeout={180}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", pb: 1 }}>
                        대표: 조하진 · 사업자등록번호: 000-00-00000
                        <br />
                        주소: 서울특별시 임시주소
                        <br />
                        고객센터: 0000-0000 · 이메일: 3chlabs@gmail.com
                    </Typography>
                </Collapse>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Link href="#" underline="hover" variant="body2" fontWeight={700}>
                        이용약관
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                        |
                    </Typography>
                    <Link href="#" underline="hover" variant="body2" fontWeight={700}>
                        개인정보 처리방침
                    </Link>
                </Stack>

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1.2, display: "block" }}
                >
                    Copyright 3ch. All rights reserved.
                </Typography>
            </Box>
        </Box>
    );
}
