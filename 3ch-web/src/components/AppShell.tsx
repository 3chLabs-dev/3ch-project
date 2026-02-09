import { Outlet } from "react-router-dom";
import { AppBar, Box, Toolbar, Typography, Paper } from "@mui/material";
import BottomTab from "./BottomTab";

const HEADER_H = 56;
const TAB_H = 56; // BottomNavigation 기본 높이(대략). 필요하면 64로 올려도 됨.

export default function AppShell() {
    return (
        <Box
            sx={{
                height: "100dvh",
                minHeight: "100vh",
                bgcolor: "background.default",
                overflow: "hidden",
            }}
        >
            {/* 모바일 뷰포트 */}
            <Paper
                elevation={0}
                sx={{
                    maxWidth: 430,
                    mx: "auto",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderLeft: "1px solid",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    overflow: "hidden",
                }}
            >
                {/* 헤더 */}
                <AppBar
                    position="sticky"
                    color="inherit"
                    elevation={0}
                    sx={{ borderBottom: 1, borderColor: "divider" }}
                >
                    <Toolbar sx={{ minHeight: HEADER_H }}>
                        <Typography fontWeight={900}>우리리그 로고</Typography>
                    </Toolbar>
                </AppBar>

                {/* 스크롤 컨텐츠: 여기만 스크롤 */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        overflowX: "hidden",
                        WebkitOverflowScrolling: "touch",
                        p: 2,

                        pb: `calc(${TAB_H}px + env(safe-area-inset-bottom))`,
                    }}
                >
                    <Outlet />
                </Box>

                {/* 하단 탭: 항상 아래에 고정 */}
                <Box
                    sx={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 1200,
                        borderTop: 1,
                        borderColor: "divider",
                        bgcolor: "background.paper",

                        pb: "env(safe-area-inset-bottom)",

                        flexShrink: 0,
                    }}
                >
                    <BottomTab />
                </Box>
            </Paper>
        </Box>
    );
}
