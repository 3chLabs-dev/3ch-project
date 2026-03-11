    // AppShell.tsx
    import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
    import { AppBar, Box, Toolbar, Paper, Select, MenuItem, IconButton, Stack } from "@mui/material";
    import type { SelectChangeEvent } from "@mui/material";
    import BottomTab from "./BottomTab";
    import AppFooter from "./AppFooter";

    import { useEffect, useMemo, useRef, useState } from "react";
    import { useDispatch, useSelector } from "react-redux";
    import type { RootState } from "../app/store";
    import { setToken, setUser } from "../features/auth/authSlice";
    import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
    import { useGetMyGroupsQuery } from "../features/group/groupApi";
    import logo from "../assets/512_우리리그 로고.svg";
    import SettingsIcon from "@mui/icons-material/Settings";
    import homeLogo from "../assets/192_화이트_우리리그.png"
    // import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";



    export default function AppShell() {
        const dispatch = useDispatch();
        const location = useLocation();
        const navigate = useNavigate();
        const token = useSelector((s: RootState) => s.auth.token);
        const preferredGroupId = useSelector((s: RootState) => s.leagueCreation.preferredGroupId);
        const currentStep = useSelector((s: RootState) => s.leagueCreation.currentStep);
        const [showCompactHomeHeader, setShowCompactHomeHeader] = useState(false);
        const contentRef = useRef<HTMLDivElement | null>(null);

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
        const groups = useMemo(() => groupData?.groups ?? [], [groupData]);
        const effectiveGroupId = (preferredGroupId && groups.some((g) => g.id === preferredGroupId))
            ? preferredGroupId
            : groups[0]?.id ?? "";

        const isHome = location.pathname === "/";
        const isMyPage = location.pathname === "/mypage";

        useEffect(() => {
            const el = contentRef.current;
            if (!el) return;

            const handleScroll = () => {
                if (!isHome) {
                    setShowCompactHomeHeader(false);
                    return;
                }

                setShowCompactHomeHeader(el.scrollTop > 140);
            };

            handleScroll();
            el.addEventListener("scroll", handleScroll);
            return () => el.removeEventListener("scroll", handleScroll);
        }, [isHome]);

        return (

            <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
                <Paper
                    elevation={0}
                    sx={{
                        maxWidth: 430,
                        mx: "auto",
                        height: "100dvh",
                        display: "flex",
                        flexDirection: "column",
                        borderLeft: "1px solid",
                        borderRight: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        overflow: "hidden",
                        borderRadius: 0,
                    }}
                >
                    {(!isHome || showCompactHomeHeader) && (
                        <AppBar
                            position="sticky"
                            color="inherit"
                            elevation={0}
                            sx={{
                                borderBottom: 1,
                                borderColor: "divider",
                                opacity: isHome ? (showCompactHomeHeader ? 1 : 0) : 1,
                                transform: isHome
                                    ? (showCompactHomeHeader ? "translateY(0)" : "translateY(-100%)")
                                    : "translateY(0)",
                                transition: "opacity 0.2s ease, transform 0.2s ease",
                                pointerEvents: isHome && !showCompactHomeHeader ? "none" : "auto",
                            }}

                        >
                            <Toolbar sx={{ minHeight: 56 }}>
                                <Box
                                    component={Link}
                                    to="/"
                                    sx={{ display: "flex", alignItems: "center", textDecoration: "none" }}
                                >
                                    <img src={logo} alt="우리리그" style={{ height: 32 }} />
                                </Box>

                                {/* 클럽 셀렉트 — 리그메인(step 0)에서만 표시 */}
                                {token && groups.length > 1 && location.pathname === "/league" && currentStep === 0 && (
                                    <Select
                                        value={effectiveGroupId}
                                        onChange={(e: SelectChangeEvent<string>) => {
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
                                    </Select>
                                )}
                                {isMyPage && token && (
                                    <Stack direction="row" sx={{ ml: "auto" }}>
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
                            </Toolbar>
                        </AppBar>
                    )}

                    <Box
                        ref={contentRef}
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            WebkitOverflowScrolling: "touch",
                            p: 2,
                            pb: `calc(8px + env(safe-area-inset-bottom))`,
                        }}
                    >
                        <Box>
                            {isHome && (
                                <Box
                                    sx={{
                                        position: "relative",
                                        mx: -2,
                                        mt: -2,
                                        mb: 2,
                                        aspectRatio: "3 / 2",
                                        backgroundColor: "#0e0e49",
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                        backgroundRepeat: "no-repeat",
                                    }}
                                >
                                    <Box
                                        component={Link}
                                        to="/"
                                        sx={{
                                            position: "absolute",
                                            top: 15.75,
                                            left: 23.75,
                                            display: "flex",
                                            alignItems: "center",
                                            textDecoration: "none",
                                        }}
                                    >
                                        <img src={homeLogo} alt="우리리그" style={{ height: 32 }} />
                                    </Box>

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
                                        <Box sx={{ fontSize: 13, fontWeight: 700, mb: 0.3 }}>
                                            우리의 리그가 시작되는 곳
                                        </Box>
                                        <Box sx={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, mb: 0.8 }}>
                                            우리리그
                                        </Box>
                                        <Box sx={{ fontSize: 11, fontWeight: 500, lineHeight: 1.35 }}>
                                            자동화된 시스템으로 리그·대회를 쉽고 빠르게 만들고
                                            <br />
                                            모든 경기를 한눈에 관리하세요.
                                        </Box>
                                    </Box>

                                    <Box
                                        onClick={() => navigate(token ? "/league" : "/signin")}
                                        sx={{
                                            position: "absolute",
                                            left: "50%",
                                            bottom: 24,
                                            transform: "translateX(-50%)",
                                            px: 3,
                                            py: 1,
                                            borderRadius: 9999,
                                            bgcolor: "#D9D9D9",
                                            color: "#1464d2",
                                            fontSize: 15,
                                            fontWeight: 900,
                                            lineHeight: 1,
                                            cursor: "pointer",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        지금 시작하기
                                    </Box>
                                </Box>
                            )}
                        </Box>
                        <Outlet />
                        <AppFooter />
                    </Box>

                    <BottomTab />
                </Paper>
            </Box>
        );
    }
