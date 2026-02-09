// AppShell.tsx
import { Outlet } from "react-router-dom";
import { AppBar, Box, Toolbar, Typography, Paper } from "@mui/material";
import BottomTab from "./BottomTab";

const TAB_H = 56;

export default function AppShell() {
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
                }}
            >
                <AppBar
                    position="sticky"
                    color="inherit"
                    elevation={0}
                    sx={{ borderBottom: 1, borderColor: "divider" }}
                >
                    <Toolbar sx={{ minHeight: 56 }}>
                        <Typography fontWeight={900}>우리리그 로고</Typography>
                    </Toolbar>
                </AppBar>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        p: 2,
                        pb: `calc(${TAB_H}px + env(safe-area-inset-bottom))`,
                    }}
                >
                    <Outlet />
                </Box>

                <BottomTab />
            </Paper>
        </Box>
    );
}
