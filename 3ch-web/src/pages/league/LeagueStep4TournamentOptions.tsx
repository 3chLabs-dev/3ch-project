import React, { useState } from "react";
import {
    Box, Typography, Button, Stack, Select, MenuItem, FormControl,
    InputLabel, Divider,
} from "@mui/material";
import { setStep, setStep4TournamentOptions } from "../../features/league/leagueCreationSlice";
import type { TournamentSeedingValue, TournamentAdvancementValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const seedingOptions: { value: TournamentSeedingValue; label: string; desc: string }[] = [
    { value: "manual", label: "수동", desc: "관리자가 참가자를 직접 대진에 배치합니다." },
    { value: "seed", label: "시드", desc: "부수 순으로 시드를 정해 자동 배치합니다. (1부-1, 2부-1, 3부-1, 1부-2…)" },
    { value: "group", label: "조별", desc: "각 부수(조) 1위는 다른 부수 2위와 대전. 같은 조끼리는 1라운드에서 만나지 않습니다." },
    { value: "random", label: "랜덤", desc: "무작위로 배치합니다." },
];

const advancementOptions: { value: TournamentAdvancementValue; label: string; desc: string }[] = [
    { value: "upper-only", label: "상위만", desc: "1회전 승자는 상위 진출, 패자는 바로 탈락합니다." },
    { value: "upper-lower", label: "상·하위", desc: "1회전 승자는 상위 토너먼트로, 패자는 하위 토너먼트로 진출합니다." },
];

const LeagueStep4TournamentOptions: React.FC = () => {
    const dispatch = useAppDispatch();
    const existing = useAppSelector((s) => s.leagueCreation.step4TournamentOptions);

    const [seeding, setSeeding] = useState<TournamentSeedingValue>(existing?.seeding ?? "seed");
    const [advancement, setAdvancement] = useState<TournamentAdvancementValue>(existing?.advancement ?? "upper-lower");

    const handleNext = () => {
        dispatch(setStep4TournamentOptions({ seeding, advancement }));
        dispatch(setStep(5));
    };

    const handlePrev = () => {
        dispatch(setStep(4));
    };

    const selectedSeedingDesc = seedingOptions.find((o) => o.value === seeding)?.desc ?? "";
    const selectedAdvancementDesc = advancementOptions.find((o) => o.value === advancement)?.desc ?? "";

    return (
        <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
            <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 3 }}>
                리그 옵션
            </Typography>

            <Stack spacing={3}>
                {/* 편성 방식 */}
                <Box>
                    <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>
                        편성 방식
                    </Typography>
                    <FormControl fullWidth size="small">
                        <InputLabel>편성 방식</InputLabel>
                        <Select
                            value={seeding}
                            label="편성 방식"
                            onChange={(e) => setSeeding(e.target.value as TournamentSeedingValue)}
                        >
                            {seedingOptions.map((o) => (
                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedSeedingDesc && (
                        <Typography fontSize={12} color="text.secondary" mt={0.8}>
                            {selectedSeedingDesc}
                        </Typography>
                    )}
                </Box>

                <Divider />

                {/* 다음 진출 방식 */}
                <Box>
                    <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>
                        다음 진출 방식
                    </Typography>
                    <FormControl fullWidth size="small">
                        <InputLabel>진출 방식</InputLabel>
                        <Select
                            value={advancement}
                            label="진출 방식"
                            onChange={(e) => setAdvancement(e.target.value as TournamentAdvancementValue)}
                        >
                            {advancementOptions.map((o) => (
                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedAdvancementDesc && (
                        <Typography fontSize={12} color="text.secondary" mt={0.8}>
                            {selectedAdvancementDesc}
                        </Typography>
                    )}
                </Box>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handlePrev}
                    disableElevation
                    sx={{
                        borderRadius: 1, height: 44, fontWeight: 900,
                        bgcolor: "#777777", "&:hover": { bgcolor: "#777777" },
                    }}
                >
                    이전
                </Button>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleNext}
                    disableElevation
                    sx={{
                        borderRadius: 1, height: 44, fontWeight: 900,
                        bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" },
                    }}
                >
                    완료
                </Button>
            </Stack>
        </Box>
    );
};

export default LeagueStep4TournamentOptions;
