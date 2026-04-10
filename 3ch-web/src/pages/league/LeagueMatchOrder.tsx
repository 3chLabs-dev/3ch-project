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
  Divider, IconButton, InputAdornment, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, TextField, Typography, Tooltip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragHandleIcon from "@mui/icons-material/DragHandle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  useGetLeagueQuery,
  useGetLeagueMatchesQuery,
  useInitLeagueMatchesMutation,
  useUpdateLeagueMatchMutation,
  useReorderLeagueMatchesMutation,
  useDeleteLeagueMatchMutation,
  useNotifyLeagueMatchMutation,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import { useOutletContext } from "react-router-dom";
import { usePushNotification } from "../../hooks/usePushNotification";

// ─── 상태 표시 ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "시작",
  playing: "진행 중",
  done: "종료",
};

const NEXT_STATUS: Record<string, "pending" | "playing" | "done"> = {
  pending: "playing",
  playing: "done",
  done: "done",
};

function getWinScore(rules?: string | null): number | null {
  if (!rules) return null;
  if (rules.includes("3세트제")) return null;
  if (rules.includes("3전 2선승")) return 2;
  if (rules.includes("5전 3선승")) return 3;
  if (rules.includes("7전 4선승")) return 4;
  return null;
}

// ─── 참가자 행 (번호 + 이름/부 + 점수) ──────────────────────────────────────
/** 테두리 박스 안 참가자 행: [번호셀] | [배지+이름] [점수] */
function ParticipantRow({
  name, division, isMe, score, wins, canEditScore, onMinus, onPlus,
}: {
  name: string | null; division: string | null; isMe?: boolean;
  score: number; wins: boolean; canEditScore: boolean;
  onMinus: () => void; onPlus: () => void;
}) {
  return (
    <Stack direction="row" alignItems="stretch" sx={{ minHeight: 54 }}>
      {/* 왼쪽 번호 셀 */}
      <Box sx={{ width: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1.5px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#C4C9D4" }}>
          {division ?? ""}
        </Typography>
      </Box>

      {/* 배지 + 이름 */}
      <Stack direction="row" alignItems="center" spacing={0.5} flex={1} px={1.5} minWidth={0}>
        {division && (
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", color: "#000", fontSize: 9, fontWeight: 900, flexShrink: 0, px: 0.3 }}>
            {division}
          </Box>
        )}
        <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, color: isMe ? "#2F80ED" : "#111827" }}>
          {name ?? "?"}
        </Typography>
      </Stack>

      {/* -[점수]+ */}
      <Stack direction="row" alignItems="center" sx={{ flexShrink: 0, pr: 1, gap: "4px" }}>
        <Box
          onClick={canEditScore ? onMinus : undefined}
          sx={{ width: 30, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", cursor: canEditScore ? "pointer" : "default", color: "#6B7280", userSelect: "none" }}
        >
          <RemoveIcon sx={{ fontSize: 14 }} />
        </Box>
        <Box sx={{ minWidth: 36, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 18, color: wins ? "#16A34A" : "#111827" }}>{score}</Typography>
        </Box>
        <Box
          onClick={canEditScore ? onPlus : undefined}
          sx={{ width: 30, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", cursor: canEditScore ? "pointer" : "default", color: "#2F80ED", userSelect: "none" }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </Box>
      </Stack>
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
  const [notifyMatch] = useNotifyLeagueMatchMutation();
  const courtRef = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const matchLabel = useCallback(() => {
    const aDiv = match.participant_a_division ? `(${match.participant_a_division})` : "";
    const bDiv = match.participant_b_division ? `(${match.participant_b_division})` : "";
    return `${index + 1}경기\n${aDiv}${match.participant_a_name ?? "?"} VS ${bDiv}${match.participant_b_name ?? "?"}`;
  }, [match, index]);

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
    const sa = match.score_a ?? 0;
    const sb = match.score_b ?? 0;
    if (match.status === "pending") {
      if (!window.confirm(`${matchLabel()}\n시작하겠습니까?`)) return;
    } else if (match.status === "playing") {
      if (!window.confirm(`${matchLabel()}\n종료되었습니까?`)) return;
    }
    updateMatch({ leagueId, matchId: match.id, updates: { status: NEXT_STATUS[match.status], score_a: sa, score_b: sb } });
  }, [match, matchLabel, leagueId, updateMatch]);

  const handleDelete = useCallback(() => {
    setMenuAnchor(null);
    if (!window.confirm(`${matchLabel()}\n경기를 삭제하겠습니까?`)) return;
    deleteMatch({ leagueId, matchId: match.id });
  }, [match, matchLabel, leagueId, deleteMatch]);

  const handleAppNotify = useCallback(async () => {
    setMenuAnchor(null);
    await notifyMatch({ leagueId, matchId: match.id });
  }, [match, leagueId, notifyMatch]);

  const handleKakaoShare = useCallback(() => {
    setMenuAnchor(null);
    const text = `${matchLabel()}\n곧 경기 시작! 지금 입장해 주세요`;
    const kakao = (window as unknown as { Kakao?: { isInitialized?: () => boolean; Share?: { sendDefault: (o: unknown) => void } } }).Kakao;
    if (kakao?.isInitialized?.() && kakao.Share) {
      kakao.Share.sendDefault({
        objectType: "text",
        text,
        link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
      });
    } else {
      navigator.clipboard?.writeText(text).then(() => alert("메시지가 복사되었습니다.\n카카오톡에 붙여넣기 해주세요."));
    }
  }, [matchLabel]);

  const isPlaying = match.status === "playing";
  const isDone = match.status === "done";
  const winScore = getWinScore(rules);
  const sa = match.score_a ?? 0;
  const sb = match.score_b ?? 0;
  const aWins = winScore !== null && isDone && sa === winScore;
  const bWins = winScore !== null && isDone && sb === winScore;
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

        {/* Row 1: n경기 + 드래그 + ⋮ */}
        <Stack direction="row" alignItems="center" mb={1.5}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#9CA3AF", flex: 1 }}>
            {index + 1}경기
          </Typography>
          {canManage && (
            <Box {...attributes} {...listeners} sx={{ cursor: "grab", color: "#D1D5DB", display: "flex", alignItems: "center", mx: 1 }}>
              <DragHandleIcon sx={{ fontSize: 20 }} />
            </Box>
          )}
          {canManage && (
            <>
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: "#9CA3AF", p: 0.3 }}>
                <MoreVertIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem onClick={handleAppNotify}>
                  <ListItemIcon><NotificationsActiveIcon fontSize="small" sx={{ color: "#2F80ED" }} /></ListItemIcon>
                  <ListItemText>앱 알림</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleKakaoShare}>
                  <ListItemIcon>
                    <Box sx={{ width: 20, height: 20, bgcolor: "#FEE500", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>K</Box>
                  </ListItemIcon>
                  <ListItemText>카카오톡 알림</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleDelete} sx={{ color: "#EF4444" }}>
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: "#EF4444" }} /></ListItemIcon>
                  <ListItemText>경기 삭제</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Stack>

        {/* 참가자 박스 (직선 테두리) */}
        <Box sx={{ border: "1.5px solid #E5E7EB", borderRadius: 0, overflow: "hidden" }}>
          <ParticipantRow
            name={match.participant_a_name}
            division={match.participant_a_division}
            isMe={!!myName && match.participant_a_name === myName}
            score={sa} wins={aWins} canEditScore={canEditScore}
            onMinus={() => handleScore("a", -1)}
            onPlus={() => handleScore("a", 1)}
          />
          {/* vs 구분 */}
          <Box sx={{ borderTop: "1.5px solid #E5E7EB", borderBottom: "1.5px solid #E5E7EB", py: 0.4, textAlign: "center", bgcolor: "#FAFAFA" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#C4C9D4" }}>vs</Typography>
          </Box>
          <ParticipantRow
            name={match.participant_b_name}
            division={match.participant_b_division}
            isMe={!!myName && match.participant_b_name === myName}
            score={sb} wins={bWins} canEditScore={canEditScore}
            onMinus={() => handleScore("b", -1)}
            onPlus={() => handleScore("b", 1)}
          />
        </Box>

        {/* Row 4: 코트 + 상태 버튼 */}
        <Stack direction="row" alignItems="center" spacing={1} mt={1.5}>
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
                    <MeetingRoomIcon sx={{ fontSize: 14, color: "#9CA3AF" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: 90,
              flexShrink: 0,
              "& .MuiOutlinedInput-root": { borderRadius: 1.5, bgcolor: "#F9FAFB", height: 40 },
              "& .MuiOutlinedInput-input": { py: 0, fontSize: "0.82rem" },
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={canMember ? handleStatus : undefined}
            disabled={!canMember || isDone}
            sx={{
              py: 1, fontSize: 15, fontWeight: 900, borderRadius: 1.5, height: 40,
              ...(isDone && { bgcolor: "#4B5563", "&.Mui-disabled": { bgcolor: "#4B5563", color: "#fff" } }),
              ...(isPlaying && { bgcolor: "#2F80ED", "&:hover": { bgcolor: "#1E6FD9" } }),
              ...(!isPlaying && !isDone && { bgcolor: "#fff", color: "#374151", border: "1.5px solid #D1D5DB", boxShadow: "none", "&:hover": { bgcolor: "#F9FAFB", boxShadow: "none" } }),
            }}
          >
            {STATUS_LABEL[match.status]}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function LeagueMatchOrder() {
  const { id: leagueId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotification();
  const { scrollToTop } = useOutletContext<{ scrollToTop: () => void }>();

  const { data: leagueData } = useGetLeagueQuery(leagueId, { skip: !leagueId });
  const league = leagueData?.league;
  const groupId = league?.group_id ?? "";

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(groupId, { skip: !groupId });
  const authUser = useAppSelector((s) => s.auth.user);
  const isCreator = !!authUser && league?.created_by_id === authUser?.id;
  const canManage =
    (!groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin")) || isCreator;
  const canMember = (!groupLoading && !!groupData?.myRole) || isCreator || league?.join_permission === "public";
  const myName = groupData?.members?.find((m) => m.user_id === authUser?.id)?.name
    ?? authUser?.name
    ?? (leagueId ? localStorage.getItem(`guestName_${leagueId}`) : null)
    ?? null;

  const { data: matchData, isLoading: matchLoading, refetch: refetchMatches } = useGetLeagueMatchesQuery(leagueId, { skip: !leagueId, refetchOnMountOrArgChange: true });
  const [search, setSearch] = useState("");
  // 순서만 로컬에 보관. 경기 데이터는 항상 RTK Query 캐시에서 가져와야 optimistic update가 즉시 반영됨
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const matches = useMemo(() => {
    // bracket이 있는 경기(토너먼트 경기)는 리그 경기 순서 뷰에서 제외
    const serverMatches = (matchData?.matches ?? []).filter((m) => !m.bracket);
    const ordered = localOrder
      ? localOrder.map((id) => serverMatches.find((m) => m.id === id)).filter((m): m is LeagueMatch => !!m)
      : serverMatches;
    if (!search.trim()) return ordered;
    const q = search.trim().toLowerCase();
    return ordered.filter((m) =>
      [m.participant_a_name, m.participant_b_name, m.participant_a_division, m.participant_b_division]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [localOrder, matchData?.matches, search]);

  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [reorderMatches] = useReorderLeagueMatchesMutation();
  const initCalledRef = useRef(false);

  // 경기 없고 canManage 확정되면 자동 생성 (한 번만) — invalidatesTags로 자동 refetch됨
  useEffect(() => {
    if (!matchData || matchData.matches.length > 0) return;
    if (!canManage) return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initMatches({ id: leagueId });
  }, [matchData, canManage, leagueId, initMatches]);

  const handleRefresh = useCallback(() => {
    setLocalOrder(null);
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
    setLocalOrder(reordered.map((m) => m.id));
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
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate(`/league/${leagueId}/bracket`)}
          sx={{ borderRadius: 1, fontWeight: 700, fontSize: 12, px: 1.5 }}
        >
          대진표 보기
        </Button>
        <Tooltip title={
          pushState === "subscribed" ? "알림 끄기"
          : pushState === "denied" ? "브라우저에서 알림이 차단됨"
          : pushState === "unsupported" ? "이 환경에서는 알림을 지원하지 않습니다"
          : "경기 시작 알림 받기"
        }>
          <span>
            <IconButton
              size="small"
              disabled={pushState === "denied" || pushState === "unsupported"}
              onClick={pushState === "subscribed" ? pushUnsubscribe : pushSubscribe}
              sx={{ color: pushState === "subscribed" ? "#2563EB" : "#9CA3AF" }}
            >
              {pushState === "subscribed"
                ? <NotificationsIcon sx={{ fontSize: 20 }} />
                : <NotificationsOffIcon sx={{ fontSize: 20 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* 검색창 */}
      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="이름 또는 부수 검색"
        size="small"
        fullWidth
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon sx={{ fontSize: 18, color: "#9CA3AF" }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#F9FAFB", fontSize: 14 },
        }}
      />

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
                  myName={myName ?? undefined}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Tooltip title="상단으로">
        <IconButton onClick={scrollToTop} sx={{ position: "absolute", bottom: 117, right: 14, zIndex: 10, bgcolor: "#fff", color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: "#F3F4F6" } }}>
          <ArrowUpwardIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="새로고침">
        <IconButton onClick={handleRefresh} sx={{ position: "absolute", bottom: 67, right: 14, zIndex: 10, bgcolor: "#fff", color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: "#F3F4F6" } }}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
