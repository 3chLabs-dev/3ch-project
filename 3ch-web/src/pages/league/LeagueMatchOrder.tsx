import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box, Button, Card, CardContent, CircularProgress,
  IconButton, InputAdornment, Stack, TextField, Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import RefreshIcon from "@mui/icons-material/Refresh";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  useGetLeagueQuery,
  useGetLeagueMatchesQuery,
  useInitLeagueMatchesMutation,
  useUpdateLeagueMatchMutation,
  useReorderLeagueMatchesMutation,
  useDeleteLeagueMatchMutation,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";

// ─── 상태 표시 ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "시작",
  playing: "저장",
  done: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#6B7280",
  playing: "#2F80ED",
  done: "#10B981",
};
const NEXT_STATUS: Record<string, "pending" | "playing" | "done"> = {
  pending: "playing",
  playing: "done",
  done: "done",
};

// ─── 참가자 표시 ──────────────────────────────────────────────────────────────
function ParticipantLabel({ name, division, isMe }: { name: string | null; division: string | null; isMe?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {division && (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", bgcolor: "#FAAA47", color: "#000", fontSize: 9, fontWeight: 900, flexShrink: 0 }}>
          {division}
        </Box>
      )}
      <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, color: isMe ? "#2F80ED" : "inherit" }}>
        {name ?? "?"}
      </Typography>
    </Stack>
  );
}

// ─── 경기 카드 ────────────────────────────────────────────────────────────────
function MatchCard({
  match, index, canManage, canMember, leagueId, rules, myName,
}: {
  match: LeagueMatch;
  index: number;
  canManage: boolean;
  canMember: boolean;
  leagueId: string;
  rules?: string | null;
  myName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id, disabled: !canManage });
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [deleteMatch] = useDeleteLeagueMatchMutation();
  const courtRef = useRef<HTMLInputElement>(null);

  const handleScore = useCallback((side: "a" | "b", delta: number) => {
    const current = side === "a" ? (match.score_a ?? 0) : (match.score_b ?? 0);
    const next = Math.max(0, current + delta);
    updateMatch({ leagueId, matchId: match.id, updates: side === "a" ? { score_a: next } : { score_b: next } });
  }, [match, leagueId, updateMatch]);

  const handleCourtBlur = useCallback(() => {
    const val = courtRef.current?.value ?? "";
    if (val !== (match.court ?? "")) {
      updateMatch({ leagueId, matchId: match.id, updates: { court: val || null } });
    }
  }, [match, leagueId, updateMatch]);

  const handleStatus = useCallback(() => {
    const aDiv = match.participant_a_division ? `(${match.participant_a_division})` : "";
    const bDiv = match.participant_b_division ? `(${match.participant_b_division})` : "";
    const aName = match.participant_a_name ?? "?";
    const bName = match.participant_b_name ?? "?";
    const sa = match.score_a ?? 0;
    const sb = match.score_b ?? 0;
    if (match.status === "pending") {
      const msg = `${index + 1}경기\n${aDiv}${aName}(${sa}) VS (${sb})${bDiv}${bName}\n시작하겠습니까?`;
      if (!window.confirm(msg)) return;
    } else if (match.status === "playing") {
      const msg = `${index + 1}경기\n${aDiv}${aName}(${sa}) VS (${sb})${bDiv}${bName}\n종료되었습니까?`;
      if (!window.confirm(msg)) return;
    }
    updateMatch({ leagueId, matchId: match.id, updates: { status: NEXT_STATUS[match.status], score_a: sa, score_b: sb } });
  }, [match, index, leagueId, updateMatch]);

  const handleDelete = useCallback(() => {
    deleteMatch({ leagueId, matchId: match.id });
  }, [match, leagueId, deleteMatch]);

  const isPlaying = match.status === "playing";
  const isDone = match.status === "done";
  const is3set = rules?.includes("3세트제");
  const sa = match.score_a ?? 0;
  const sb = match.score_b ?? 0;
  const aWins = !is3set && isDone && sa > sb;
  const bWins = !is3set && isDone && sb > sa;
  const canEditScore = canMember && (isPlaying || isDone);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      elevation={2}
      sx={{
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        ...(isPlaying && { bgcolor: "#EFF6FF", border: "1.5px solid #2F80ED" }),
        ...(isDone && { bgcolor: "#F3F4F6", border: "1.5px solid #D1D5DB" }),
      }}
    >
      <CardContent sx={{ py: 1.5, px: 1.5, "&:last-child": { pb: 1.5 } }}>

        {/* Row 1: 선수 이름 + VS + 삭제 */}
        <Stack direction="row" alignItems="center" mb={1}>
          <Box flex={1} display="flex" justifyContent="center" alignItems="center" gap={1.5} flexWrap="wrap">
            <ParticipantLabel name={match.participant_a_name} division={match.participant_a_division} isMe={!!myName && match.participant_a_name === myName} />
            <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#9CA3AF" }}>VS</Typography>
            <ParticipantLabel name={match.participant_b_name} division={match.participant_b_division} isMe={!!myName && match.participant_b_name === myName} />
          </Box>
          {canManage && (
            <IconButton size="small" onClick={handleDelete} sx={{ color: "#D1D5DB", p: 0.3, flexShrink: 0 }}>
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Stack>

        {/* Row 2: 경기번호 좌측 / -[A]+ VS -[B]+ 중앙 / 상태버튼+드래그 우측 */}
        <Stack direction="row" alignItems="center">
          <Typography sx={{ fontWeight: 700, fontSize: 12, color: "#9CA3AF", minWidth: 34, flexShrink: 0 }}>
            {index + 1}경기
          </Typography>

          <Box flex={1} display="flex" justifyContent="center" alignItems="center" gap={0.5}>
            {canEditScore && (
              <IconButton size="small" onClick={() => handleScore("a", -1)} sx={{ p: 0.3, color: "#6B7280" }}>
                <RemoveIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            <Box sx={{ minWidth: 32, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
              <Typography sx={{ fontWeight: 900, fontSize: 17, color: aWins ? "#16A34A" : "#111827" }}>{sa}</Typography>
            </Box>
            {canEditScore && (
              <IconButton size="small" onClick={() => handleScore("a", 1)} sx={{ p: 0.3, color: "#2F80ED" }}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}

            <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#9CA3AF", px: 0.3 }}>VS</Typography>

            {canEditScore && (
              <IconButton size="small" onClick={() => handleScore("b", -1)} sx={{ p: 0.3, color: "#6B7280" }}>
                <RemoveIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            <Box sx={{ minWidth: 32, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
              <Typography sx={{ fontWeight: 900, fontSize: 17, color: bWins ? "#16A34A" : "#111827" }}>{sb}</Typography>
            </Box>
            {canEditScore && (
              <IconButton size="small" onClick={() => handleScore("b", 1)} sx={{ p: 0.3, color: "#2F80ED" }}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>

          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button
              size="small"
              onClick={canMember ? handleStatus : undefined}
              disabled={!canMember}
              sx={{
                minWidth: "auto", px: 1, py: 0.3, fontSize: 11, fontWeight: 700, borderRadius: 1,
                bgcolor: STATUS_COLOR[match.status] + "22",
                color: STATUS_COLOR[match.status],
                "&:hover": { bgcolor: STATUS_COLOR[match.status] + "33" },
                "&.Mui-disabled": { color: STATUS_COLOR[match.status], bgcolor: STATUS_COLOR[match.status] + "22" },
              }}
            >
              {STATUS_LABEL[match.status]}
            </Button>
            {canManage && (
              <Box {...attributes} {...listeners} sx={{ cursor: "grab", color: "#D1D5DB", display: "flex", alignItems: "center" }}>
                <DragHandleIcon sx={{ fontSize: 20 }} />
              </Box>
            )}
          </Stack>
        </Stack>

        {/* Row 3: 코트 입력 (중앙 정렬) */}
        <Box mt={1} display="flex" justifyContent="center">
          <TextField
            inputRef={courtRef}
            defaultValue={match.court ?? ""}
            key={match.court ?? ""}
            placeholder="코트"
            size="small"
            disabled={!canMember}
            onBlur={handleCourtBlur}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <MeetingRoomIcon sx={{ fontSize: 15, color: "#9CA3AF" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: 100,
              "& .MuiOutlinedInput-root": { borderRadius: 1, bgcolor: "#F9FAFB", height: 32 },
              "& .MuiOutlinedInput-input": { py: 0, fontSize: "0.82rem" },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function LeagueMatchOrder() {
  const { id: leagueId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: leagueData } = useGetLeagueQuery(leagueId, { skip: !leagueId });
  const league = leagueData?.league;
  const groupId = league?.group_id ?? "";

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(groupId, { skip: !groupId });
  const canManage =
    !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");
  const canMember = !groupLoading && !!groupData?.myRole;

  const authUser = useAppSelector((s) => s.auth.user);
  const myName = groupData?.members?.find((m) => m.user_id === authUser?.id)?.name;

  const { data: matchData, isLoading: matchLoading, refetch: refetchMatches } = useGetLeagueMatchesQuery(leagueId, { skip: !leagueId, refetchOnMountOrArgChange: true });
  const [localMatches, setLocalMatches] = useState<LeagueMatch[] | null>(null);
  const matches = useMemo(() => localMatches ?? matchData?.matches ?? [], [localMatches, matchData?.matches]);

  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [reorderMatches] = useReorderLeagueMatchesMutation();
  const initCalledRef = useRef(false);

  // 경기 없고 canManage 확정되면 자동 생성 (한 번만)
  useEffect(() => {
    if (!matchData || matchData.matches.length > 0) return;
    if (!canManage) return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initMatches({ id: leagueId }).then((res) => {
      if ("data" in res && res.data) setLocalMatches(res.data.matches);
    });
  }, [matchData, canManage, leagueId, initMatches]);

  const handleRefresh = useCallback(() => {
    setLocalMatches(null);
    refetchMatches();
  }, [refetchMatches]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = matches.findIndex((m) => m.id === active.id);
    const newIdx = matches.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(matches, oldIdx, newIdx);
    setLocalMatches(reordered);
    reorderMatches({ leagueId, order: reordered.map((m) => m.id) });
  }, [matches, leagueId, reorderMatches]);


  if (matchLoading) {
    return (
      <Box display="flex" justifyContent="center" pt={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* 상단 헤더 */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ p: 0.5, color: "#374151" }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={900} flex={1}>
          경기 순서
        </Typography>
        {canManage && matches.length > 0 && (
          <IconButton size="small" onClick={handleRefresh} disabled={matchLoading} sx={{ color: "#9CA3AF" }} title="새로고침">
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate(`/league/${leagueId}/bracket`)}
          sx={{ borderRadius: 1, fontWeight: 700, fontSize: 12, px: 1.5 }}
        >
          대진표 보기
        </Button>
      </Stack>

      {/* 생성 중 / 경기 없을 때 */}
      {matches.length === 0 ? (
        <Box display="flex" justifyContent="center" pt={4}>
          {isIniting ? (
            <CircularProgress />
          ) : (
            <Typography color="text.secondary" fontWeight={700} fontSize={14}>
              참가자가 없어 경기를 생성할 수 없습니다.
            </Typography>
          )}
        </Box>
      ) : (
        /* 경기 목록 */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={matches.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1}>
              {matches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  index={i}
                  canManage={canManage}
                  canMember={canMember}
                  leagueId={leagueId}
                  rules={league?.rules}
                  myName={myName}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
}
