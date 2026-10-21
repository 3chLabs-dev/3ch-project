import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { RoundConfigEditor } from "../demo/LeagueAlgorithmDemo";
import { useGetLeagueProgramQuery, useGetLeagueQuery, useSaveLeagueProgramMutation } from "../../features/league/leagueApi";
import type { ProgramOption, RoundConfig } from "../../features/league/types/tournament.types";
import { tournamentLeagueKey } from "../../features/tournament/leagueScope";

export default function TournamentProgramEdit() {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate();
  const key = tournamentLeagueKey(id, divisionId);
  const { currentData: data, isLoading } = useGetLeagueProgramQuery(key);
  const { data: metadata, isLoading: metadataLoading } = useGetLeagueQuery(key);
  const [saveProgram, { isLoading: saving }] = useSaveLeagueProgramMutation();
  const [rounds, setRounds] = useState<RoundConfig[]>([]);
  const [error, setError] = useState("");
  const [program, setProgram] = useState<ProgramOption>();
  const hydratedKey = useRef("");
  useEffect(() => {
    const loaded = data?.program?.program_data as ProgramOption | undefined;
    if (loaded && hydratedKey.current !== key) { hydratedKey.current = key; setProgram(loaded); setRounds(loaded.rounds ?? []); }
  }, [data, key]);
  const save = async () => {
    if (!program || !rounds.length) return;
    const labels = { BEST_OF_3: "3전 2선승제", BEST_OF_5: "5전 3선승제", THREE_SET: "3세트제" } as const;
    const blocks = rounds.map((round, index) => ({ ...program.blocks[index], ...round, type: round.program,
      format: round.format, roundOption: round.option, matchRule: labels[round.matchRule],
      title: `${index + 1}라운드`, matchCount: program.blocks[index]?.matchCount ?? 0,
      expectedMinutes: program.blocks[index]?.expectedMinutes ?? 0,
    }));
    try { await saveProgram({ leagueId: key, program: { ...program, rounds, blocks, compositionMode: "custom" } }).unwrap(); navigate(`/tournament/${id}`); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "프로그램을 저장하지 못했습니다."); }
  };
  if (isLoading || metadataLoading || (data?.program && !program)) return <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>;
  if (!program || metadata?.league.can_manage !== true) return <Alert severity="error">프로그램을 수정할 수 없습니다.</Alert>;
  return <Box sx={{ px: 0.5, pt: 2, pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)}><ArrowBackIcon /></IconButton><Typography fontSize={18} fontWeight={900}>프로그램 수정</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Typography fontWeight={800} sx={{ mb: 1.5 }}>라운드 구성</Typography>
    <RoundConfigEditor rounds={rounds} setRounds={setRounds} clubPoliciesEnabled participantCount={metadata.league.participant_count ?? 0} halfSplitMatchEnabled />
    <Button fullWidth variant="contained" disabled={saving || !rounds.length} onClick={() => void save()} sx={{ mt: 3, height: 44, fontWeight: 900 }}>수정 완료</Button>
  </Box>;
}
