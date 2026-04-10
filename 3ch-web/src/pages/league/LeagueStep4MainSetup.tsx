import React, { useState } from "react";
import {
  Box, Typography, Button, Stack, Select, MenuItem, FormControl,
  InputLabel, Divider,
} from "@mui/material";
import { setStep, setStep4MainSetup } from "../../features/league/leagueCreationSlice";
import type { AdvanceMethodValue } from "../../features/league/leagueCreationSlice";
import { useAppDispatch, useAppSelector } from "../../app/hooks";

const ADVANCE_COUNT_OPTIONS = [4, 6, 8, 10, 12, 16, 20, 24, 32];

const ADVANCE_METHOD_OPTIONS: { value: AdvanceMethodValue; label: string; desc: string }[] = [
  { value: "rank",        label: "순위대로",  desc: "리그 최종 순위 순서대로 진출합니다." },
  { value: "top1",        label: "상위 1명",  desc: "각 부수(조)에서 1위만 진출합니다." },
  { value: "top2",        label: "상위 2명",  desc: "각 부수(조)에서 1·2위가 진출합니다." },
  { value: "upper-lower", label: "상·하위부", desc: "상위부·하위부 각각에서 진출합니다." },
];

const SEEDING_OPTIONS = [
  { value: "seed",   label: "시드",  desc: "리그 순위 기준으로 시드를 배치합니다." },
  { value: "random", label: "랜덤",  desc: "무작위로 배치합니다." },
];

const FINALS_ADVANCE_OPTIONS = [2, 3, 4];

const LeagueStep4MainSetup: React.FC = () => {
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) => s.leagueCreation.step4MainSetup);

  // 본선 규칙은 Step 4(규칙 선택)에서 이미 저장됨 — 여기서는 읽기만 함
  const tournamentRules = existing?.tournament_rules ?? "";

  const [advanceCount,  setAdvanceCount]  = useState(existing?.advance_count  ?? 8);
  const [advanceMethod, setAdvanceMethod] = useState<AdvanceMethodValue>(existing?.advance_method ?? "rank");
  const [seeding,       setSeeding]       = useState<"seed" | "random">(existing?.seeding ?? "seed");
  const [finalsAdvance, setFinalsAdvance] = useState(existing?.finals_advance ?? 2);

  const handleNext = () => {
    dispatch(setStep4MainSetup({
      tournament_rules: tournamentRules,
      advance_count: advanceCount,
      advance_method: advanceMethod,
      seeding,
      finals_advance: finalsAdvance,
    }));
    dispatch(setStep(5));
  };

  const handlePrev = () => dispatch(setStep(4));

  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: "auto" }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 0.5 }}>본선 편성</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 3 }}>
        토너먼트 단계의 설정을 구성합니다.
      </Typography>

      <Stack spacing={3}>
        {/* 진출 수 */}
        <Box>
          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>진출 수</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>진출 수</InputLabel>
            <Select value={advanceCount} label="진출 수" onChange={(e) => setAdvanceCount(Number(e.target.value))}>
              {ADVANCE_COUNT_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>{n}명</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography fontSize={12} color="text.secondary" mt={0.8}>
            리그 결과 기준으로 상위 N명이 본선 토너먼트에 진출합니다.
          </Typography>
        </Box>

        <Divider />

        {/* 진출 방식 */}
        <Box>
          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>진출 방식</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {ADVANCE_METHOD_OPTIONS.map((o) => {
              const selected = advanceMethod === o.value;
              return (
                <Box
                  key={o.value}
                  onClick={() => setAdvanceMethod(o.value)}
                  sx={{
                    flex: "1 1 calc(50% - 4px)",
                    minWidth: 0,
                    border: selected ? "2px solid #2F80ED" : "1.5px solid #E5E7EB",
                    borderRadius: 1.5, p: 1.2, cursor: "pointer",
                    bgcolor: selected ? "#EFF6FF" : "background.paper",
                    transition: "all 0.15s",
                  }}
                >
                  <Typography fontSize={13} fontWeight={700} color={selected ? "#2F80ED" : "text.primary"}>
                    {o.label}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary" mt={0.3}>{o.desc}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Divider />

        {/* 편성 방식 */}
        <Box>
          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>편성 방식</Typography>
          <Stack direction="row" spacing={1.5}>
            {SEEDING_OPTIONS.map((o) => {
              const selected = seeding === o.value;
              return (
                <Box
                  key={o.value}
                  onClick={() => setSeeding(o.value as "seed" | "random")}
                  sx={{
                    flex: 1,
                    border: selected ? "2px solid #2F80ED" : "1.5px solid #E5E7EB",
                    borderRadius: 1.5, p: 1.5, cursor: "pointer",
                    bgcolor: selected ? "#EFF6FF" : "background.paper",
                    transition: "all 0.15s",
                  }}
                >
                  <Typography fontSize={13} fontWeight={700} color={selected ? "#2F80ED" : "text.primary"}>
                    {o.label}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary" mt={0.5}>{o.desc}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Divider />

        {/* 결승 진출 */}
        <Box>
          <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>결승 진출</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>결승 진출</InputLabel>
            <Select value={finalsAdvance} label="결승 진출" onChange={(e) => setFinalsAdvance(Number(e.target.value))}>
              {FINALS_ADVANCE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>{n}명</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography fontSize={12} color="text.secondary" mt={0.8}>
            본선 토너먼트에서 결승에 진출하는 인원 수입니다.
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth variant="contained" disableElevation onClick={handlePrev}
          sx={{ borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#777777", "&:hover": { bgcolor: "#777777" } }}
        >
          이전
        </Button>
        <Button
          fullWidth variant="contained" disableElevation onClick={handleNext}
          sx={{ borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
        >
          다음
        </Button>
      </Stack>
    </Box>
  );
};

export default LeagueStep4MainSetup;
