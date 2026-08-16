// AppShell.tsx
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    AppBar, Box, Toolbar, Paper, Select, MenuItem, IconButton, Stack, Button,
    Dialog, DialogTitle, DialogContent, DialogActions, Divider, Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import BottomTab from "./BottomTab";
import AppFooter from "./AppFooter";
import SupportChat from "./SupportChat";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../app/store";
import { setToken, setUser } from "../features/auth/authSlice";
import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery, useUpdateMyGroupPreferencesMutation } from "../features/group/groupApi";
import { useGetMyFeatureUsageQuery } from "../features/payment/usageApi";
import { getLocalDevProfileByToken } from "../utils/localDevAuth";
import logo from "../assets/512_우리리그 로고.svg";
import SettingsIcon from "@mui/icons-material/Settings";
import homeHeaderBg from "../assets/메인 배너_900x700_버튼X.png"
import ClubSelectionDialog from "./ClubSelectionDialog";
// import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

const APP_BAR_H = 56;

export default function AppShell() {
    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();
    const token = useSelector((s: RootState) => s.auth.token);
    const preferredGroupId = useSelector((s: RootState) => s.leagueCreation.preferredGroupId);
    const currentStep = useSelector((s: RootState) => s.leagueCreation.currentStep);
    const isHome = location.pathname === "/";
    const isMyPage = location.pathname === "/mypage";
    const isLeagueSheet = /^\/league\/[^/]+\/(omr|openai-vision|gpt-vision)$/.test(location.pathname);

    const contentRef = useRef<HTMLDivElement>(null);
    const bannerRef = useRef<HTMLDivElement>(null);
    const [showHomeBar, setShowHomeBar] = useState(false);
    const [usageOpen, setUsageOpen] = useState(false);
    const [clubSelectionOpen, setClubSelectionOpen] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");
        if (stored) dispatch(setToken(stored));
        if (userStr) dispatch(setUser(JSON.parse(userStr)));
    }, [dispatch]);

    const { data: groupData } = useGetMyGroupsQuery(undefined, {
        skip: !token,
        refetchOnMountOrArgChange: true,
    });
    const { data: usageData, refetch: refetchUsage } = useGetMyFeatureUsageQuery(undefined, {
        skip: !token,
        refetchOnMountOrArgChange: true,
    });
    const [updateGroupPreferences, { isLoading: isSavingGroupPreferences }] = useUpdateMyGroupPreferencesMutation();
    useEffect(() => {
        if (usageOpen && token) void refetchUsage();
    }, [refetchUsage, token, usageOpen]);
    const usageItems = [
        { label: "리그 생성", balance: usageData?.usage.league_create },
        { label: "사진 인식", balance: usageData?.usage.vision_scan },
        { label: "추첨 생성", balance: usageData?.usage.draw_create },
    ];
    const nearestUsageExpiry = usageItems
        .map(({ balance }) => balance?.expiresAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    const groups = useMemo(() => {
        const serverGroups = groupData?.groups ?? [];
        if (serverGroups.length > 0) return serverGroups;
        const localProfile = getLocalDevProfileByToken(token);
        return localProfile ? [localProfile.group] : [];
    }, [groupData, token]);
    const effectiveGroupId = (preferredGroupId && groups.some((g) => g.id === preferredGroupId))
        ? preferredGroupId
        : groups.find((g) => g.is_primary)?.id ?? groups[0]?.id ?? "";

    useEffect(() => {
        const primaryGroupId = groups.find((group) => group.is_primary)?.id;
        if (primaryGroupId && !preferredGroupId) dispatch(setPreferredGroupId(primaryGroupId));
    }, [dispatch, groups, preferredGroupId]);

    // 홈에서만 스크롤 감지 — 배너가 완전히 사라진 시점에 AppBar 등장
    // bannerRef로 실제 높이를 측정해 임계값 사용 → 화면 크기 무관하게 정확히 동작
    useEffect(() => {
        if (!isHome) return;

        const el = contentRef.current;
        if (!el) return;

        const handleScroll = () => {
            const bannerH = bannerRef.current?.offsetHeight ?? 0;
            setShowHomeBar(el.scrollTop >= bannerH - APP_BAR_H);
        };
        handleScroll(); // navigate 후 초기 상태 동기화 (scrollTop=0 → false로 리셋)
        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleScroll);
    }, [isHome]);

    const scrollToTop = () => {
        contentRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
        });
    };

    // 비홈: 항상 보임 / 홈: 스크롤 후에만 보임
    const appBarVisible = !isHome || showHomeBar;

    return (
        <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
            <Paper
                elevation={0}
                sx={{
                    position: "relative",          // absolute AppBar의 기준점
                    maxWidth: isLeagueSheet ? 980 : 430,
                    mx: "auto",
                    height: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    borderLeft: isLeagueSheet ? 0 : "1px solid",
                    borderRight: isLeagueSheet ? 0 : "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    overflow: "hidden",
                    borderRadius: 0,
                }}
            >
                {/* AppBar: position absolute → flex 레이아웃에 영향 없음 = layout shift 없음
                     홈:   opacity 전환으로 부드럽게 등장/사라짐
                     비홈: 항상 보임 (transition 없이 즉시) */}
                <AppBar
                    position="absolute"
                    color="inherit"
                    elevation={0}
                    sx={{
                        left: 0,
                        right: 0,
                        borderBottom: 1,
                        borderColor: "divider",
                        opacity: appBarVisible ? 1 : 0,
                        pointerEvents: appBarVisible ? "auto" : "none",
                        transition: isHome ? "opacity 0.25s ease" : "none",
                    }}
                >
                    <Toolbar sx={{ minHeight: APP_BAR_H }}>
                        <Box
                            component={Link}
                            to="/"
                            sx={{ display: "flex", alignItems: "center", textDecoration: "none" }}
                        >
                            <img src={logo} alt="우리리그" style={{ height: 32 }} />
                        </Box>

                        {/* 클럽 셀렉트 — 리그·대회 및 추첨 메인에서 표시 */}
                        {token && groups.length > 1 && (
                            (location.pathname === "/league" && currentStep === 0)
                            || location.pathname === "/draw"
                        ) && (
                            <Select
                                value={effectiveGroupId}
                                onChange={(e: SelectChangeEvent<string>) => {
                                    if (e.target.value === "__club_selection__") {
                                        setClubSelectionOpen(true);
                                        return;
                                    }
                                    dispatch(setPreferredGroupId(e.target.value || null));
                                }}
                                size="small"
                                sx={{
                                    ml: "auto",
                                    borderRadius: 1,
                                    height: 30,
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    bgcolor: "#EEF2FF",
                                    "& .MuiSelect-select": { py: 0.25, px: 1.2 },
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#C7D2FE" },
                                }}
                            >
                                {groups.map((g) => (
                                    <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                                ))}
                                <Divider />
                                <MenuItem value="__club_selection__" sx={{ fontWeight: 800, color: "primary.main" }}>
                                    클럽 선택
                                </MenuItem>
                            </Select>
                        )}
                        {isMyPage && token && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: "auto" }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setUsageOpen(true)}
                                    sx={{
                                        minWidth: 0,
                                        borderRadius: 1.5,
                                        px: 1.2,
                                        fontSize: 12,
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    남은 사용량
                                </Button>
                                {/* 앱 출시후 구현 임시주석 */}
                                {/* <IconButton aria-label="notifications" size="small">
                                    <NotificationsNoneIcon sx={{ fontSize: 28 }} />
                                </IconButton> */}
                                <IconButton
                                    aria-label="settings"
                                    onClick={() => navigate("/mypage/settings")}
                                    size="small"
                                >
                                    <SettingsIcon sx={{ fontSize: 28 }} />
                                </IconButton>
                            </Stack>
                        )}
                        { !token && isHome && (
                            <Stack direction="row" sx={{ ml: "auto" }}>
                            <Button
                            variant="contained"
                            disableElevation
                            onClick={() => navigate("/login")}
                            sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 14, px: 1.5, whiteSpace: "nowrap" ,width: 85,}}
                        >
                            로그인
                        </Button>
                            </Stack>
                        )}  
                    </Toolbar>
                </AppBar>

                <ClubSelectionDialog
                    open={clubSelectionOpen}
                    groups={groups}
                    saving={isSavingGroupPreferences}
                    onClose={() => setClubSelectionOpen(false)}
                    onSave={async (orderedGroupIds, primaryGroupId) => {
                        await updateGroupPreferences({ orderedGroupIds, primaryGroupId }).unwrap();
                        dispatch(setPreferredGroupId(primaryGroupId));
                        setClubSelectionOpen(false);
                    }}
                />

                {/* 스크롤 컨테이너
                     비홈: AppBar가 absolute이므로 paddingTop으로 콘텐츠 시작 위치 보정
                     홈:   배너가 최상단부터 시작, AppBar는 투명하게 overlay */}
                <Box
                    ref={contentRef}
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        pt: isHome || isLeagueSheet ? 0 : `${APP_BAR_H}px`,
                    }}
                >
                    {isHome && (
                        <Box
                            ref={bannerRef}
                            // onClick={() => navigate(token ? "/league" : "/signin")}
                            sx={{
                                position: "relative",
                                aspectRatio: "3 / 2",
                                // backgroundColor: "#0e0e49",
                                backgroundImage: `url(${homeHeaderBg})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                            }}
                        >
                            {/* <Box
                                component={Link}
                                to="/"
                                sx={{
                                    position: "absolute",
                                    // top: 15.75,
                                    // left: 23.75,
                                    top: "4%",
                                    left: "6%",
                                    display: "flex",
                                    alignItems: "center",
                                    textDecoration: "none",
                                }}
                            >
                                <img src={homeLogo} alt="우리리그" style={{ height: 20 }} />
                            </Box> */}

                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "45%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    textAlign: "center",
                                    color: "#fff",
                                    width: "78%",
                                }}
                            >
                                {/* <Box sx={{ fontSize: 13, fontWeight: 700, mb: 0.3 }}>
                                    우리의 리그가 시작되는 곳
                                </Box>
                                <Box sx={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, mb: 0.8 }}>
                                    우리리그
                                </Box>
                                <Box sx={{ fontSize: 11, fontWeight: 500, lineHeight: 1.35 }}>
                                    자동화된 시스템으로 리그·대회를 쉽고 빠르게 만들고
                                    <br />
                                    모든 경기를 한눈에 관리하세요.
                                </Box> */}
                            </Box>

                            <Box
                                onClick={() => navigate(token ? "/league" : "/login")}
                                sx={{
                                    position: "absolute",
                                    left: "50%",
                                    bottom: 24,
                                    transform: "translateX(-50%)",
                                    px: 4.8,
                                    py: 1.3,
                                    borderRadius: 9999,
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.30)",
                                    bgcolor: "#D9D9D9",
                                    color: "#1464d2",
                                    fontSize: 20,
                                    fontWeight: 500,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                지금 시작하기
                            </Box>
                        </Box>
                    )}

                    <Box sx={{ p: isLeagueSheet ? 0 : 2, pb: isLeagueSheet ? 0 : `calc(8px + env(safe-area-inset-bottom))` }}>
                        <Outlet context={{ scrollToTop }} />
                        {!isLeagueSheet && <AppFooter />}
                    </Box>
                </Box>

                {!isLeagueSheet && <SupportChat />}
                {!isLeagueSheet && <BottomTab />}

                <Dialog
                    open={usageOpen}
                    onClose={() => setUsageOpen(false)}
                    fullWidth
                    maxWidth="xs"
                    PaperProps={{ sx: { borderRadius: 2 } }}
                >
                    <DialogTitle sx={{ fontWeight: 900, fontSize: 20 }}>남은 사용량</DialogTitle>
                    <Divider />
                    <DialogContent sx={{ pt: 2.5 }}>
                        <Stack spacing={1.25}>
                            {usageItems.map(({ label, balance }) => (
                                <Stack
                                    key={label}
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ px: 1.5, py: 1.4, bgcolor: "#F8FAFC", borderRadius: 1.5 }}
                                >
                                    <Typography fontSize={14} fontWeight={700}>{label}</Typography>
                                    <Typography fontSize={17} fontWeight={900} color="primary.main">
                                        {balance?.unlimited ? "무제한" : `${balance?.remaining ?? 0}회`}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                        {nearestUsageExpiry && (
                            <Typography fontSize={12} color="text.secondary" sx={{ mt: 1.5 }}>
                                이용기한: {new Date(nearestUsageExpiry).toLocaleDateString("ko-KR")}까지
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ px: 2.5, pb: 2 }}>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => {
                                setUsageOpen(false);
                                navigate("/mypage/pricing#token-packages");
                            }}
                            sx={{ fontWeight: 800, bgcolor: "#7C3AED", "&:hover": { bgcolor: "#6D28D9" } }}
                        >
                            추가 사용량 구매
                        </Button>
                        <Button
                            onClick={() => {
                                setUsageOpen(false);
                                navigate("/mypage/pricing");
                            }}
                            sx={{ fontWeight: 800 }}
                        >
                            요금제 보기
                        </Button>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => setUsageOpen(false)}
                            sx={{ fontWeight: 800 }}
                        >
                            닫기
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Box>
    );
}
