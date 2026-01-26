import { Outlet } from "react-router-dom";
import { AppBar, Box, Toolbar, Typography, Paper } from "@mui/material";
import BottomTab from "./BottomTab";

export default function AppShell() {
    return (
        <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
            {/* 모바일 뷰포트 */}
            <Paper
                elevation={0}
                sx={{
                    maxWidth: 430,
                    mx: "auto",
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    borderLeft: "1px solid",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}
            >
                {/* 헤더 */}
                <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Toolbar sx={{ minHeight: 56 }}>
                        <Typography fontWeight={900}>우리리그 로고</Typography>
                    </Toolbar>
                </AppBar>

                {/* 스크롤 컨텐츠 */}
                <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                    <Outlet />
                </Box>

                {/* 하단 탭 */}
                <BottomTab />
            </Paper>
        </Box>
    );
}
