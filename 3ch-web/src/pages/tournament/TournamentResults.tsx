import { useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGetTournamentResultsQuery, type TournamentRoundResult, type TournamentStanding } from "../../features/tournament/tournamentApi";
import { formatTournamentParticipantName } from "../../features/tournament/participantLabel";

export default function TournamentResults({ view = "results" }: { view?: "results" | "ranking" | "matches" | "bracket" }) {
  const { id = "", divisionId = "" } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate();
  const { data, isLoading, error } = useGetTournamentResultsQuery(id);
  const [selectedDivision, setSelectedDivision] = useState(divisionId); const [selectedRound, setSelectedRound] = useState(Number(params.get("round")) || 0);
  const divisions = data?.divisions ?? []; const division = divisions.find((entry) => entry.id === selectedDivision) ?? divisions[0];
  const round = division?.rounds.find((entry) => entry.round_no === selectedRound) ?? (view === "ranking" ? [...division?.rounds ?? []].reverse().find((entry) => entry.complete) : undefined) ?? division?.rounds[0];
  const heading = { results: "결과 보기", ranking: "순위", matches: "경기 순서", bracket: "대진표" }[view];
  const table = (rows: TournamentStanding[]) => <Box sx={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 1.5 }}><Table size="small"><TableHead sx={{ bgcolor: "#F9FAFB" }}><TableRow>{["순위", "참가자", "승/패", "득/실"].map((label) => <TableCell key={label} sx={{ fontSize: 12, whiteSpace: "nowrap", fontWeight: 800 }}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell sx={{ fontWeight: 900 }}>{row.rank}</TableCell><TableCell sx={{ fontSize: 13, minWidth: 130 }}>{formatTournamentParticipantName(row)}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{row.wins} / {row.losses}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{row.sets_for} / {row.sets_against}</TableCell></TableRow>)}</TableBody></Table></Box>;
  const result = (entry: TournamentRoundResult) => entry.brackets?.length ? <Stack spacing={2}>{entry.brackets.map((bracket) => <Box key={bracket.name}><Typography fontWeight={900} sx={{ mb: 1 }}>{bracket.name} 결과</Typography>{table(bracket.standings)}</Box>)}</Stack> : entry.pools?.length ? <Stack spacing={2}>{entry.pools.map((pool) => <Box key={pool.name}><Typography fontWeight={900} sx={{ mb: 1 }}>{pool.name}조</Typography>{table(pool.standings)}</Box>)}</Stack> : table(entry.standings);
  if (isLoading) return <Box sx={{ pt: 6, textAlign: "center" }}><CircularProgress /></Box>;
  return <Box sx={{ pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton size="small" onClick={() => navigate(`/tournament/${id}`)}><ArrowBackIcon /></IconButton><Typography fontSize={20} fontWeight={900}>{heading}</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>대회 결과를 불러오지 못했습니다.</Alert>}
    {!!division?.unassigned_match_count && <Alert severity="info" sx={{ mb: 2 }}>참가 라운드가 지정되지 않은 기존 경기 {division.unassigned_match_count}개가 있습니다. 해당 경기는 라운드별 순위에서 제외됩니다.</Alert>}
    {division && <TextField select fullWidth size="small" label="부문" value={division.id} onChange={(event) => { setSelectedDivision(event.target.value); setSelectedRound(0); }} sx={{ mb: 2 }}>{divisions.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}</TextField>}
    {round && <><TextField select fullWidth size="small" label="라운드" value={round.round_no} onChange={(event) => setSelectedRound(Number(event.target.value))} sx={{ mb: 2 }}>{division?.rounds.map((entry) => <MenuItem key={entry.id} value={entry.round_no}>{entry.round_no}라운드 · {String(entry.rules.round_label || "")}{entry.complete ? " · 완료" : ""}</MenuItem>)}</TextField>
      {!round.match_count ? <Typography color="text.secondary">아직 등록된 경기가 없습니다.</Typography> : <>
        <Typography fontSize={13} color="text.secondary" sx={{ mb: 1.5 }}>완료 {round.completed_match_count} / {round.match_count}경기{!round.complete && " · 진행 중인 라운드입니다."}</Typography>
        {(view === "ranking" || view === "results") ? result(round) : <Stack spacing={1}>{round.matches.map((match, index) => {
          const person = (personId: string | null) => { const found = round.standings.find((entry) => entry.id === personId); return found ? formatTournamentParticipantName(found, view === "bracket") : personId ? "참가자 정보 없음" : "부전승"; };
          return <Box key={match.id} sx={{ border: "1px solid #E5E7EB", borderRadius: 2, p: 1.5, bgcolor: "#F9FAFB" }}><Typography fontSize={12} color="text.secondary" sx={{ mb: 0.5 }}>{index + 1}경기{match.pool_name ? ` · ${match.pool_name}조` : ""}{view === "bracket" && match.round_no ? ` · ${match.round_no}단계` : ""}</Typography><Typography fontSize={13} fontWeight={800}>{person(match.participant_a_id)} <Typography component="span" color="primary" fontWeight={900}>{match.score_a ?? "−"} : {match.score_b ?? "−"}</Typography> {person(match.participant_b_id)}</Typography><Typography fontSize={11} color="text.secondary">{match.status === "completed" ? "완료" : match.status === "cancelled" ? "취소" : "대기"}</Typography></Box>;
        })}</Stack>}
        {view !== "results" && round.complete && <Button fullWidth variant="outlined" color="success" sx={{ mt: 2 }} onClick={() => navigate(`/tournament/${id}/divisions/${division?.id}/results?round=${round.round_no}`)}>결과 보기</Button>}
      </>}
    </>}
  </Box>;
}
