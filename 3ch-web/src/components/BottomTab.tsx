import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import PersonIcon from "@mui/icons-material/Person";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";

const tabs = [
  { label: "홈", path: "/", icon: <HomeIcon /> },
  { label: "리그", path: "/league", icon: <EmojiEventsIcon /> },
  { label: "경기", path: "/match", icon: <SportsTennisIcon /> },
  { label: "MY", path: "/my", icon: <PersonIcon /> },
];

export default function BottomTab() {
  const location = useLocation();
  const navigate = useNavigate();

  const value = useMemo(() => {
    const found = tabs.findIndex((t) => t.path === location.pathname);
    return found >= 0 ? found : 0;
  }, [location.pathname]);

  return (
    <Paper elevation={0} sx={{ borderTop: 1, borderColor: "divider" }}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_, newValue) => navigate(tabs[newValue].path)}
      >
        {tabs.map((t) => (
          <BottomNavigationAction key={t.path} label={t.label} icon={t.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
