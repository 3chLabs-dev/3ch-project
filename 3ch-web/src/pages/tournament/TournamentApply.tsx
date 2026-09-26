import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { useGetGroupDetailQuery, useGetMyGroupsQuery } from "../../features/group/groupApi";
import { useGetTournamentApplicationRosterQuery, useGetTournamentQuery, useSaveTournamentApplicationRosterMutation } from "../../features/tournament/tournamentApi";

type DraftRow = { key: string; id?: string; division_id: string; name: string; member_division: string; member_id: number | null; pre_member_id: string | null; cancel: boolean };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 0.6, bgcolor: "#fff", height: 34 }, "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.9rem" } };
let nextKey = 0;
const makeKey = () => `local-${++nextKey}`;

export default function TournamentApply() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const { data: tournamentData, isLoading: loadingTournament } = useGetTournamentQuery(id, { skip: !id });
  const { data: groupData } = useGetMyGroupsQuery(undefined, { skip: !token });
  const [mode, setMode] = useState("individual");
  const groupId = mode === "individual" ? null : mode;
  const { currentData: rosterData, isFetching: loadingRoster } = useGetTournamentApplicationRosterQuery({ id, groupId }, { skip: !id || !token });
  const { data: groupDetail } = useGetGroupDetailQuery(groupId ?? "", { skip: !groupId });
  const [saveRoster, { isLoading: saving }] = useSaveTournamentApplicationRosterMutation();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [addDivisionId, setAddDivisionId] = useState("");
  const [name, setName] = useState("");
  const [memberDivision, setMemberDivision] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const tournament = tournamentData?.tournament;
  const divisions = tournament?.divisions ?? [];
  const selectedDivisionId = divisions.some((division) => division.id === addDivisionId) ? addDivisionId : divisions[0]?.id ?? "";
  const managers = useMemo(() => (groupData?.groups ?? []).filter((group) => group.role === "owner" || group.role === "admin" && group.management_permissions?.league), [groupData]);
  const clubMembers = useMemo(() => (groupDetail?.members ?? []).filter((member) => member.is_pre_member || member.user_id !== null), [groupDetail]);
  const canEdit = !!tournament && new Date() < new Date(tournament.starts_at);
  const canAdd = canEdit && !!tournament && new Date() < new Date(tournament.application_deadline_at ?? tournament.starts_at) && (tournament.can_apply || tournament.can_manage);
  const deadlineText = tournament?.application_deadline_at ? new Date(tournament.application_deadline_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "미설정";
  useEffect(() => {
    if (!rosterData) return;
    setRows(rosterData.participants.map((participant) => ({ key: participant.id, id: participant.id, division_id: participant.division_id, name: participant.name, member_division: participant.member_division ?? "", member_id: participant.member_id, pre_member_id: participant.pre_member_id ?? null, cancel: false })));
    setDirty(false);
  }, [rosterData]);
  const changeMode = (value: string) => {
    if (dirty && !window.confirm("저장하지 않은 신청 명단을 버리고 클럽을 변경하시겠습니까?")) return;
    setMode(value); setRows([]); setDirty(false); setError("");
  };
  const updateRow = (key: string, patch: Partial<DraftRow>) => { setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row)); setDirty(true); };
  const appendRows = (newRows: DraftRow[]) => {
    const keys = new Set(rows.map((row) => row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : `manual:${row.division_id}:${row.name}`));
    const unique = newRows.filter((row) => { const key = row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : `manual:${row.division_id}:${row.name}`; if (keys.has(key)) return false; keys.add(key); return true; });
    if (unique.length) { setRows((current) => [...current, ...unique]); setDirty(true); }
  };
  const addManual = () => {
    if (!selectedDivisionId || !name.trim()) { setError("부문과 이름을 입력해주세요."); return; }
    appendRows([{ key: makeKey(), division_id: selectedDivisionId, name: name.trim(), member_division: memberDivision.trim(), member_id: groupId ? null : user?.id ?? null, pre_member_id: null, cancel: false }]);
    setName(""); setMemberDivision(""); setError("");
  };
  const loadMembers = () => {
    const selected = clubMembers.filter((member) => selectedMembers.includes(member.id));
    appendRows(selected.map((member) => ({ key: makeKey(), division_id: selectedDivisionId, name: member.name ?? "", member_division: member.division ?? "", member_id: member.is_pre_member ? null : member.user_id, pre_member_id: member.is_pre_member ? member.id : null, cancel: false })));
    setSelectedMembers([]); setLoadOpen(false);
  };
  const submit = async () => {
    if (!canEdit || !rows.length) { setError("신청할 참가자를 등록해주세요."); return; }
    if (rows.some((row) => !row.name.trim() || !row.division_id || row.member_division.length > 40)) { setError("참가자 이름, 부문, 부수를 확인해주세요."); return; }
    const canceled = rows.filter((row) => row.id && row.cancel);
    if (canceled.length && !window.confirm(`${canceled.map((row) => row.name).join(", ")} 참가 신청을 취소하시겠습니까? 기존 경기 결과가 있으면 취소할 수 없습니다.`)) return;
    setError("");
    try {
      await saveRoster({ id, group_id: groupId, rows: rows.map((row) => ({ ...(row.id ? { id: row.id } : {}), division_id: row.division_id, name: row.name.trim(), member_division: row.member_division.trim() || null, member_id: row.member_id, pre_member_id: row.pre_member_id, ...(row.cancel ? { cancel: true } : {}) })), ...(canceled.length ? { confirmation_intent: "CANCEL_TOURNAMENT_PARTICIPANTS" as const } : {}) }).unwrap();
      navigate(`/tournament/${id}`, { replace: true });
    } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "신청 명단을 저장하지 못했습니다."); }
  };
  if (!token) return <Box sx={{ p: 2 }}><Alert severity="info">로그인 후 참가 신청할 수 있습니다.</Alert><Button onClick={() => navigate("/login")}>로그인</Button></Box>;
  if (loadingTournament) return <Box sx={{ textAlign: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!tournament) return <Box sx={{ p: 2 }}><Alert severity="error">대회를 찾을 수 없습니다.</Alert></Box>;
  return <Box sx={{ px: 2.5, pt: 2, pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}><IconButton size="small" onClick={() => navigate(`/tournament/${id}`)}><ArrowBackIcon /></IconButton><Typography sx={{ fontSize: 22, fontWeight: 900 }}>대회 참가 신청</Typography></Stack>
    <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{tournament.title}</Typography><Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>신청 마감: {deadlineText} · 제출한 명단은 대회 시작 전까지 수정할 수 있습니다.</Typography><Divider sx={{ mb: 2 }} />
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {!canAdd && canEdit && <Alert severity="info" sx={{ mb: 1.5 }}>신규 신청 기간이 지났습니다. 제출한 참가자 명단은 대회 시작 전까지 수정하거나 취소할 수 있습니다.</Alert>}
    {!canEdit && <Alert severity="warning" sx={{ mb: 1.5 }}>대회가 시작되어 신청 명단을 수정할 수 없습니다.</Alert>}
    <TextField select fullWidth size="small" label="신청 구분 · 클럽" value={mode} onChange={(event) => changeMode(String(event.target.value))} sx={{ mb: 2 }}><MenuItem value="individual">개인 (클럽명: 개인)</MenuItem>{managers.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}</TextField>
    {loadingRoster && <Box sx={{ textAlign: "center", py: 2 }}><CircularProgress size={22} /></Box>}
    {!loadingRoster && divisions.map((division) => <Box key={division.id} sx={{ mb: 2 }}><Stack direction="row" alignItems="center" sx={{ mb: 0.6 }}><Typography sx={{ fontSize: 17, fontWeight: 900, flex: 1 }}>{division.name}</Typography><Typography sx={{ fontSize: 12, color: "text.secondary" }}>{rows.filter((row) => row.division_id === division.id && !row.cancel).length}명</Typography></Stack><Divider />
      {rows.filter((row) => row.division_id === division.id).map((row) => <Box key={row.key} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 62px 72px", gap: 0.6, alignItems: "center", py: 0.6, borderBottom: "1px solid #ECEFF5", opacity: row.cancel ? 0.5 : 1 }}><TextField size="small" value={row.name} disabled={!canEdit || !!row.cancel} onChange={(event) => updateRow(row.key, { name: event.target.value })} sx={fieldSx} inputProps={{ "aria-label": "참가자 이름" }} /><TextField size="small" value={row.member_division} disabled={!canEdit || !!row.cancel} onChange={(event) => updateRow(row.key, { member_division: event.target.value })} sx={fieldSx} inputProps={{ "aria-label": "참가자 부수" }} /><Button size="small" color={row.cancel ? "primary" : "error"} disabled={!canEdit} onClick={() => { if (row.id) updateRow(row.key, { cancel: !row.cancel }); else { setRows((current) => current.filter((item) => item.key !== row.key)); setDirty(true); } }}>{row.cancel ? "되돌리기" : row.id ? "취소" : "삭제"}</Button>
        {!row.cancel && divisions.length > 1 && <TextField select size="small" value={row.division_id} disabled={!canEdit} onChange={(event) => updateRow(row.key, { division_id: String(event.target.value) })} sx={{ gridColumn: "1 / -1" }} label="참가 부문">{divisions.map((option) => <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>)}</TextField>}
      </Box>)}
      {!rows.some((row) => row.division_id === division.id) && <Typography sx={{ py: 1, fontSize: 13, color: "text.secondary" }}>등록된 참가자가 없습니다.</Typography>}
    </Box>)}
    {canAdd && <Box sx={{ borderTop: "1px solid #D9DDE6", pt: 1.5, mb: 2 }}><Typography sx={{ fontSize: 16, fontWeight: 900, mb: 1 }}>참가자 추가</Typography><TextField select fullWidth size="small" label="부문" value={selectedDivisionId} onChange={(event) => setAddDivisionId(String(event.target.value))} sx={{ mb: 1 }}>{divisions.map((division) => <MenuItem key={division.id} value={division.id}>{division.name}</MenuItem>)}</TextField>
      {groupId && <Button fullWidth variant="outlined" sx={{ mb: 1, fontWeight: 800 }} onClick={() => setLoadOpen(true)}>클럽 회원 불러오기</Button>}
      <Box component="form" onSubmit={(event) => { event.preventDefault(); addManual(); }} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 66px 62px", gap: 0.6 }}><TextField size="small" placeholder="이름" value={name} onChange={(event) => setName(event.target.value)} sx={fieldSx} /><TextField size="small" placeholder="부수" value={memberDivision} onChange={(event) => setMemberDivision(event.target.value)} sx={fieldSx} /><Button type="submit" variant="contained" sx={{ fontWeight: 800 }}>추가</Button></Box>
    </Box>}
    <Stack direction="row" spacing={1}><Button fullWidth variant="contained" color="inherit" onClick={() => navigate(`/tournament/${id}`)} sx={{ height: 44, fontWeight: 900 }}>이전</Button><Button fullWidth variant="contained" disabled={saving || loadingRoster || !canEdit || !rows.length} onClick={() => void submit()} sx={{ height: 44, fontWeight: 900 }}>신청 명단 저장</Button></Stack>
    <Dialog open={loadOpen} onClose={() => setLoadOpen(false)} fullWidth maxWidth="sm"><DialogTitle sx={{ fontWeight: 900 }}>클럽 회원 불러오기</DialogTitle><DialogContent dividers><Typography sx={{ fontSize: 13, mb: 1, color: "text.secondary" }}>선택한 회원을 {divisions.find((division) => division.id === selectedDivisionId)?.name}에 추가합니다.</Typography><Box sx={{ maxHeight: 400, overflowY: "auto" }}>{clubMembers.map((member) => <FormControlLabel key={member.id} sx={{ display: "flex", mx: 0 }} control={<Checkbox checked={selectedMembers.includes(member.id)} onChange={(event) => setSelectedMembers((current) => event.target.checked ? [...current, member.id] : current.filter((value) => value !== member.id))} />} label={`${member.name ?? ""}${member.division ? ` ${member.division}` : ""}${member.is_pre_member ? " · 사전등록" : ""}`} />)}</Box></DialogContent><DialogActions><Button onClick={() => setLoadOpen(false)}>취소</Button><Button variant="contained" disabled={!selectedMembers.length} onClick={loadMembers}>선택한 {selectedMembers.length}명 추가</Button></DialogActions></Dialog>
  </Box>;
}
