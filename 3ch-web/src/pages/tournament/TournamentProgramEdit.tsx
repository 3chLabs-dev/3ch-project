import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, IconButton, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTournamentQuery, useSaveTournamentProgramMutation, type TournamentFormat, type TournamentLeagueType } from "../../features/tournament/tournamentApi";

type DraftRound = { id?: string; league_type: TournamentLeagueType; format: TournamentFormat; match_rule: string };
const optionSx = { m: 0, px: 2, minHeight: 58, border: "1px solid #D9DDE6", borderRadius: 1, bgcolor: "#fff", boxShadow: "0 2px 2px rgba(0,0,0,0.12)", "& .MuiFormControlLabel-label": { fontSize: 17, fontWeight: 800 } };
const typeOptions: Array<[TournamentLeagueType, string]> = [["SINGLES", "단식"], ["DOUBLES", "복식"], ["TEAM", "단체전"]];
const formatOptions: Array<[TournamentFormat, string]> = [["LEAGUE", "풀리그"], ["GROUP", "조별리그"], ["TOURNAMENT", "토너먼트"], ["GROUP_TOURNAMENT", "조별리그 + 토너먼트"]];
const ruleOptions = [["BEST_OF_3", "3전 2선승제"], ["BEST_OF_5", "5전 3선승제"], ["THREE_SET", "3세트제"]];
export default function TournamentProgramEdit() {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useGetTournamentQuery(id, { skip: !id });
  const [saveProgram, { isLoading: saving }] = useSaveTournamentProgramMutation();
  const division = data?.tournament.divisions?.find((item) => item.id === divisionId);
  const [name, setName] = useState("");
  const [recruitCount, setRecruitCount] = useState("");
  const [rounds, setRounds] = useState<DraftRound[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (division) { setName(division.name); setRecruitCount(String(division.recruit_count ?? "")); setRounds(division.rounds.map((round) => ({ id: round.id, league_type: round.league_type, format: round.format, match_rule: String(round.rules?.match_rule ?? "BEST_OF_3") }))); } }, [division]);
  const changeRound = (index: number, patch: Partial<DraftRound>) => setRounds((current) => current.map((round, offset) => offset === index ? { ...round, ...patch } : round));
  const save = async () => {
    if (!division || !name.trim()) { setError("부문 이름을 입력해주세요."); return; }
    if (recruitCount && (!Number.isInteger(Number(recruitCount)) || Number(recruitCount) < 1)) { setError("모집 인원을 확인해주세요."); return; }
    setError("");
    try {
      await saveProgram({ id, divisionId, body: { name: name.trim(), recruit_count: recruitCount ? Number(recruitCount) : null, rounds: rounds.map((draft) => ({ id: draft.id, league_type: draft.league_type, format: draft.format, rules: { ...(division.rounds.find((round) => round.id === draft.id)?.rules ?? {}), match_rule: draft.match_rule } })) } }).unwrap();
      navigate(`/tournament/${id}`, { replace: true });
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "프로그램을 저장하지 못했습니다."); }
  };
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!division || !data?.tournament.can_manage) return <Box sx={{ p: 2 }}><Alert severity="error">프로그램을 수정할 수 없습니다.</Alert></Box>;
  return <Box sx={{ px: 2.5, pt: 2, pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)} size="small"><ArrowBackIcon /></IconButton><Typography fontWeight={900} fontSize={18}>프로그램 수정</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Typography fontWeight={900} fontSize={18} sx={{ mb: 1 }}>참가 부문</Typography><Divider sx={{ mb: 1 }} />
    <Stack spacing={1} sx={{ mb: 3 }}><TextField fullWidth size="small" label="부문명" value={name} onChange={(event) => setName(event.target.value)} /><TextField fullWidth size="small" label="모집 인원" type="number" value={recruitCount} onChange={(event) => setRecruitCount(event.target.value)} inputProps={{ min: 1 }} /></Stack>
    {rounds.map((round, index) => <Box key={round.id ?? `new-${index}`} sx={{ mb: 3 }}>
      <Typography fontWeight={900} fontSize={18} sx={{ mb: 1 }}>{index + 1}라운드</Typography>
      <Typography fontWeight={800} sx={{ mb: 1 }}>대회 유형</Typography><RadioGroup value={round.league_type} onChange={(event) => changeRound(index, { league_type: event.target.value as TournamentLeagueType })} sx={{ gap: 1, mb: 2 }}>{typeOptions.map(([value, label]) => <FormControlLabel key={value} value={value} control={<Radio />} label={label} sx={optionSx} />)}</RadioGroup>
      <Typography fontWeight={800} sx={{ mb: 1 }}>대회 방식</Typography><RadioGroup value={round.format} onChange={(event) => changeRound(index, { format: event.target.value as TournamentFormat })} sx={{ gap: 1, mb: 2 }}>{formatOptions.map(([value, label]) => <FormControlLabel key={value} value={value} control={<Radio />} label={label} sx={optionSx} />)}</RadioGroup>
      <Typography fontWeight={800} sx={{ mb: 1 }}>대회 규칙</Typography><RadioGroup value={round.match_rule} onChange={(event) => changeRound(index, { match_rule: event.target.value })} sx={{ gap: 1 }}>{ruleOptions.map(([value, label]) => <FormControlLabel key={value} value={value} control={<Radio />} label={label} sx={optionSx} />)}</RadioGroup>
      <Divider sx={{ mt: 3 }} />
    </Box>)}
    <Button fullWidth variant="outlined" sx={{ mb: 2, borderRadius: 1, fontWeight: 800 }} onClick={() => setRounds((current) => [...current, { league_type: "SINGLES", format: "GROUP", match_rule: "BEST_OF_3" }])}>+ 라운드 추가</Button>
    <Stack direction="row" spacing={1}><Button fullWidth variant="contained" color="inherit" onClick={() => navigate(`/tournament/${id}`)} sx={{ borderRadius: 1, fontWeight: 800 }}>이전</Button><Button fullWidth variant="contained" disabled={saving} onClick={save} sx={{ borderRadius: 1, fontWeight: 800 }}>저장</Button></Stack>
  </Box>;
}
