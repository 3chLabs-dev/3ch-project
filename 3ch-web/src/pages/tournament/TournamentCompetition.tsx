import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import SearchIcon from "@mui/icons-material/Search";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import PrintIcon from "@mui/icons-material/Print";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MatchCard } from "../league/LeagueMatchOrder";
import LeagueBracket from "../league/LeagueBracket";
import { LeagueKnockoutCanvas } from "../league/LeagueTournamentBracket";
import { useGetTournamentQuery, useGetTournamentResultsQuery, useGetTournamentPoolsQuery, useUpdateTournamentMatchMutation, type TournamentMatch } from "../../features/tournament/tournamentApi";
import type { LeagueMatch, LeagueParticipantItem } from "../../features/league/leagueApi";
import type { ProgramMatchPatch } from "../../utils/programMatchGenerator";

export default function TournamentCompetition({ view }: { view: "matches" | "bracket" }) {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const { data: metadata } = useGetTournamentQuery(id);
  const { data, isLoading, error, refetch } = useGetTournamentResultsQuery(id, { pollingInterval: 15000, refetchOnMountOrArgChange: true });
  const division = data?.divisions.find((d) => d.id === divisionId);
  const round = division?.rounds.find((r) => r.round_no === Number(params.get("round"))) ?? division?.rounds[0];
  const { data: poolData } = useGetTournamentPoolsQuery({ id, divisionId });
  const [query, setQuery] = useState(""); const [selectedPool, setSelectedPool] = useState("all");
  const [zoom, setZoom] = useState(1); const [saveError, setSaveError] = useState("");
  const [patches, setPatches] = useState<Record<string, ProgramMatchPatch>>({});
  const latest = useRef(new Map<string, TournamentMatch>());
  const queues = useRef(new Map<string, Promise<unknown>>());
  const [update] = useUpdateTournamentMatchMutation();
  const canScore = metadata?.tournament.can_manage === true;
  useEffect(() => { for (const r of division?.rounds ?? []) for (const m of r.matches) if (!queues.current.has(m.id)) latest.current.set(m.id, m); }, [division]);
  useEffect(() => { setQuery(""); setSelectedPool("all"); setPatches({}); }, [divisionId, round?.round_no]);
  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; member_division: string | null; club_name: string }>();
    for (const p of round?.standings ?? []) map.set(p.id,p);
    if (round?.round_no === 1) for (const pool of poolData?.pools ?? []) for (const p of pool.members) map.set(p.id,p);
    return map;
  }, [round, poolData]);
  const matches: LeagueMatch[] = (round?.matches ?? []).filter((m) => m.status !== "cancelled").map((m) => {
    const a = people.get(m.participant_a_id ?? ""), b = people.get(m.participant_b_id ?? "");
    const name = (p: typeof a) => p?.name ?? null;
    return { ...m, court: m.court ?? null, status: m.status === "completed" ? "done" : m.status === "playing" ? "playing" : "pending",
      participant_a_name: name(a), participant_b_name: name(b), participant_a_club_name: a?.club_name, participant_b_club_name: b?.club_name, participant_a_division: a?.member_division ?? null, participant_b_division: b?.member_division ?? null,
      round_number: m.round_no, match_label: m.pool_name ? `${m.pool_name}조 · ${m.match_order}경기` : null,
      match_rule: round?.rules.match_rule, ...patches[m.id] };
  });
  const save = (matchId: string, patch: ProgramMatchPatch) => {
    if (!canScore) return;
    setPatches((current) => ({ ...current, [matchId]: { ...current[matchId], ...patch } }));
    const previous = queues.current.get(matchId) ?? Promise.resolve();
    const job = previous.then(async () => {
      const saved = latest.current.get(matchId); if (!saved) throw new Error("최신 경기를 다시 확인해주세요.");
      const updates = { ...(patch.score_a !== undefined && patch.score_a !== null ? { score_a: patch.score_a } : {}), ...(patch.score_b !== undefined && patch.score_b !== null ? { score_b: patch.score_b } : {}), ...(patch.status ? { status: patch.status === "done" ? "completed" : patch.status } : {}), ...(patch.court !== undefined ? { court: patch.court } : {}) };
      const response = await update({ id, matchId, expected: { score_a: saved.score_a, score_b: saved.score_b, status: saved.status, court: saved.court ?? null }, updates }).unwrap();
      latest.current.set(matchId,response.match);
    });
    queues.current.set(matchId,job);
    void job.catch((reason) => { setSaveError((reason as { data?: { message?: string } }).data?.message || "저장에 실패했습니다. 최신 경기를 다시 확인해주세요."); }).finally(() => {
      if (queues.current.get(matchId) !== job) return;
      queues.current.delete(matchId);
      void refetch().then(() => setPatches((current) => { if (queues.current.has(matchId)) return current; const next = { ...current }; delete next[matchId]; return next; }));
    });
  };
  const poolNames = [...new Set(matches.map((m) => round?.matches.find((raw) => raw.id === m.id)?.pool_name).filter((p): p is string => !!p))];
  const filtered = matches.filter((m) => (selectedPool === "all" || round?.matches.find((raw) => raw.id === m.id)?.pool_name === selectedPool) && (!query.trim() || `${m.participant_a_name} ${m.participant_b_name} ${m.participant_a_club_name} ${m.participant_b_club_name} ${m.participant_a_division} ${m.participant_b_division}`.includes(query.trim())));
  const participantsFor = (items: LeagueMatch[], poolName?: string): LeagueParticipantItem[] => {
    const ids = new Set(items.flatMap((m) => [m.participant_a_id,m.participant_b_id]).filter(Boolean));
    const savedOrder = round?.round_no === 1 ? poolData?.pools.find((p) => String(p.pool_no) === poolName)?.members : undefined;
    return [...(savedOrder ?? [...people.values()].filter((p) => ids.has(p.id)))].map((p) => ({ id: p.id, league_id: `tournament:${id}`, name: p.name, division: p.member_division, paid: false, arrived: false, after: false, created_at: "" }));
  };
  if (!isLoading && view === "bracket" && round && metadata?.tournament && ["GROUP", "GROUP_TOURNAMENT", "LEAGUE"].includes(round.format)) {
    const tournament = metadata.tournament;
    const participants = poolNames.length ? poolNames.flatMap((name) => participantsFor(matches.filter((m) => round.matches.find((raw) => raw.id === m.id)?.pool_name === name), name).map((p) => ({ ...p, group_name: `${name}조` }))) : participantsFor(matches);
    return <><LeagueBracket key={`${divisionId}-${round.round_no}`} external={{
      league: { id: `tournament:${id}`, name: `${tournament.title} · ${division?.name}`, type: round.league_type === "DOUBLES" ? "복식" : round.league_type === "TEAM" ? "단체전" : "단식", format: poolNames.length ? "조별리그" : "풀리그", sport: "탁구", start_date: tournament.starts_at, rules: round.rules.match_rule, status: "active", created_by_id: 0, created_at: "", updated_at: "" },
      participants, matches, canScore,
      backTo: `/tournament/${id}/divisions/${divisionId}/matches?round=${round.round_no}`,
      onRefresh: () => { void refetch(); }, onMatchUpdate: save,
    }} />{saveError && <Alert severity="error" sx={{ position: "fixed", bottom: 20, left: 20, right: 20, zIndex: 10010 }}>{saveError}</Alert>}</>;
  }
  if (isLoading) return <Box sx={{ textAlign: "center", pt: 8 }}><CircularProgress /></Box>;
  return <Box sx={{ pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)}><ChevronLeftIcon /></IconButton><Typography fontSize={20} fontWeight={900}>{view === "matches" ? "경기 순서" : "대진표"}</Typography><Box sx={{ flex: 1 }} />{view === "matches" && <Button startIcon={<AccountTreeIcon />} onClick={() => navigate(`/tournament/${id}/divisions/${divisionId}/bracket?round=${round?.round_no ?? 1}`)}>대진표</Button>}</Stack>
    {(error || saveError) && <Alert severity="error" sx={{ mb: 2 }}>{saveError || "경기를 불러오지 못했습니다."}</Alert>}
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}><TextField select size="small" label="부문" value={divisionId} fullWidth onChange={(e) => navigate(`/tournament/${id}/divisions/${e.target.value}/${view}?round=1`)}>{data?.divisions.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}</TextField>{round && <TextField select size="small" label="라운드" value={round.round_no} fullWidth onChange={(e) => setParams({round:e.target.value})}>{division?.rounds.map((r) => <MenuItem key={r.id} value={r.round_no}>{r.round_no}라운드 · {String(r.rules.round_label ?? "")}</MenuItem>)}</TextField>}</Stack>
    {poolNames.length > 0 && <Tabs value={selectedPool} onChange={(_,v) => setSelectedPool(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}><Tab label="전체" value="all" />{poolNames.map((p) => <Tab key={p} value={p} label={`${p}조`} />)}</Tabs>}
    {view === "matches" ? <>
      <TextField size="small" fullWidth placeholder="이름 또는 부수 검색" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 5 } }} />
      <DndContext><SortableContext items={filtered.map((m) => m.id)} strategy={verticalListSortingStrategy}><Stack spacing={2}>{filtered.map((m) => <MatchCard key={`${divisionId}-${round?.round_no}-${m.id}`} match={m} index={m.match_order - 1} canManage={false} canMember={canScore} leagueId={`tournament:${id}`} rules={round?.rules.match_rule} onProgramMatchUpdate={save} />)}</Stack></SortableContext></DndContext>
    </> : <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}><IconButton aria-label="축소" onClick={() => setZoom((z) => Math.max(.5,z-.1))}><ZoomOutIcon /></IconButton><IconButton aria-label="확대" onClick={() => setZoom((z) => Math.min(2,z+.1))}><ZoomInIcon /></IconButton><IconButton aria-label="인쇄" onClick={() => window.print()}><PrintIcon /></IconButton></Stack>
      <Box sx={{ overflow: "auto" }}><Box sx={{ zoom }}>
      <LeagueKnockoutCanvas matches={filtered} />
      </Box></Box>
    </>}
    {!matches.length && <Typography color="text.secondary" sx={{ mt: 2 }}>아직 등록된 경기가 없습니다.</Typography>}
  </Box>;
}
