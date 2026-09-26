import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, IconButton, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTournamentQuery, useUpdateTournamentMutation, useUpdateTournamentVisibilityMutation } from "../../features/tournament/tournamentApi";
import TournamentParticipants from "./TournamentParticipants";

const rowSx = { display: "grid", gridTemplateColumns: "72px 1fr", alignItems: "center", py: 0.8 };
const labelSx = { fontSize: 13, fontWeight: 700, color: "#6B7280" };
const valueSx = { fontSize: 13, fontWeight: 700 };
const typeNames: Record<string, string> = { SINGLES: "단식", DOUBLES: "복식", TEAM: "단체전" };
const formatNames: Record<string, string> = { LEAGUE: "풀리그", GROUP: "조별리그", TOURNAMENT: "토너먼트", GROUP_TOURNAMENT: "조별리그 + 토너먼트" };
const ruleNames: Record<string, string> = { BEST_OF_3: "3전 2선승제", BEST_OF_5: "5전 3선승제", THREE_SET: "3세트제" };
const localDate = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const localTime = (value: string) => new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function TournamentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error: loadError } = useGetTournamentQuery(id, { skip: !id });
  const [update, { isLoading: saving }] = useUpdateTournamentMutation();
  const [updateVisibility] = useUpdateTournamentVisibilityMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", date: "", start: "", end: "", application_deadline_at: "", venue_name: "", court_count: "", recruit_count: "" });
  const [error, setError] = useState("");
  const tournament = data?.tournament;
  const startEdit = () => {
    if (!tournament) return;
    setDraft({ title: tournament.title, date: localDate(tournament.starts_at), start: localTime(tournament.starts_at), end: tournament.ends_at ? localTime(tournament.ends_at) : "", application_deadline_at: tournament.application_deadline_at ? `${localDate(tournament.application_deadline_at)}T${localTime(tournament.application_deadline_at)}` : "", venue_name: tournament.venue_name ?? "", court_count: String(tournament.court_count ?? ""), recruit_count: String(tournament.recruit_count ?? "") });
    setEditing(true);
    setError("");
  };
  const save = async () => {
    if (!draft.title.trim() || !draft.date || !draft.start) { setError("대회명, 날짜, 시작 시간을 입력해주세요."); return; }
    const start = new Date(`${draft.date}T${draft.start}:00`);
    const end = draft.end ? new Date(`${draft.date}T${draft.end}:00`) : null;
    const deadline = draft.application_deadline_at ? new Date(draft.application_deadline_at) : null;
    if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end < start))) { setError("시간을 확인해주세요."); return; }
    if (!deadline || Number.isNaN(deadline.getTime()) || deadline >= start) { setError("참가 신청 마감을 대회 시작 전으로 설정해주세요."); return; }
    try {
      await update({ id, body: { title: draft.title.trim(), starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, application_deadline_at: deadline.toISOString(), venue_name: draft.venue_name.trim() || null, court_count: draft.court_count ? Number(draft.court_count) : null, recruit_count: draft.recruit_count ? Number(draft.recruit_count) : null } }).unwrap();
      setEditing(false); setError("");
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "대회 정보를 저장하지 못했습니다."); }
  };
  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!tournament) return <Box sx={{ p: 2 }}><Alert severity="error">{(loadError as { data?: { message?: string } })?.data?.message ?? "대회를 불러올 수 없습니다."}</Alert></Box>;
  const field = (name: keyof typeof draft, type = "text") => <TextField size="small" variant="standard" type={type} value={draft[name]} onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))} inputProps={type === "number" ? { min: 1 } : undefined} />;
  return <Box sx={{ pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate("/league")} size="small" sx={{ mr: 0.5 }}><ArrowBackIcon /></IconButton><Typography fontWeight={900} fontSize={18} sx={{ flex: 1 }}>{tournament.title}</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", px: 2, py: 1, mb: 2.5 }}>
      <Box sx={rowSx}><Typography sx={labelSx}>대회명</Typography>{editing ? field("title") : <Typography sx={valueSx}>{tournament.title}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>날 짜</Typography>{editing ? field("date", "date") : <Typography sx={valueSx}>{localDate(tournament.starts_at)}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>시 간</Typography>{editing ? <Stack direction="row" spacing={1} alignItems="center">{field("start", "time")}<Typography>~</Typography>{field("end", "time")}</Stack> : <Typography sx={valueSx}>{localTime(tournament.starts_at)}{tournament.ends_at ? ` ~ ${localTime(tournament.ends_at)}` : ""}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>신청 마감</Typography>{editing ? field("application_deadline_at", "datetime-local") : <Typography sx={valueSx}>{tournament.application_deadline_at ? new Date(tournament.application_deadline_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "미설정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>장 소</Typography>{editing ? field("venue_name") : <Typography sx={valueSx}>{tournament.venue_name || "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>코트 수</Typography>{editing ? field("court_count", "number") : <Typography sx={valueSx}>{tournament.court_count ? `${tournament.court_count}개` : "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>참가자 수</Typography>{editing ? field("recruit_count", "number") : <Typography sx={valueSx}>{tournament.recruit_count ? `${tournament.recruit_count}명 (전체 부문 합계)` : "미정"}</Typography>}</Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>주최 클럽</Typography><Typography sx={valueSx}>{tournament.host_group_name ?? ""}</Typography></Box><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>프리미엄 노출</Typography>{tournament.can_manage ? <Select variant="standard" size="small" value={tournament.premium_visible ? "on" : "off"} onChange={async (event) => { try { await updateVisibility({ id, premium_visible: event.target.value === "on" }).unwrap(); } catch { setError("노출 설정을 변경하지 못했습니다."); } }}><MenuItem value="on">ON</MenuItem><MenuItem value="off">OFF</MenuItem></Select> : <Typography sx={valueSx}>{tournament.premium_visible ? "ON" : "OFF"}</Typography>}</Box>
      {tournament.can_manage && <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ py: 1 }}>{editing ? <><Button size="small" variant="outlined" onClick={() => setEditing(false)}>취소</Button><Button size="small" variant="contained" disabled={saving} onClick={save}>저장</Button></> : <Button size="small" variant="outlined" onClick={startEdit} sx={{ minWidth: 44, height: 24, borderRadius: 1, px: 1.25, fontSize: 11, fontWeight: 800 }}>수정</Button>}</Stack>}
    </Box>
    <Typography fontWeight={900} fontSize={17} sx={{ mb: 1 }}>부문별 프로그램</Typography>
    {(tournament.divisions ?? []).map((division) => <Box key={division.id} sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", px: 2, py: 1, mb: 1.5 }}>
      <Stack direction="row" alignItems="center" sx={{ py: 0.8 }}><Typography fontWeight={800} fontSize={15} sx={{ flex: 1 }}>{division.name}</Typography>{tournament.can_manage && <Button size="small" variant="outlined" onClick={() => navigate(`/tournament/${id}/divisions/${division.id}/program`)} sx={{ minWidth: 44, height: 24, borderRadius: 1, px: 1.25, fontSize: 11, fontWeight: 800 }}>수정</Button>}</Stack><Divider />
      <Box sx={rowSx}><Typography sx={labelSx}>참가자</Typography><Typography sx={valueSx}>신청 {division.applicant_count}명 · 확정 {division.confirmed_count}명{division.recruit_count ? ` / ${division.recruit_count}명` : ""}</Typography></Box>
      {(division.rounds ?? []).map((round) => <Box key={round.id}><Divider /><Box sx={rowSx}><Typography sx={labelSx}>{round.round_no}라운드</Typography><Typography sx={valueSx}>{typeNames[round.league_type] ?? round.league_type} · {formatNames[round.format] ?? round.format} · {ruleNames[String(round.rules?.match_rule)] ?? String(round.rules?.match_rule ?? "규칙 미정")}</Typography></Box></Box>)}
    </Box>)}
    <Typography fontWeight={900} fontSize={17} sx={{ mb: 1, mt: 2 }}>참가 신청 · 조 편성</Typography>
    <TournamentParticipants tournament={tournament} />
  </Box>;
}
