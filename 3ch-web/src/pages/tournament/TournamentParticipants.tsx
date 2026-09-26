import { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { formatTournamentParticipantName } from "../../features/tournament/participantLabel";
import { useGetTournamentParticipantsAllQuery, useOpenTournamentMutation, useReviewTournamentApplicationMutation, type TournamentItem, type TournamentParticipant } from "../../features/tournament/tournamentApi";

export default function TournamentParticipants({ tournament }: { tournament: TournamentItem }) {
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const { data } = useGetTournamentParticipantsAllQuery(tournament.id);
  const [review, { isLoading: reviewing }] = useReviewTournamentApplicationMutation();
  const [openTournament, { isLoading: opening }] = useOpenTournamentMutation();
  const [view, setView] = useState<"division" | "club">("division");
  const [divisionId, setDivisionId] = useState("");
  const [clubId, setClubId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const participants = data?.participants ?? [];
  const divisions = tournament.divisions ?? [];
  const selectedDivision = divisions.find((division) => division.id === divisionId) ?? divisions[0];
  const clubs = useMemo(() => {
    const found = new Map<string, string>();
    for (const participant of participants) found.set(participant.source_group_id ?? "individual", participant.club_name);
    return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [participants]);
  const selectedClub = clubs.find((club) => club.id === clubId) ?? clubs[0];
  const show = (list: TournamentParticipant[]) => list.filter((participant) => !search.trim() || formatTournamentParticipantName(participant).includes(search.trim()));
  const canEdit = new Date() < new Date(tournament.starts_at);
  const deadlinePassed = new Date() >= new Date(tournament.application_deadline_at ?? tournament.starts_at);
  const reviewParticipant = async (participant: TournamentParticipant, status: "confirmed" | "rejected") => {
    if (status === "rejected" && !window.confirm(`${formatTournamentParticipantName(participant)}의 신청을 거절하시겠습니까?`)) return;
    setError("");
    try { await review({ id: tournament.id, divisionId: participant.division_id, participantId: participant.id, status, ...(status === "rejected" ? { confirmation_intent: "REJECT_TOURNAMENT_APPLICATION" } : {}) }).unwrap(); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "신청 상태를 변경하지 못했습니다."); }
  };
  const list = (entries: TournamentParticipant[]) => entries.length ? <Stack divider={<Divider />}>{entries.map((participant) => <Stack key={participant.id} direction="row" alignItems="center" spacing={0.8} sx={{ py: 0.8 }}><Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>{formatTournamentParticipantName(participant)}</Typography><Chip size="small" label={participant.status === "confirmed" ? "확정" : "신청"} color={participant.status === "confirmed" ? "primary" : "default"} />{tournament.can_manage && participant.status === "applied" && canEdit && <><Button size="small" disabled={reviewing} onClick={() => void reviewParticipant(participant, "confirmed")}>확정</Button><Button size="small" color="error" disabled={reviewing} onClick={() => void reviewParticipant(participant, "rejected")}>거절</Button></>}</Stack>)}</Stack> : <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1 }}>등록된 참가자가 없습니다.</Typography>;
  return <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 1, px: 2, py: 1.5, mb: 2 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={900} fontSize={16} sx={{ flex: 1 }}>참가 신청 · 명단</Typography>{tournament.can_manage && tournament.status === "draft" && <Button size="small" variant="outlined" disabled={opening} onClick={async () => { try { await openTournament(tournament.id).unwrap(); } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "신청을 열지 못했습니다."); } }}>신청 열기</Button>}</Stack>
    <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>신청 마감 {tournament.application_deadline_at ? new Date(tournament.application_deadline_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "미설정"} · 총 {participants.length}명</Typography>
    {deadlinePassed && canEdit && <Alert severity="info" sx={{ mb: 1 }}>새 참가자 신청은 마감되었습니다. 신청한 명단은 대회 시작 전까지 수정할 수 있습니다.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    {canEdit && <Button fullWidth variant="contained" sx={{ mb: 1.5, fontWeight: 900 }} onClick={() => token ? navigate(`/tournament/${tournament.id}/apply`) : navigate("/login")}>참가신청 · 명단 수정</Button>}
    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}><Button fullWidth variant={view === "division" ? "contained" : "outlined"} onClick={() => setView("division")} sx={{ fontWeight: 800 }}>부문별</Button><Button fullWidth variant={view === "club" ? "contained" : "outlined"} onClick={() => setView("club")} sx={{ fontWeight: 800 }}>클럽별</Button></Stack>
    <TextField size="small" fullWidth placeholder="참가자명 · 클럽명 검색" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 1.5 }} />
    {view === "division" && selectedDivision && <><Select fullWidth size="small" value={selectedDivision.id} onChange={(event) => setDivisionId(String(event.target.value))} sx={{ mb: 1 }}>{divisions.map((division) => <MenuItem key={division.id} value={division.id}>{division.name} · {participants.filter((participant) => participant.division_id === division.id).length}명</MenuItem>)}</Select>{list(show(participants.filter((participant) => participant.division_id === selectedDivision.id)))}{['GROUP', 'GROUP_TOURNAMENT'].includes(selectedDivision.rounds[0]?.format) && <Button fullWidth variant="outlined" sx={{ mt: 1.5, fontWeight: 800 }} onClick={() => navigate(`/tournament/${tournament.id}/divisions/${selectedDivision.id}/groups`)}>조 편성 결과 보기</Button>}</>}
    {view === "club" && (selectedClub ? <><Select fullWidth size="small" value={selectedClub.id} onChange={(event) => setClubId(String(event.target.value))} sx={{ mb: 1 }}>{clubs.map((club) => <MenuItem key={club.id} value={club.id}>{club.name} · {participants.filter((participant) => (participant.source_group_id ?? "individual") === club.id).length}명</MenuItem>)}</Select>{divisions.map((division) => { const entries = show(participants.filter((participant) => (participant.source_group_id ?? "individual") === selectedClub.id && participant.division_id === division.id)); return <Box key={division.id} sx={{ mb: 1.5 }}><Typography sx={{ fontSize: 14, fontWeight: 900, py: 0.6 }}>{division.name} · {entries.length}명</Typography><Divider />{list(entries)}</Box>; })}</> : <Typography sx={{ fontSize: 13, color: "text.secondary" }}>등록된 클럽 명단이 없습니다.</Typography>)}
  </Box>;
}
