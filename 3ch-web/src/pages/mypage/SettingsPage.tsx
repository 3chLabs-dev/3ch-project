import {
    Box, Card, Divider, IconButton, Stack, Switch, Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import SportsOutlinedIcon from "@mui/icons-material/SportsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SettingsPage() {
    const navigate = useNavigate();

    const [showGroup, setShowGroup] = useState(false);
    const [showGame, setShowGame]   = useState(true);
    const [showWin, setShowWin]     = useState(true);

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>설정</Typography>
            </Stack>

            {/* 표시 설정 */}
            <Box>
                <Typography fontSize={12} fontWeight={700} color="text.disabled"
                    sx={{ px: 0.5, mb: 1, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    홈 화면 표시
                </Typography>
                <Card elevation={2} sx={{ borderRadius: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <SettingItem
                        icon={<GridViewOutlinedIcon sx={{ fontSize: 20, color: "#6366F1" }} />}
                        iconBg="#EEF2FF"
                        label="나의 조편성 표시"
                        desc="홈 화면에 내가 배정된 조편성 정보를 표시합니다."
                        checked={showGroup}
                        onChange={() => setShowGroup((v) => !v)}
                    />
                    <Divider />
                    <SettingItem
                        icon={<SportsOutlinedIcon sx={{ fontSize: 20, color: "#2F80ED" }} />}
                        iconBg="#EFF6FF"
                        label="나의 경기 표시"
                        desc="홈 화면에 예정된 내 경기 일정을 표시합니다."
                        checked={showGame}
                        onChange={() => setShowGame((v) => !v)}
                    />
                    <Divider />
                    <SettingItem
                        icon={<EmojiEventsOutlinedIcon sx={{ fontSize: 20, color: "#D97706" }} />}
                        iconBg="#FFFBEB"
                        label="나의 당첨내역 표시"
                        desc="홈 화면에 추첨 당첨 내역을 표시합니다."
                        checked={showWin}
                        onChange={() => setShowWin((v) => !v)}
                    />
                </Card>
            </Box>
        </Stack>
    );
}

type ItemProps = {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    desc: string;
    checked: boolean;
    onChange: () => void;
};

function SettingItem({ icon, iconBg, label, desc, checked, onChange }: ItemProps) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ px: 2.5, py: 2, cursor: "pointer", "&:hover": { bgcolor: "#F9FAFB" }, transition: "background 0.15s" }}
            onClick={onChange}
        >
            <Box sx={{
                width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
                bgcolor: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                {icon}
            </Box>
            <Box flex={1} minWidth={0}>
                <Typography fontSize={14} fontWeight={700} color="text.primary">{label}</Typography>
                <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.2 }}>{desc}</Typography>
            </Box>
            <Switch
                checked={checked}
                onChange={(e) => { e.stopPropagation(); onChange(); }}
                onClick={(e) => e.stopPropagation()}
                sx={{
                    flexShrink: 0,
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        opacity: 1,
                        backgroundColor: "#2F80ED",
                    },
                }}
            />
        </Stack>
    );
}