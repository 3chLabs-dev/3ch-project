import { useEffect } from "react";
import { Box, Typography, LinearProgress } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, createLeague } from "../../features/league/leagueCreationSlice";

export default function LeagueStep6Creating() {
    const dispatch = useAppDispatch();
    const status = useAppSelector((s) => s.leagueCreation.createStatus);

    useEffect(() => {
        if (status === "idle") {
            dispatch(createLeague());
        }
    }, [status, dispatch]);

    useEffect(() => {
        if (status === "succeeded") dispatch(setStep(7));
    }, [status, dispatch]);

    return (
        <Box
            sx={{
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: "3px solid #111827",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                    "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                    },
                }}
            />

            <Typography sx={{ fontWeight: 900, letterSpacing: 1 }}>
                UPDATING
            </Typography>

            <Box sx={{ width: 240 }}>
                <LinearProgress
                    variant="indeterminate"
                    sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: "#E5E7EB",
                        "& .MuiLinearProgress-bar": { borderRadius: 999 },
                    }}
                />
            </Box>

            {status === "failed" && (
                <Typography sx={{ color: "error.main", fontWeight: 900 }}>
                    생성 실패. 다시 시도하세요.
                </Typography>
            )}
        </Box>
    );
}
