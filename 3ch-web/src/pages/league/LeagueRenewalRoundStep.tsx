import { Box, Button, FormControl, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { setRenewalRounds, setRenewalStep } from "../../features/league/leagueRenewalCreationSlice";
import type { RenewalRoundConfig } from "../../features/league/leagueRenewalCreationSlice";

type StepKind = "type" | "format" | "rule";
const labels = { type: "유형", format: "방식", rule: "규칙" } as const;
const previousSteps = { type: 2, format: 4, rule: 5 } as const;
const nextSteps = { type: 5, format: 6, rule: 7 } as const;
const optionCardSx = {
  m: 0,
  px: 2,
  minHeight: 66,
  border: "1px solid #D9DDE6",
  borderRadius: 1,
  bgcolor: "#fff",
  boxShadow: "0 2px 2px rgba(0,0,0,0.18)",
  "& .MuiFormControlLabel-label": { fontSize: 20, fontWeight: 800 },
};

const newRound = (id: number): RenewalRoundConfig => ({ id, expanded: true, program: null, format: null, option: null, matchRule: null, teamPlayerCount: null, teamMatchType: null, tournamentSeeding: "seed", tournamentBracketCount: 1 });

export default function LeagueRenewalRoundStep({ kind }: { kind: StepKind }) {
  const dispatch = useAppDispatch();
  const rounds = useAppSelector((state) => state.leagueRenewalCreation.rounds);
  const updateRound = (index: number, patch: Partial<RenewalRoundConfig>) => dispatch(setRenewalRounds(rounds.map((round, roundIndex) => roundIndex === index ? { ...round, ...patch } : round)));
  const removeRound = (index: number) => dispatch(setRenewalRounds(rounds.filter((_, roundIndex) => roundIndex !== index).map((round, roundIndex) => ({ ...round, id: roundIndex + 1 }))));
  const canNext = rounds.every((round) => {
    if (kind === "type") return Boolean(round.program) && (round.program !== "TEAM" || Boolean(round.teamPlayerCount));
    if (kind === "format") return Boolean(round.format);
    return Boolean(round.matchRule);
  });

  const renderOptions = (round: RenewalRoundConfig, index: number) => {
    if (kind === "type") return <>
      <FormControl fullWidth><RadioGroup value={round.program ?? ""} onChange={(event) => updateRound(index, { program: event.target.value as NonNullable<RenewalRoundConfig["program"]> })}><Stack spacing={1.5}><FormControlLabel value="SINGLES" control={<Radio />} label="단식" sx={optionCardSx} /><FormControlLabel value="DOUBLES" control={<Radio />} label="복식" sx={optionCardSx} /><FormControlLabel value="TEAM" control={<Radio />} label="단체전" sx={optionCardSx} /></Stack></RadioGroup></FormControl>
      {round.program === "TEAM" && <Box sx={{ mt: 2 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>팀 인원 수</Typography><TextField select fullWidth value={round.teamPlayerCount ?? ""} onChange={(event) => updateRound(index, { teamPlayerCount: Number(event.target.value) })} size="small" SelectProps={{ displayEmpty: true, renderValue: (value) => value === "" ? <Box component="span" sx={{ color: "#B0B7C3" }}>선택</Box> : `${value}명` }}><MenuItem value="" disabled>선택</MenuItem>{[2, 3, 4, 5].map((count) => <MenuItem key={count} value={count}>{count}명</MenuItem>)}</TextField></Box>}
    </>;
    if (kind === "format") return <>
      <FormControl fullWidth><RadioGroup value={round.format ?? ""} onChange={(event) => updateRound(index, { format: event.target.value as NonNullable<RenewalRoundConfig["format"]>, tournamentSeeding: "seed", tournamentBracketCount: event.target.value === "TOURNAMENT" ? round.tournamentBracketCount ?? 1 : 1 })}><Stack spacing={1.5}><FormControlLabel value="LEAGUE" control={<Radio />} label="단일리그" sx={optionCardSx} /><FormControlLabel value="GROUP" control={<Radio />} label="조별리그" sx={optionCardSx} /><FormControlLabel value="TOURNAMENT" control={<Radio />} label="토너먼트" sx={optionCardSx} /></Stack></RadioGroup></FormControl>
      <Box sx={{ mt: 2 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography><TextField select fullWidth value={round.option ?? ""} onChange={(event) => updateRound(index, { option: event.target.value as NonNullable<RenewalRoundConfig["option"]> })} size="small" SelectProps={{ displayEmpty: true, renderValue: (value) => value === "" ? <Box component="span" sx={{ color: "#B0B7C3" }}>선택</Box> : ({ PRELIM: "예선", FINAL: "본선", UPPER: "상위", LOWER: "하위" }[String(value)] ?? String(value)) }}><MenuItem value="" disabled>선택</MenuItem><MenuItem value="PRELIM">예선</MenuItem><MenuItem value="FINAL">본선</MenuItem><MenuItem value="UPPER">상위</MenuItem><MenuItem value="LOWER">하위</MenuItem></TextField></Box>
      {round.format === "TOURNAMENT" && round.option === "FINAL" && index > 0 && rounds[index - 1]?.format === "GROUP" && rounds[index - 1]?.option === "PRELIM" && <Box sx={{ mt: 2 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>대진표 개수</Typography><TextField select fullWidth value={round.tournamentBracketCount ?? 1} onChange={(event) => updateRound(index, { tournamentBracketCount: Number(event.target.value) })} size="small">{Array.from({ length: 8 }, (_, optionIndex) => optionIndex + 1).map((count) => <MenuItem key={count} value={count}>{count}개</MenuItem>)}</TextField></Box>}
    </>;
    return <FormControl fullWidth><RadioGroup value={round.matchRule ?? ""} onChange={(event) => updateRound(index, { matchRule: event.target.value as NonNullable<RenewalRoundConfig["matchRule"]> })}><Stack spacing={1.5}><FormControlLabel value="BEST_OF_3" control={<Radio />} label="3전 2선승제" sx={optionCardSx} /><FormControlLabel value="BEST_OF_5" control={<Radio />} label="5전 3선승제" sx={optionCardSx} /><FormControlLabel value="THREE_SET" control={<Radio />} label="3세트제" sx={optionCardSx} /></Stack></RadioGroup></FormControl>;
  };

  return <Box sx={{ px: 2.5, pt: 2 }}>
    <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 {labels[kind]}</Typography>
    <Stack spacing={3}>{rounds.map((round, index) => <Box key={round.id}><Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}><Typography sx={{ fontSize: 20, fontWeight: 900 }}>{index + 1}라운드</Typography>{kind === "type" && rounds.length > 1 && <Button size="small" color="error" variant="outlined" onClick={() => removeRound(index)}>삭제</Button>}</Stack>{renderOptions(round, index)}</Box>)}</Stack>
    {kind === "type" && <Button fullWidth variant="outlined" onClick={() => dispatch(setRenewalRounds([...rounds, newRound(rounds.length + 1)]))} sx={{ mt: 2.5, height: 40, borderRadius: 1, fontWeight: 800 }}>+ 라운드 추가</Button>}
    <Stack direction="row" spacing={2} sx={{ mt: 4 }}><Button fullWidth variant="contained" disableElevation onClick={() => dispatch(setRenewalStep(previousSteps[kind]))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}>이전</Button><Button fullWidth variant="contained" disableElevation disabled={!canNext} onClick={() => dispatch(setRenewalStep(nextSteps[kind]))} sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" }, "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" } }}>다음</Button></Stack>
  </Box>;
}
