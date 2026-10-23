import { TournamentEntryFields, getEntryConfig, type TournamentEntryConfig } from "./TournamentEntryFields";
import { useGetTournamentQuery, useGetTournamentPoolsQuery, useCreateTournamentCompetitionMutation } from "../../features/tournament/tournamentApi";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, Typography, TextField } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RoundConfigEditor } from "../demo/LeagueAlgorithmDemo";
import { useGetLeagueProgramQuery, useGetLeagueMatchesQuery, useGetLeagueQuery, useSaveLeagueProgramMutation, type LeagueMatch } from "../../features/league/leagueApi";
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
  const { currentData: matchData } = useGetLeagueMatchesQuery(key, { skip: creating });
  const { currentData: poolsData } = useGetTournamentPoolsQuery({ id, divisionId }, { skip: creating });
  const [saveProgram, { isLoading: saving }] = useSaveLeagueProgramMutation();
  const [rounds, setRounds] = useState<RoundConfig[]>([]);
  const [error, setError] = useState("");
  const [program, setProgram] = useState<ProgramOption>();
  const [resetSnapshot, setResetSnapshot] = useState<LeagueMatch[] | null>(null);
  const hydratedKey = useRef("");
  useEffect(() => {
    const loaded = data?.program?.program_data as ProgramOption | undefined;
    if (loaded && hydratedKey.current !== key) { hydratedKey.current = key; setProgram(loaded); setRounds(creating ? [{ id: 1, expanded: true, program: "SINGLES", format: "TOURNAMENT", matchRule: "BEST_OF_3", option: "PRELIM", teamPlayerCount: 3, teamMatchType: "SSS", tournamentMode: "single", finalAdvancementMode: "all", advanceCount: 2 }] : loaded.rounds ?? []); setEntry(creating ? { source_division_ids: [], start_round: 2 } : loaded.tournamentEntryConfig ?? { source_division_ids: [], start_round: 1 }); }
  }, [data, key, creating]);
  const save = async (confirmedReset = false) => {
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
    const editedProgram = { ...program, tournamentEntryConfig: entry, rounds, blocks, compositionMode: "custom" as const };
    if (!matchData || !poolsData) { setError("초기화할 경기와 편성을 불러온 후 다시 시도해주세요."); return; }
    const hasFormation = program.blocks.some(block => [block.groupAssignments, block.teamAssignments, block.doublesAssignments].some(groups => groups?.some(group => group.length)));
    if (!confirmedReset && (matchData.matches.length || poolsData.pools.length || hasFormation)) {
      setResetSnapshot(structuredClone(matchData.matches));
      return;
    }
    try {
      await saveProgram({ leagueId: key, program: editedProgram, resetForEdit: true, expectedMatches: confirmedReset ? resetSnapshot ?? [] : matchData.matches }).unwrap();
      navigate(`/tournament/${id}`);
    }
    catch (reason) { setResetSnapshot(null); setError((reason as { data?: { message?: string } }).data?.message ?? "프로그램을 저장하지 못했습니다."); }
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
    <Button fullWidth variant="contained" disabled={saving || creatingCompetition || !rounds.length || !creating && (!matchData || !poolsData)} onClick={() => void save()} sx={{ mt: 3, height: 44, fontWeight: 900 }}>{creating ? "추가" : "수정 완료"}</Button>
    <Dialog open={resetSnapshot !== null} onClose={() => { if (!saving) setResetSnapshot(null); }} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>프로그램 수정 및 초기화</DialogTitle>
      <DialogContent dividers><Typography sx={{ mb: 1.5 }}>이 부문의 모든 라운드 경기 {resetSnapshot?.length ?? 0}개와 조·복식·단체 편성을 초기화합니다. 삭제한 라운드 설정도 제거됩니다.</Typography>
        {!!resetSnapshot?.some(match => match.status === "done" || match.status === "playing" || match.score_a != null || match.score_b != null) && <Alert severity="warning" sx={{ mb: 1.5 }}>진행 중이거나 결과가 입력된 경기 {resetSnapshot.filter(match => match.status === "done" || match.status === "playing" || match.score_a != null || match.score_b != null).length}개도 현재 대진표와 순위에서 초기화됩니다.</Alert>}
        <Typography sx={{ mb: 1.5 }}>참가자 명단·부수·소속·신청 상태는 유지하며, 이전 편성과 결과는 복구용 기록에 보관합니다.</Typography><Typography>경기를 즉시 다시 생성하지 않습니다. 참가자를 변경하고 조편성을 다시 진행할 수 있습니다.</Typography>
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setResetSnapshot(null)}>취소</Button><Button color="error" variant="contained" disabled={saving} onClick={() => void save(true)}>{saving ? "저장 중" : "초기화하고 수정 완료"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
