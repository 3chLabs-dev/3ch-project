import {
    Box, Typography, Stack, Divider, List, ListItemButton,
    ListItemText, ListItemIcon, Button, Card, Chip,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import LiveHelpOutlinedIcon from "@mui/icons-material/LiveHelpOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useNavigate } from "react-router-dom";
import { logout } from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { baseApi } from "../../features/api/baseApi";
import { resetLeagueCreation } from "../../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery } from "../../features/group/groupApi";

const ROLE_LABEL: Record<string, string> = {
    owner: "모임장",
    admin: "운영진",
    member: "회원",
};

const COMMUNITY_ITEMS = [
    { label: "이용방법", to: "/mypage/guide", icon: <MenuBookOutlinedIcon fontSize="small" /> },
    { label: "후원하기", to: "/mypage/donate", icon: <FavoriteBorderIcon fontSize="small" /> },
];

const SUPPORT_ITEMS = [
    { label: "공지사항", to: "/mypage/notice", icon: <CampaignOutlinedIcon fontSize="small" /> },
    { label: "자주 하는 질문", to: "/mypage/faq", icon: <LiveHelpOutlinedIcon fontSize="small" /> },
    { label: "문의사항", to: "/mypage/inquiry", icon: <QuestionAnswerOutlinedIcon fontSize="small" /> },
];

const POLICY_ITEMS = [
    { label: "이용약관", to: "/mypage/terms", icon: <ArticleOutlinedIcon fontSize="small" /> },
    { label: "개인정보 처리방침", to: "/mypage/privacy", icon: <LockOutlinedIcon fontSize="small" /> },
];

export default function MyPage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const user = useAppSelector((state) => state.auth.user);
    const token = useAppSelector((state) => state.auth.token);
    const displayName = user?.name ?? user?.email ?? "사용자";

    const { data: groupData } = useGetMyGroupsQuery(undefined, { skip: !token });
    const myFirstGroup = groupData?.groups?.[0];
    const roleLabel = myFirstGroup ? (ROLE_LABEL[myFirstGroup.role] ?? "회원") : null;

    const handleEditClick = () => {
        if (user?.auth_provider === "local") {
            navigate("/mypage/member/password-check");
        } else {
            navigate("/mypage/member/edit");
        }
    };

    const handleLogout = () => {
        const ok = window.confirm("로그아웃 하시겠습니까?");
        if (!ok) return;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch(logout());
        dispatch(resetLeagueCreation());
        dispatch(baseApi.util.resetApiState());
        navigate("/", { replace: true });
    };

    return (
        <Box sx={{ mx: -2, mt: -2, minHeight: "100%", bgcolor: "#ffffff", px: 2, pt: 2, pb: 4 }}>
            {/* 프로필 카드 */}
            {token ? (
                <Card elevation={0} sx={{ borderRadius: 1.5, mb: 2, p: 2.5, bgcolor: "#F5F5F5" }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box flex={1}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                <Typography fontWeight={900} fontSize={18}>{displayName} 님</Typography>
                                {roleLabel && (
                                    <Chip
                                        label={roleLabel}
                                        size="small"
                                        sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: "#EEF2FF", color: "#4F46E5" }}
                                    />
                                )}
                            </Stack>
                            <Typography fontSize={13} color="text.secondary">
                                반가워요! 오늘도 우리리그를 즐겨보세요.
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleEditClick}
                            sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, px: 1.5, py: 0.5, whiteSpace: "nowrap" }}
                        >
                            정보수정
                        </Button>
                    </Stack>
                </Card>
            ) : (
                <Card elevation={0} sx={{ borderRadius: 1.5, mb: 2, p: 2.5, bgcolor: "#F5F5F5" }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <PersonOutlineIcon sx={{ color: "#9CA3AF", fontSize: 26 }} />
                        </Box>
                        <Box flex={1}>
                            <Typography fontWeight={700} fontSize={15} color="text.secondary">로그인 후 이용하세요</Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            onClick={() => navigate("/login")}
                            sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, px: 1.5, whiteSpace: "nowrap" }}
                        >
                            로그인
                        </Button>
                    </Stack>
                </Card>
            )}

            {/* COMMUNITY */}
            <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 1, letterSpacing: 1 }}>
                COMMUNITY
            </Typography>
            <Card elevation={0} sx={{ borderRadius: 1.5, mb: 2, overflow: "hidden", bgcolor: "#F5F5F5" }}>
                <List disablePadding>
                    {COMMUNITY_ITEMS.map((item, idx) => (
                        <Box key={item.to}>
                            {idx > 0 && <Divider />}
                            <ListItemButton onClick={() => navigate(item.to)} sx={{ py: 1.5, px: 2 }}>
                                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography fontWeight={700} fontSize={15}>{item.label}</Typography>}
                                />
<ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
                            </ListItemButton>
                        </Box>
                    ))}
                </List>
            </Card>

            {/* SUPPORT */}
            <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 1, letterSpacing: 1 }}>
                SERVICE
            </Typography>
            <Card elevation={0} sx={{ borderRadius: 1.5, mb: 2, overflow: "hidden", bgcolor: "#F5F5F5" }}>
                <List disablePadding>
                    {SUPPORT_ITEMS.map((item, idx) => (
                        <Box key={item.to}>
                            {idx > 0 && <Divider />}
                            <ListItemButton onClick={() => navigate(item.to)} sx={{ py: 1.5, px: 2 }}>
                                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography fontWeight={700} fontSize={15}>{item.label}</Typography>}
                                />
                                <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
                            </ListItemButton>
                        </Box>
                    ))}
                </List>
            </Card>

            {/* POLICIES */}
            <Typography fontSize={11} fontWeight={700} color="text.disabled" sx={{ mb: 1, letterSpacing: 1 }}>
                POLICIES
            </Typography>
            <Card elevation={0} sx={{ borderRadius: 1.5, mb: 2, overflow: "hidden", bgcolor: "#F5F5F5" }}>
                <List disablePadding>
                    {POLICY_ITEMS.map((item, idx) => (
                        <Box key={item.to}>
                            {idx > 0 && <Divider />}
                            <ListItemButton onClick={() => navigate(item.to)} sx={{ py: 1.5, px: 2 }}>
                                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography fontWeight={700} fontSize={15}>{item.label}</Typography>}
                                />
                                <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
                            </ListItemButton>
                        </Box>
                    ))}
                </List>
            </Card>

            {/* 로그아웃 */}
            {token && (
                <Typography
                    onClick={handleLogout}
                    sx={{ fontSize: 14, color: "text.disabled", cursor: "pointer", py: 1, display: "inline-block", "&:hover": { color: "text.secondary" } }}
                >
                    로그아웃
                </Typography>
            )}

        </Box>
    );
}
