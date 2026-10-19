import { useMemo, useState } from "react";
import { Alert, Autocomplete, Box, Button, CircularProgress, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import LoadMembersDialog from "../league/LoadMembersDialog";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGetGroupDetailQuery, useSearchGroupsQuery } from "../../features/group/groupApi";
import { useGetTournamentQuery, useGetTournamentParticipantsAllQuery, useRegisterTournamentParticipantsMutation, useWithdrawTournamentParticipantMutation } from "../../features/tournament/tournamentApi";
import { formatTournamentParticipantName } from "../../features/tournament/participantLabel";

type Row = { key: string; division_id: string; name: string; member_division: string; member_id?: number | null; pre_member_id?: string | null };
export default function TournamentManageParticipants() {
  const { id = "" } = useParams(); const navigate = useNavigate();
  const { data, isLoading } = useGetTournamentQuery(id);
  const { data: roster } = useGetTournamentParticipantsAllQuery(id);
  const tournament = data?.tournament;
  const [club, setClub] = useState<{ id: string; name: string } | null>(null);
  const [clubQuery, setClubQuery] = useState("");
  const { data: search } = useSearchGroupsQuery({ q: clubQuery, include_joined: true, limit: 20 }, { skip: !clubQuery.trim() });
  const { data: clubDetail } = useGetGroupDetailQuery(club?.id ?? "", { skip: !club });
  const [rows, setRows] = useState<Row[]>([]);
  const [divisionId, setDivisionId] = useState(""); const [name, setName] = useState(""); const [rank, setRank] = useState("");
  const [error, setError] = useState(""); const [loadOpen, setLoadOpen] = useState(false);
  const [register, { isLoading: saving }] = useRegisterTournamentParticipantsMutation();
  const [withdraw, { isLoading: withdrawing }] = useWithdrawTournamentParticipantMutation();
  const selectedDivision = divisionId || tournament?.divisions?.[0]?.id || "";
  const clubs = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (tournament) map.set(tournament.host_group_id, { id: tournament.host_group_id, name: tournament.host_group_name || "주최 클럽" });
    for (const person of roster?.participants ?? []) if (person.source_group_id) map.set(person.source_group_id, { id: person.source_group_id, name: person.club_name });
    for (const group of search?.groups ?? []) map.set(group.id, { id: group.id, name: group.name });
    if (club) map.set(club.id, club);
    return [...map.values()];
  }, [tournament, roster, search, club]);
  if (isLoading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>;
  if (!tournament?.can_manage) return <Alert severity="warning">대회 관리 권한이 필요합니다.</Alert>;
  const append = (incoming: Row[]) => setRows((current) => {
    const keys = new Set(current.map((row) => row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : `name:${row.name}`));
    return [...current, ...incoming.filter((row) => { const key = row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : `name:${row.name}`; if (keys.has(key)) return false; keys.add(key); return true; })];
  });
  const save = async () => {
    if (!rows.length || rows.some((row) => !row.member_division.trim())) { setError("모든 참가자의 대회 부수를 입력해주세요."); return; }
    try { await register({ id, group_id: club?.id ?? null, rows: rows.map(({ key: _key, ...row }) => row) }).unwrap(); navigate(`/tournament/${id}`); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message || "참가자를 등록하지 못했습니다."); }
  };
  return <Box sx={{ pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton size="small" onClick={() => navigate(`/tournament/${id}`)}><ArrowBackIcon /></IconButton><Typography fontSize={20} fontWeight={900}>참가자 추가/삭제</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Autocomplete options={clubs} value={club} getOptionLabel={(option) => option.name} isOptionEqualToValue={(a, b) => a.id === b.id} onInputChange={(_, value) => setClubQuery(value)} onChange={(_, value) => { if (rows.length && !window.confirm("등록 전 참가자 목록을 비우고 클럽을 변경하시겠습니까?")) return; setClub(value); setRows([]); }} renderInput={(params) => <TextField {...params} label="참가 클럽 검색 · 미선택 시 개인" size="small" />} sx={{ mb: 2 }} />
    <TextField select fullWidth size="small" label="참가 부문" value={selectedDivision} onChange={(event) => setDivisionId(event.target.value)} sx={{ mb: 1.5 }}>{tournament.divisions?.map((division) => <MenuItem key={division.id} value={division.id}>{division.name}</MenuItem>)}</TextField>
    {club && clubDetail?.members?.length ? <Button fullWidth variant="outlined" sx={{ mb: 1.5 }} onClick={() => setLoadOpen(true)}>클럽 회원 불러오기</Button> : null}
    <Stack direction="row" spacing={0.7} sx={{ mb: 2 }}><TextField size="small" label="이름" value={name} onChange={(event) => setName(event.target.value)} sx={{ flex: 1 }} /><TextField size="small" label="대회 부수" value={rank} onChange={(event) => setRank(event.target.value)} sx={{ width: 80 }} /><Button variant="contained" disabled={!name.trim() || !rank.trim()} onClick={() => { append([{ key: crypto.randomUUID(), division_id: selectedDivision, name: name.trim(), member_division: rank.trim() }]); setName(""); setRank(""); }}>추가</Button></Stack>
    {tournament.divisions?.map((division) => <Box key={division.id} sx={{ mb: 2 }}>
      <Typography fontWeight={900} sx={{ borderBottom: "1px solid #D9DDE6", pb: 0.7, mb: 0.7 }}>{division.name}</Typography>
      {rows.filter((row) => row.division_id === division.id).map((row) => <Stack key={row.key} direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.7 }}><Typography sx={{ flex: 1 }}>{row.name}</Typography><TextField size="small" placeholder="부수 *" value={row.member_division} inputProps={{ maxLength: 40 }} onChange={(event) => setRows((current) => current.map((entry) => entry.key === row.key ? { ...entry, member_division: event.target.value } : entry))} sx={{ width: 70 }} /><Button color="error" onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}>삭제</Button></Stack>)}
      {(roster?.participants ?? []).filter((person) => person.division_id === division.id && person.source_group_id === (club?.id ?? null)).map((person) => <Stack key={person.id} direction="row" alignItems="center" sx={{ py: 0.8, borderBottom: "1px solid #F3F4F6" }}><Typography fontSize={13} sx={{ flex: 1 }}>{formatTournamentParticipantName(person)}</Typography>{person.can_withdraw === true && <Button color="error" size="small" disabled={withdrawing} onClick={async () => { if (!window.confirm(`${person.name}의 참가 신청을 취소하시겠습니까? 조 배정이나 경기가 있으면 취소할 수 없습니다.`)) return; try { await withdraw({ id, participantId: person.id, confirmation_intent: "WITHDRAW_TOURNAMENT_PARTICIPANT" }).unwrap(); } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message || "참가를 취소하지 못했습니다."); } }}>취소</Button>}</Stack>)}
    </Box>)}
    <Button fullWidth variant="contained" disabled={saving || !rows.length} onClick={() => void save()}>참가자 등록</Button>
    {club && <LoadMembersDialog
      open={loadOpen}
      groupId={club.id}
      onClose={() => setLoadOpen(false)}
      onConfirm={(selected) => {
        append(selected.map((member) => ({
          key: crypto.randomUUID(),
          division_id: selectedDivision,
          name: member.name,
          // 대회 부수는 클럽 부수와 별개로 반드시 입력합니다.
          member_division: "",
          member_id: member.is_pre_member ? null : member.member_id,
          pre_member_id: member.is_pre_member ? member.id.slice(4) : null,
        })));
        setLoadOpen(false);
      }}
    />}
  </Box>;
}
