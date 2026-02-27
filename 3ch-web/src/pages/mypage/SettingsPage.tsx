import {
    Box, Typography, IconButton, Switch, Stack,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function SettingsPage() {
    const navigate = useNavigate();

    const [showGroup, setShowGroup] = useState(false);
    const [showGame, setShowGame] = useState(true);
    const [showWin, setShowWin] = useState(true);

    return (
        <Box
            sx={{
                width: "100%",
                maxWidth: 420,
                mx: "auto",
                mt: "-4px"
            }}
        >
            {/* 헤더 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <IconButton
                    onClick={() => navigate(-1)}
                    disableRipple
                    sx={{
                        p: 0,
                        "&:hover": { background: "transparent" },
                    }}
                >
                    <ChevronLeftIcon sx={{ fontSize: 28 }} />
                </IconButton>

                <Typography sx={{ fontSize: 20, fontWeight: 900 }}>
                    설정
                </Typography>
            </Box>

            {/* 섹션 */}
            <Box sx={{ mt: 2, mx: 2 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>
                    표시
                </Typography>

                <Stack spacing={2.5}>
                    <SettingItem
                        label="나의 조편성 표시"
                        checked={showGroup}
                        onChange={() => setShowGroup(!showGroup)}
                    />

                    <SettingItem
                        label="나의 경기 표시"
                        checked={showGame}
                        onChange={() => setShowGame(!showGame)}
                    />

                    <SettingItem
                        label="나의 당첨내역 표시"
                        checked={showWin}
                        onChange={() => setShowWin(!showWin)}
                    />
                </Stack>
            </Box>
        </Box>
    );
}

type ItemProps = {
    label: string;
    checked: boolean;
    onChange: () => void;
};

function SettingItem({ label, checked, onChange }: ItemProps) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}
        >
            <Typography sx={{ fontSize: 18, fontWeight: 500 }}>
                {label}
            </Typography>

            <Switch
                checked={checked}
                onChange={onChange}
                sx={{
                    transform: "scale(1.5)",
                    mr: 1.7,
                    "& .MuiSwitch-switchBase.Mui-checked": {
                        color: "#fff",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        opacity: 1,
                        backgroundColor: "#2F80ED",
                    },
                }}
            />
        </Box>
    );
}