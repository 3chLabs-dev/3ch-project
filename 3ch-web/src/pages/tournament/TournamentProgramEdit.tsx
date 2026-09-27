import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTournamentQuery, useSaveTournamentProgramMutation, type TournamentFormat, type TournamentLeagueType } from "../../features/tournament/tournamentApi";

type DraftRound = { id?: string; key: number; league_type: TournamentLeagueType; format: TournamentFormat; match_rule: string; round_label: string; half_split_only_matches: boolean };
const segmentedSx = { width: "100%", "& .MuiToggleButton-root": { flex: 1, py: 1.25, px: 0.5, fontSize: 12, fontWeight: 700, lineHeight: 1.2, textTransform: "none", color: "#6B7280", borderColor: "#D1D5DB", "&.Mui-selected": { bgcolor: "#E5E5E5", color: "#111827", "&:hover": { bgcolor: "#E5E5E5" } } } };
const sectionSx = { mt: 2, mb: 0.8, fontSize: 14, fontWeight: 800 };
const newRound = (key: number): DraftRound => ({ key, league_type: "SINGLES", format: "LEAGUE", match_rule: "THREE_SET", round_label: "", half_split_only_matches: false });

export default function TournamentProgramEdit() {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useGetTournamentQuery(id, { skip: !id });
  const [saveProgram, { isLoading: saving }] = useSaveTournamentProgramMutation();
  const division = data?.tournament.divisions?.find((item) => item.id === divisionId);
  const [rounds, setRounds] = useState<DraftRound[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!division) return;
    setRounds(division.rounds.map((round, index) => ({ id: round.id, key: index + 1, league_type: round.league_type, format: round.format, match_rule: String(round.rules?.match_rule ?? "BEST_OF_3"), round_label: String(round.rules?.round_label ?? ""), half_split_only_matches: round.rules?.half_split_only_matches === true })));
  }, [division]);
  const change = (key: number, patch: Partial<DraftRound>) => setRounds((current) => current.map((round) => round.key === key ? { ...round, ...patch } : round));
  const save = async () => {
    if (!division || !rounds.length) { setError("라운드 설정을 확인해주세요."); return; }
    setError("");
    try {
      await saveProgram({ id, divisionId, body: { name: division.name, recruit_count: division.recruit_count ?? null, rounds: rounds.map((round) => ({ id: round.id, league_type: round.league_type, format: round.format, rules: { ...(division.rounds.find((saved) => saved.id === round.id)?.rules ?? {}), match_rule: round.match_rule, round_label: round.round_label, half_split_only_matches: round.half_split_only_matches } })) } }).unwrap();
      navigate(`/tournament/${id}`, { replace: true });
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "프로그램을 저장하지 못했습니다."); }
  };
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!division || !data?.tournament.can_manage) return <Box sx={{ p: 2 }}><Alert severity="error">프로그램을 수정할 수 없습니다.</Alert></Box>;
  return <Box sx={{ px: 2.5, pt: 2, pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)} size="small"><ArrowBackIcon /></IconButton><Typography fontWeight={900} fontSize={18}>{division.name} 프로그램 수정</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Typography sx={{ mb: 1.5, fontSize: 16, fontWeight: 800 }}>라운드 구성</Typography>
    {rounds.map((round, index) => <Box key={round.key} sx={{ border: "1px solid #D1D5DB", borderRadius: 3, p: 2, mb: 1.5, bgcolor: "#fff" }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}><Typography sx={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{index + 1}라운드</Typography>{!round.id && <Button size="small" color="error" variant="outlined" sx={{ borderRadius: 4, minWidth: 64 }} onClick={() => setRounds((current) => current.filter((item) => item.key !== round.key))}>삭제</Button>}</Stack>
      <ToggleButtonGroup exclusive value={round.league_type} onChange={(_, value: TournamentLeagueType | null) => value && change(round.key, { league_type: value })} sx={segmentedSx} fullWidth><ToggleButton value="SINGLES">단식</ToggleButton><ToggleButton value="DOUBLES">복식</ToggleButton><ToggleButton value="TEAM">단체전</ToggleButton></ToggleButtonGroup>
      <Typography sx={sectionSx}>진행 방식</Typography>
      <ToggleButtonGroup exclusive value={round.format} onChange={(_, value: TournamentFormat | null) => value && change(round.key, { format: value })} sx={segmentedSx} fullWidth><ToggleButton value="LEAGUE">풀리그</ToggleButton><ToggleButton value="GROUP">조별리그</ToggleButton><ToggleButton value="TOURNAMENT">토너먼트</ToggleButton>{round.format === "GROUP_TOURNAMENT" && <ToggleButton value="GROUP_TOURNAMENT">조별리그 + 토너먼트</ToggleButton>}</ToggleButtonGroup>
      <Typography sx={sectionSx}>라운드 구분</Typography>
      <TextField fullWidth size="small" placeholder="예선" value={round.round_label} onChange={(event) => change(round.key, { round_label: event.target.value })} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
      <Typography sx={sectionSx}>경기 규칙</Typography>
      <ToggleButtonGroup exclusive value={round.match_rule} onChange={(_, value: string | null) => value && change(round.key, { match_rule: value })} sx={segmentedSx} fullWidth><ToggleButton value="BEST_OF_3">3전 2선승제</ToggleButton><ToggleButton value="BEST_OF_5">5전 3선승제</ToggleButton><ToggleButton value="THREE_SET">3세트제</ToggleButton></ToggleButtonGroup>
      {round.format !== "TOURNAMENT" && <><Typography sx={sectionSx}>대결 모드</Typography><ToggleButtonGroup exclusive value={round.half_split_only_matches ? "split" : "all"} onChange={(_, value: string | null) => value && change(round.key, { half_split_only_matches: value === "split" })} sx={segmentedSx} fullWidth><ToggleButton value="all">전체 매칭</ToggleButton><ToggleButton value="split">상단 VS 하단</ToggleButton></ToggleButtonGroup>{round.half_split_only_matches && <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 12 }}>참가 단위의 표시 순서를 절반으로 나눠 서로 다른 편끼리만 경기합니다.</Typography>}</>}
    </Box>)}
    <Button fullWidth variant="outlined" onClick={() => setRounds((current) => [...current, newRound(Math.max(0, ...current.map((round) => round.key)) + 1)])} sx={{ mb: 2, borderRadius: 2, fontWeight: 800 }}>+ 라운드 추가</Button>
    <Stack direction="row" spacing={1}><Button fullWidth variant="contained" color="inherit" onClick={() => navigate(`/tournament/${id}`)} sx={{ borderRadius: 1, fontWeight: 800 }}>취소</Button><Button fullWidth variant="contained" disabled={saving || !rounds.length} onClick={() => void save()} sx={{ borderRadius: 1, fontWeight: 800 }}>저장</Button></Stack>
  </Box>;
}
