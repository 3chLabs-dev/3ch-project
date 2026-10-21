import { TournamentEntryFields, getEntryConfig, type TournamentEntryConfig } from "./TournamentEntryFields";
import { useGetTournamentQuery, useCreateTournamentCompetitionMutation } from "../../features/tournament/tournamentApi";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Typography, TextField } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RoundConfigEditor } from "../demo/LeagueAlgorithmDemo";
import { useGetLeagueProgramQuery, useGetLeagueQuery, useSaveLeagueProgramMutation } from "../../features/league/leagueApi";
import type { ProgramOption, RoundConfig } from "../../features/league/types/tournament.types";
import { tournamentLeagueKey } from "../../features/tournament/leagueScope";

export default function TournamentProgramEdit() {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const creating = params.get("new") === "merged";
  const { data: tournamentData } = useGetTournamentQuery(id);
  const [createCompetition, { isLoading: creatingCompetition }] = useCreateTournamentCompetitionMutation();
  const [name, setName] = useState("");
  const [entry, setEntry] = useState<TournamentEntryConfig>({ source_division_ids: [], start_round: 1 });
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
    if (loaded && hydratedKey.current !== key) { hydratedKey.current = key; setProgram(loaded); setRounds(creating ? [{ id: 1, expanded: true, program: "SINGLES", format: "TOURNAMENT", matchRule: "BEST_OF_3", option: "PRELIM", teamPlayerCount: 3, teamMatchType: "SSS", tournamentMode: "single", finalAdvancementMode: "all", advanceCount: 2 }] : loaded.rounds ?? []); setEntry(creating ? { source_division_ids: [], start_round: 2 } : loaded.tournamentEntryConfig ?? { source_division_ids: [], start_round: 1 }); }
  }, [data, key, creating]);
  const save = async () => {
    if (!program || !rounds.length) return;
    if ((creating || entry.source_division_ids.length > 0) && entry.source_division_ids.length < 2) { setError("통합할 신청 부문을 두 개 이상 선택해주세요."); return; }
    if (creating && !name.trim()) { setError("통합 구성 이름을 입력해주세요."); return; }
    const labels = { BEST_OF_3: "3전 2선승제", BEST_OF_5: "5전 3선승제", THREE_SET: "3세트제" } as const;
    const blocks = rounds.map((round, index) => ({ ...program.blocks[index], ...round, type: round.program,
      format: round.format, roundOption: round.option, matchRule: labels[round.matchRule],
      title: `${index + 1}라운드`, matchCount: program.blocks[index]?.matchCount ?? 0,
      expectedMinutes: program.blocks[index]?.expectedMinutes ?? 0,
    }));
    if (creating) {
      try {
        await createCompetition({ id, body: { name: name.trim(), recruit_count: null, entry_config: entry, rounds: rounds.map(r => ({ league_type: r.program, format: r.format, rules: { match_rule: r.matchRule, league_config: r, round_label: r.option === "PRELIM" ? "예선" : r.option === "FINAL" ? "본선" : "" } })) } }).unwrap();
        navigate(`/tournament/${id}`);
      } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "통합 구성을 저장하지 못했습니다."); }
      return;
    }
    try { await saveProgram({ leagueId: key, program: { ...program, tournamentEntryConfig: entry, rounds, blocks, compositionMode: "custom" } }).unwrap(); navigate(`/tournament/${id}`); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "프로그램을 저장하지 못했습니다."); }
  };
  if (isLoading || metadataLoading || (data?.program && !program)) return <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>;
  if (!program || metadata?.league.can_manage !== true) return <Alert severity="error">프로그램을 수정할 수 없습니다.</Alert>;
  return <Box sx={{ px: 0.5, pt: 2, pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)}><ArrowBackIcon /></IconButton><Typography fontSize={18} fontWeight={900}>{creating ? "통합 경기 구성 추가" : "프로그램 수정"}</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {creating && <TextField fullWidth size="small" label="통합 구성 이름" placeholder="예: 3~4부" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />}
    <TournamentEntryFields merged={creating || entry.source_division_ids.length > 0} config={entry} onChange={setEntry} divisions={(tournamentData?.tournament.divisions ?? []).filter(d => !getEntryConfig(d).source_division_ids.length && (creating || d.id !== divisionId)).map(d => ({ id: d.id, name: d.name }))} />
    <Typography fontWeight={800} sx={{ my: 1.5 }}>라운드 구성</Typography>
    <RoundConfigEditor roundNumberOffset={entry.start_round - 1} rounds={rounds} setRounds={setRounds} clubPoliciesEnabled participantCount={entry.source_division_ids.length ? (tournamentData?.tournament.divisions ?? []).filter(d => entry.source_division_ids.includes(d.id)).reduce((sum, d) => sum + d.confirmed_count, 0) : metadata.league.participant_count ?? 0} halfSplitMatchEnabled />
    <Button fullWidth variant="contained" disabled={saving || creatingCompetition || !rounds.length} onClick={() => void save()} sx={{ mt: 3, height: 44, fontWeight: 900 }}>{creating ? "추가" : "수정 완료"}</Button>
  </Box>;
}
