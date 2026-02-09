import React, { useMemo } from "react";
import { Typography, Button, Card, CardContent, Stack } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setStep, resetLeagueCreation } from "../../features/league/leagueCreationSlice";

function formatKoreanDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${dateStr}(${dow})`;
}

function SoftCard({ children }: { children: React.ReactNode }) {
    return (
        <Card
            elevation={2}
            sx={{
                borderRadius: 1,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
        >
            <CardContent sx={{ p: 3 }}>{children}</CardContent>
        </Card>
    );
}

export default function LeagueStep6Schedule() {
    const dispatch = useAppDispatch();

    const gameEntries = useAppSelector((s) => s.leagueCreation.step6Schedule?.gameEntries);

    const top = useMemo(() => {
        const entries = gameEntries ?? [];
        return entries[0];
    }, [gameEntries]);

    const handleEnter = () => {
        alert("입장하기(상세 화면/leagueId 연결 전)");
    };

    const handleCreateNew = () => {
        dispatch(resetLeagueCreation());
        dispatch(setStep(0));
    };

    const handlePrev = () => {
        dispatch(setStep(5));
    };

    return (
        <Stack spacing={2.0}>
            <Typography sx={{ fontSize: 20, fontWeight: 900 }}>리그 일정</Typography>

            <SoftCard>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontWeight: 900 }}>
                        {top ? formatKoreanDate(top.date) : "등록된 일정이 없습니다."}
                    </Typography>

                    <Button
                        variant="contained"
                        disableElevation
                        onClick={handleEnter}
                        disabled={!top}
                        sx={{
                            borderRadius: 1,
                            height: 32,
                            fontWeight: 900,
                            bgcolor: "#E5E7EB",
                            color: "#111827",
                            "&:hover": { bgcolor: "#E5E7EB" },
                            "&.Mui-disabled": { bgcolor: "#F3F4F6", color: "#9CA3AF" },
                        }}
                    >
                        입장하기
                    </Button>
                </Stack>
            </SoftCard>

            <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={handleCreateNew}
                sx={{
                    borderRadius: 1,
                    height: 44,
                    fontWeight: 900,
                    bgcolor: "#2F80ED",
                    "&:hover": { bgcolor: "#256FD1" },
                }}
            >
                생성하기
            </Button>

            <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={handlePrev}
                sx={{
                    borderRadius: 1,
                    height: 44,
                    fontWeight: 900,
                    bgcolor: "#777777",
                    "&:hover": { bgcolor: "#777777" },
                }}
            >
                이전
            </Button>
        </Stack>
    );
}
