import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import CasinoIcon from "@mui/icons-material/Casino";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useAppDispatch } from "../app/hooks";
import { resetLeagueCreation, setStep } from "../features/league/leagueCreationSlice";

const TAB_H = 56;

const tabs = [
    { label: "홈", path: "/", icon: <HomeIcon /> },
    { label: "리그·대회", path: "/league", icon: <EmojiEventsIcon /> },
    { label: "클럽", path: "/club", icon: <GroupsIcon /> },
    { label: "추첨", path: "/draw", icon: <CasinoIcon /> },
    { label: "더보기", path: "/mypage", icon: <PersonIcon /> },
];

export default function BottomTab() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const value = useMemo(() => {
        const pathname = location.pathname;

        // 정확히 일치하는 경로 찾기
        let found = tabs.findIndex((t) => t.path === pathname);

        // 못 찾았으면 시작 경로로 찾기 (/, 제외)
        if (found < 0) {
            found = tabs.findIndex((t) => t.path !== "/" && pathname.startsWith(t.path));
        }

        return found >= 0 ? found : 0;
    }, [location.pathname]);

    const handleChange = (_: unknown, newValue: number) => {
        const tab = tabs[newValue];

        if (tab.path === "/league") {
            dispatch(resetLeagueCreation());
            dispatch(setStep(0));
        }

        navigate(tab.path);
    };

    return (
        <Paper
            elevation={0}
            sx={{
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 20,
                borderTop: 1,
                borderColor: "divider",
                pb: "env(safe-area-inset-bottom)",
                backgroundColor: "background.paper",
                touchAction: "manipulation",
            }}
        >
            <BottomNavigation
                showLabels
                value={value}
                onChange={handleChange}
                sx={{
                    height: TAB_H,
                    whiteSpace: "nowrap",
                    "& .MuiBottomNavigationAction-root": { minWidth: 0, py: 0.5 },
                    "& .MuiBottomNavigationAction-label": { fontSize: 12, fontWeight: 700 },
                }}
            >
                {tabs.map((t) => (
                    <BottomNavigationAction key={t.path} label={t.label} icon={t.icon} />
                ))}
            </BottomNavigation>
        </Paper>
    );
}
