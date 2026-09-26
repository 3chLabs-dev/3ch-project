import { useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { useGenerateTournamentPoolsMutation, useGetTournamentParticipantsQuery, useGetTournamentPoolsQuery, useGetTournamentQuery, useLazyPreviewTournamentPoolsQuery, type TournamentPool } from "../../features/tournament/tournamentApi";
import { formatTournamentParticipantName } from "../../features/tournament/participantLabel";

const fullName = (member: TournamentPool["members"][number]) => formatTournamentParticipantName(member);
const pageSize = 12;

export default function TournamentGroups() {
  const { id = "", divisionId = "" } = useParams();
  const navigate = useNavigate();
  const { data: tournamentData, isLoading: loadingTournament } = useGetTournamentQuery(id, { skip: !id });
  const { data: participantData } = useGetTournamentParticipantsQuery({ id, divisionId }, { skip: !id || !divisionId });
  const { data: poolData, isLoading: loadingPools } = useGetTournamentPoolsQuery({ id, divisionId }, { skip: !id || !divisionId });
  const [previewPools, { data: previewData, isFetching: previewing }] = useLazyPreviewTournamentPoolsQuery();
  const [generate, { isLoading: generating }] = useGenerateTournamentPoolsMutation();
  const [groupCount, setGroupCount] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const tournament = tournamentData?.tournament;
  const division = tournament?.divisions?.find((item) => item.id === divisionId);
  const deadlinePassed = tournament ? new Date() >= new Date(tournament.application_deadline_at ?? tournament.starts_at) : false;
  const confirmed = (participantData?.participants ?? []).filter((participant) => participant.status === "confirmed");
  const applied = (participantData?.participants ?? []).filter((participant) => participant.status === "applied");
  const minGroups = Math.ceil(confirmed.length / 5);
  const maxGroups = Math.floor(confirmed.length / 2);
  const suggested = Math.max(minGroups, Math.min(maxGroups, Math.round(confirmed.length / 4)));
  const effectiveCount = groupCount || suggested;
  const savedPools = poolData?.pools ?? [];
  const previewGroups = previewData?.pools ?? [];
  const visiblePools = savedPools.length ? savedPools : previewGroups;
  const filtered = useMemo(() => visiblePools.filter((pool) => !search.trim() || String(pool.pool_no).includes(search.trim().replace(/조/g, "")) || pool.members.some((member) => fullName(member).includes(search.trim()))), [visiblePools, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const showPreview = async () => { setError(""); try { await previewPools({ id, divisionId, groupCount: effectiveCount }).unwrap(); setPage(1); } catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "미리보기를 만들지 못했습니다."); } };
  const publish = async () => {
    if (!previewData || !window.confirm(`${division?.name} ${previewData.pools.length}개 조를 확정하시겠습니까? 참가 신청·확정이 마감되고, 기존 조는 일반 저장으로 덮어쓸 수 없습니다.`)) return;
    setError("");
    try { await generate({ id, divisionId, group_count: effectiveCount, participant_ids: previewData.participant_ids }).unwrap(); }
    catch (reason) { setError((reason as { data?: { message?: string } }).data?.message ?? "조 편성을 저장하지 못했습니다."); }
  };
  if (loadingTournament || loadingPools) return <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>;
  if (!tournament || !division) return <Box sx={{ p: 2 }}><Alert severity="error">대회 부문을 찾을 수 없습니다.</Alert></Box>;
  return <Box sx={{ pb: 4 }}>
    <Stack direction="row" alignItems="center" sx={{ mb: 2 }}><IconButton onClick={() => navigate(`/tournament/${id}`)} size="small" sx={{ mr: 0.5 }}><ArrowBackIcon /></IconButton><Typography fontWeight={900} fontSize={18}>{division.name} 조 편성</Typography></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!savedPools.length && tournament.can_manage && <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 1, p: 2, mb: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 0.5 }}>확정 {confirmed.length}명 · 신청 대기 {applied.length}명</Typography>
      <Typography fontSize={12} color="text.secondary" sx={{ mb: 1.5 }}>같은 클럽의 조 중복을 먼저 줄이고, 클럽이 겹치는 조는 후속 토너먼트에서 가능한 늦게 만나는 배치 순서를 함께 저장합니다.</Typography>
      <Stack direction="row" spacing={1} alignItems="center"><TextField size="small" type="number" label="조 개수" value={effectiveCount || ""} onChange={(event) => { setGroupCount(Number(event.target.value)); setPage(1); }} inputProps={{ min: minGroups, max: maxGroups }} sx={{ width: 110 }} /><Typography fontSize={12} color="text.secondary" sx={{ flex: 1 }}>조당 2~5명 · 권장 {suggested || 0}개 조</Typography><Button variant="outlined" size="small" disabled={previewing || confirmed.length < 2 || effectiveCount < minGroups || effectiveCount > maxGroups} onClick={() => void showPreview()}>미리보기</Button></Stack>
      {previewData && <Button fullWidth variant="contained" sx={{ mt: 1.5 }} disabled={generating || !deadlinePassed || !!applied.length || previewData.pools.length !== effectiveCount} onClick={() => void publish()}>조 편성 확정</Button>}
      {!deadlinePassed && <Alert severity="info" sx={{ mt: 1 }}>참가 신청 마감 이후에 조 편성을 확정할 수 있습니다.</Alert>}
      {!!applied.length && <Alert severity="info" sx={{ mt: 1 }}>신청 대기자를 모두 확정하거나 거절한 뒤 조를 확정할 수 있습니다.</Alert>}
    </Box>}
    {savedPools.length > 0 && <Alert severity="success" sx={{ mb: 1.5 }}>확정된 조 편성입니다. 참가자도 이 페이지에서 결과를 볼 수 있습니다.</Alert>}
    {visiblePools.length > 0 && <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><TextField size="small" fullWidth placeholder="조 번호, 참가자명, 클럽명 검색" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><Typography fontSize={12} color="text.secondary" whiteSpace="nowrap">{filtered.length}개 조</Typography></Stack>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {shown.map((pool) => <Box key={pool.pool_no} sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 1, p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={900} color="primary.main">{pool.pool_no}조</Typography><Typography fontSize={11} color="text.secondary">{pool.members.length}명 · 배치 {pool.bracket_slot}</Typography></Stack>{pool.members.map((member) => <Typography key={member.id} sx={{ py: 0.6, borderTop: "1px solid #F3F4F6", fontSize: 13, fontWeight: 700, color: member.status === "withdrawn" ? "text.disabled" : undefined, textDecoration: member.status === "withdrawn" ? "line-through" : undefined }}>{fullName(member)}{member.status === "withdrawn" ? " · 취소" : ""}</Typography>)}</Box>)}
    </Box>
    {!visiblePools.length && <Box sx={{ bgcolor: "#fff", border: "1px solid #E5E7EB", borderRadius: 1, p: 3, textAlign: "center" }}><Typography color="text.secondary">아직 조 편성 결과가 없습니다.</Typography></Box>}
    {pageCount > 1 && <Stack direction="row" justifyContent="center" spacing={1} alignItems="center" sx={{ mt: 2 }}><Button size="small" variant="outlined" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>이전</Button><Typography fontSize={13}>{Math.min(page, pageCount)} / {pageCount}</Typography><Button size="small" variant="outlined" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>다음</Button></Stack>}
  </Box>;
}
