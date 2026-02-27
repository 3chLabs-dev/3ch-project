// AppShell.tsx
import { Link, Outlet } from "react-router-dom";
import { AppBar, Box, Toolbar, Paper } from "@mui/material";
import BottomTab from "./BottomTab";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setToken, setUser } from "../features/auth/authSlice";
import logo from "../assets/512_우리리그 로고.svg";

const TAB_H = 56;

export default function AppShell() {
    const dispatch = useDispatch();

    useEffect(() => {
        const token = localStorage.getItem("token");
        const userStr = localStorage.getItem("user");

        if (token) dispatch(setToken(token));
        if (userStr) dispatch(setUser(JSON.parse(userStr)));
    }, [dispatch]);
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
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                textDecoration: 'none'
                            }}
                        >
                            <img
                                src={logo}
                                alt="우리리그"
                                style={{ height: 32 }}
                            />
                        </Box>
                    </Toolbar>
                </AppBar>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        p: 2,
                        // pb: `calc(${TAB_H}px + env(safe-area-inset-bottom))`,
                        pd: `${TAB_H}px`,
                    }}
                >
                    <Outlet />
                </Box>

                <BottomTab />
            </Paper>
        </Box>
    );
}
