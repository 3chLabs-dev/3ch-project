// AppShell.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { AppBar, Box, Toolbar, Paper, Select, MenuItem } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import BottomTab from "./BottomTab";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../app/store";
import { setToken, setUser } from "../features/auth/authSlice";
import { setPreferredGroupId } from "../features/league/leagueCreationSlice";
import { useGetMyGroupsQuery } from "../features/group/groupApi";
import logo from "../assets/512_우리리그 로고.svg";


export default function AppShell() {
    const dispatch = useDispatch();
    const location = useLocation();
    const token = useSelector((s: RootState) => s.auth.token);
    const preferredGroupId = useSelector((s: RootState) => s.leagueCreation.preferredGroupId);
    const currentStep = useSelector((s: RootState) => s.leagueCreation.currentStep);

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
                <AppBar
                    position="sticky"
                    color="inherit"
                    elevation={0}
                    sx={{ borderBottom: 1, borderColor: "divider" }}
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
                    </Toolbar>
                </AppBar>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        p: 2,
                        pb: `calc(8px + env(safe-area-inset-bottom))`,
                    }}
                >
                    <Outlet />
                </Box>

                <BottomTab />
            </Paper>
        </Box>
    );
}
