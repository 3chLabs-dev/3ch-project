import { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { formatTournamentParticipantName } from "../../features/tournament/participantLabel";
import { useGetTournamentParticipantsAllQuery, useReviewTournamentApplicationMutation, useUpdateTournamentParticipantDivisionMutation, type TournamentItem, type TournamentParticipant } from "../../features/tournament/tournamentApi";

const pillSx = { height: 28, minWidth: 64, borderRadius: 4, fontSize: 12, fontWeight: 800, boxShadow: "none" };

export default function TournamentParticipants({ tournament }: { tournament: TournamentItem }) {
  const { data, isLoading } = useGetTournamentParticipantsAllQuery(tournament.id);
  const [review, { isLoading: reviewing }] = useReviewTournamentApplicationMutation();
  const [view, setView] = useState<"division" | "club">("division");
  const [divisionId, setDivisionId] = useState("");
  const [clubId, setClubId] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [error, setError] = useState("");
  const [editingParticipant, setEditingParticipant] = useState<TournamentParticipant | null>(null);
  const [divisionDraft, setDivisionDraft] = useState("");
  const [divisionError, setDivisionError] = useState("");
  const [updateDivision, { isLoading: savingDivision }] = useUpdateTournamentParticipantDivisionMutation();
  const saveDivision = async () => {
    if (!editingParticipant || !divisionDraft.trim() || divisionDraft.trim().length > 40) { setDivisionError("대회 부수를 입력해주세요. (최대 40자)"); return; }
    try {
      await updateDivision({ id: tournament.id, participantId: editingParticipant.id, member_division: divisionDraft.trim(), previous_member_division: editingParticipant.member_division }).unwrap();
      setEditingParticipant(null);
    } catch (reason) { setDivisionError((reason as { data?: { message?: string } }).data?.message ?? "대회 부수를 수정하지 못했습니다."); }
  };
  const participants = data?.participants ?? [];
  const divisions = tournament.divisions ?? [];
  const selectedDivision = divisions.find((division) => division.id === divisionId) ?? divisions[0];
  const clubs = useMemo(() => {
    const found = new Map<string, string>();
    for (const participant of participants) found.set(participant.source_group_id ?? "individual", participant.club_name);
    return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [participants]);
  const selectedClub = clubs.find((club) => club.id === clubId) ?? clubs[0];
  const canEdit = new Date() < new Date(tournament.starts_at);
  const deadlinePassed = new Date() >= new Date(tournament.application_deadline_at ?? tournament.starts_at);
  const filtered = (entries: TournamentParticipant[]) => entries.filter((participant) => !search.trim() || formatTournamentParticipantName(participant).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const reviewParticipant = async (participant: TournamentParticipant, status: "confirmed" | "rejected") => {
    if (status === "rejected" && !window.confirm(`${formatTournamentParticipantName(participant)}의 신청을 거절하시겠습니까?`)) return;
    setError("");
    try { await review({ id: tournament.id, divisionId: participant.division_id, participantId: participant.id, status, ...(status === "rejected" ? { confirmation_intent: "REJECT_TOURNAMENT_APPLICATION" } : {}) }).unwrap(); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "신청 상태를 변경하지 못했습니다."); }
  };
  const list = (entries: TournamentParticipant[]) => <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 64px", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}><Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>참가자 · 부수 · 클럽</Typography><Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textAlign: "center" }}>상태</Typography></Box>
    {entries.length ? entries.map((participant, index) => <Box key={participant.id} sx={{ px: 1.5, py: 0.9, borderTop: index ? "1px solid #F3F4F6" : "none" }}><Stack direction="row" alignItems="center" spacing={0.8}><Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{formatTournamentParticipantName(participant)}</Typography>{tournament.can_manage && <Button size="small" variant="outlined" sx={{ ...pillSx, minWidth: 56, height: 25 }} onClick={() => { setEditingParticipant(participant); setDivisionDraft(participant.member_division ?? ""); setDivisionError(""); }}>부수 수정</Button>}<Chip size="small" label={participant.status === "confirmed" ? "확정" : "신청"} sx={{ height: 23, bgcolor: participant.status === "confirmed" ? "#DCFCE7" : "#F3F4F6", color: participant.status === "confirmed" ? "#15803D" : "#4B5563", fontWeight: 800, fontSize: 11 }} /></Stack>{tournament.can_manage && participant.status === "applied" && canEdit && <Stack direction="row" justifyContent="flex-end" spacing={0.7} sx={{ mt: 0.7 }}><Button size="small" variant="outlined" disabled={reviewing} onClick={() => void reviewParticipant(participant, "confirmed")} sx={{ ...pillSx, height: 25 }}>확정</Button><Button size="small" color="error" variant="outlined" disabled={reviewing} onClick={() => void reviewParticipant(participant, "rejected")} sx={{ ...pillSx, height: 25 }}>거절</Button></Stack>}</Box>) : <Typography sx={{ py: 2, textAlign: "center", fontSize: 13, color: "text.secondary" }}>등록된 참가자가 없습니다.</Typography>}
  </Box>;
  const divisionEntries = selectedDivision ? filtered(participants.filter((participant) => participant.division_id === selectedDivision.id)) : [];
  return <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 2, px: 2, py: 1.5, mb: 2 }}>
    <Dialog open={!!editingParticipant} onClose={() => { if (!savingDivision) setEditingParticipant(null); }} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>대회 부수 수정</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2, fontWeight: 700 }}>{editingParticipant?.name} ({editingParticipant?.club_name || "개인"})</Typography>
        {divisionError && <Alert severity="error" sx={{ mb: 1.5 }}>{divisionError}</Alert>}
        <TextField autoFocus required fullWidth size="small" label="대회 부수" value={divisionDraft} disabled={savingDivision} onChange={(event) => setDivisionDraft(event.target.value)} inputProps={{ maxLength: 40 }} onKeyDown={(event) => { if (event.key === "Enter" && !savingDivision) { event.preventDefault(); void saveDivision(); } }} />
      </DialogContent>
      <DialogActions><Button disabled={savingDivision} onClick={() => setEditingParticipant(null)}>취소</Button><Button variant="contained" disabled={savingDivision || !divisionDraft.trim()} onClick={() => void saveDivision()}>저장</Button></DialogActions>
    </Dialog>
    <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}><Typography fontWeight={900} fontSize={16} sx={{ flex: 1 }}>참가 신청 명단</Typography><Typography fontSize={13} fontWeight={700} color="text.secondary">{participants.length}명</Typography></Stack>
    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>신청 마감 {tournament.application_deadline_at ? new Date(tournament.application_deadline_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "미설정"}</Typography>
    {tournament.status === "draft" && <Alert severity="warning" sx={{ mb: 1 }}>아직 참가 신청이 열리지 않았습니다. 주최자는 대회 정보의 [참가신청 열기]를 눌러주세요.</Alert>}
    {deadlinePassed && canEdit && <Alert severity="info" sx={{ mb: 1 }}>새 참가자 신청은 마감되었습니다. 신청한 명단은 대회 시작 전까지 수정할 수 있습니다.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    <Stack direction="row" spacing={0.8} sx={{ mb: 1.2, pb: 1, borderBottom: "1px solid #E5E7EB" }}><Button size="small" variant={view === "division" ? "contained" : "text"} onClick={() => { setView("division"); setVisibleCount(30); }} sx={pillSx}>부문별</Button><Button size="small" variant={view === "club" ? "contained" : "text"} onClick={() => { setView("club"); setVisibleCount(30); }} sx={pillSx}>클럽별</Button></Stack>
    <TextField size="small" fullWidth placeholder="참가자명 · 부수 · 클럽명 검색" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(30); }} sx={{ mb: 1.2, "& .MuiOutlinedInput-root": { borderRadius: 1.5, height: 36 }, "& input": { fontSize: 13 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "#9CA3AF" }} /></InputAdornment> } }} />
    {isLoading ? <Box sx={{ py: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <>
      {view === "division" && selectedDivision && <><Select fullWidth size="small" value={selectedDivision.id} onChange={(event) => { setDivisionId(String(event.target.value)); setVisibleCount(30); }} sx={{ mb: 1.2, borderRadius: 1.5 }}>{divisions.map((division) => <MenuItem key={division.id} value={division.id}>{division.name} · {participants.filter((participant) => participant.division_id === division.id).length}명</MenuItem>)}</Select>{list(divisionEntries.slice(0, visibleCount))}{divisionEntries.length > visibleCount && <Button fullWidth size="small" onClick={() => setVisibleCount((count) => count + 30)} sx={{ mt: 0.7, fontWeight: 800 }}>더 보기 ({divisionEntries.length - visibleCount}명)</Button>}</>}
      {view === "club" && (selectedClub ? <><Select fullWidth size="small" value={selectedClub.id} onChange={(event) => setClubId(String(event.target.value))} sx={{ mb: 1.2, borderRadius: 1.5 }}>{clubs.map((club) => <MenuItem key={club.id} value={club.id}>{club.name} · {participants.filter((participant) => (participant.source_group_id ?? "individual") === club.id).length}명</MenuItem>)}</Select>{divisions.map((division) => { const entries = filtered(participants.filter((participant) => (participant.source_group_id ?? "individual") === selectedClub.id && participant.division_id === division.id)); return <Box key={division.id} sx={{ mb: 1.5 }}><Typography sx={{ fontSize: 14, fontWeight: 900, py: 0.7 }}>{division.name} · {entries.length}명</Typography>{list(entries)}</Box>; })}</> : <Typography sx={{ fontSize: 13, color: "text.secondary" }}>등록된 클럽 명단이 없습니다.</Typography>)}
    </>}
  </Box>;
}
