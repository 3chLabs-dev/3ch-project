import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box, Button, CircularProgress, IconButton, Paper, Popover,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ScreenRotationIcon from "@mui/icons-material/ScreenRotation";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatLeagueDate } from "../../utils/dateUtils";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueMatchesQuery,
  useUpdateLeagueMatchMutation,
  useReorderLeagueParticipantsMutation,
  type LeagueParticipantItem,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";

function getWinScore(rules?: string | null): number | null {
  if (!rules) return null;
  if (rules.includes("3세트제")) return null;
  if (rules.includes("3전 2선승")) return 2;
  if (rules.includes("5전 3선승")) return 3;
  if (rules.includes("7전 4선승")) return 4;
  return null;
}

// ─── Styled ────────────────────────────────────────────────────────────────
const BASE_CELL = { padding: "5px 4px", textAlign: "center" as const, fontSize: 14, border: "1px solid #E5E7EB", borderRadius: "8px" };

const StyledTableCell = styled(TableCell)(() => ({ ...BASE_CELL, width: 65 }));

const NumberHeaderCell = styled(TableCell)(({ theme }) => ({
  ...BASE_CELL,
  width: 65,
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}));

const NumberRowCell = styled(TableCell)(({ theme }) => ({
  ...BASE_CELL,
  width: 65,
  fontWeight: 600,
  backgroundColor: theme.palette.grey[200],
}));

const NameHeaderCell = styled(TableCell)(({ theme }) => ({
  ...BASE_CELL,
  width: 65,
  maxWidth: 65,
  fontWeight: 500,
  fontSize: 11,
  backgroundColor: theme.palette.grey[100],
  whiteSpace: "normal",
  wordBreak: "keep-all",
  lineHeight: 1.3,
}));

const BodyHeaderCell = styled(TableCell)(({ theme }) => ({
  ...BASE_CELL,
  width: 65,
  maxWidth: 65,
  fontWeight: 600,
  fontSize: 11,
  backgroundColor: theme.palette.grey[100],
  whiteSpace: "normal",
  wordBreak: "keep-all",
  lineHeight: 1.3,
}));

// ─── 대각선 셀 ─────────────────────────────────────────────────────────────
const DiagonalBase = styled(TableCell)(({ theme }) => ({
  position: "relative",
  padding: 0,
  textAlign: "center",
  width: 65,
  border: "1px solid #E5E7EB",
  borderRadius: "8px",
  backgroundColor: theme.palette.action.disabledBackground,
}));

function DiagonalScoreCell({ landscape }: { landscape: boolean }) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [angle, setAngle] = useState(45);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const { offsetWidth: w, offsetHeight: h } = el;
      if (!w || !h) return;
      setAngle((Math.atan(h / w) * 180) / Math.PI);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <DiagonalBase
      ref={ref}
      sx={(theme) => ({
        backgroundImage: `linear-gradient(${landscape ? angle : -angle}deg,transparent 49.5%,${theme.palette.divider} 50%,${theme.palette.divider} 50.5%,transparent 51%)`,
      })}
    />
  );
}

// ─── 부 배지 ───────────────────────────────────────────────────────────────
function DivBadge({ division }: { division?: string | null }) {
  if (!division) return null;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%",
        bgcolor: "#FAAA47", color: "#000000",
        fontSize: 9, fontWeight: 900, lineHeight: 1,
        flexShrink: 0, verticalAlign: "middle",
      }}
    >
      {division}
    </Box>
  );
}

// ─── 점수 셀 (편집 가능) ───────────────────────────────────────────────────
function BracketScoreCell({ match, isA, leagueId, winScore, canManage, landscape }: {
  match: LeagueMatch | undefined;
  isA: boolean;
  leagueId: string;
  winScore: number | null;
  canManage: boolean;
  landscape: boolean;
}) {
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const canEdit = canManage && (match?.status === "playing" || match?.status === "done");
  const score = (match?.status === "playing" || match?.status === "done")
    ? ((isA ? match!.score_a : match!.score_b) ?? 0)
    : null;
  const opp = (match?.status === "playing" || match?.status === "done")
    ? ((isA ? match!.score_b : match!.score_a) ?? 0)
    : null;
  const isWinner = winScore !== null && match?.status === "done" && score !== null && opp !== null && score === winScore;

  const handleChange = (delta: number) => {
    if (!match || !canEdit) return;
    const cur = (isA ? match.score_a : match.score_b) ?? 0;
    const next = Math.max(0, cur + delta);
    updateMatch({ leagueId, matchId: match.id, updates: isA ? { score_a: next } : { score_b: next } });
  };

  if (!canEdit) {
    return (
      <StyledTableCell sx={{ color: isWinner ? "#16A34A" : "inherit", fontWeight: isWinner ? 700 : 400 }}>
        {score !== null ? score : ""}
      </StyledTableCell>
    );
  }
  // 세로 모드(landscape): ↑ score ↓ 세로 배치
  // 디폴트 모드(!landscape): writingMode 재설정 후 ← score → 가로 배치
  // (← = 감소, → = 증가 / 화살표 90° 회전으로 방향 표현)
  const btnPadding = landscape ? 0.2 : 0.5;
  if (!landscape) {
    return (
      <StyledTableCell sx={{ p: 0, color: isWinner ? "#16A34A" : "inherit", verticalAlign: "middle" }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", writingMode: "horizontal-tb", px: 0.5, height: "100%" }}>
          <IconButton
            size="small"
            disabled={(score ?? 0) <= 0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleChange(-1)}
            sx={{ p: btnPadding }}
          >
            <ArrowDownwardIcon sx={{ fontSize: 11, transform: "rotate(90deg)" }} />
          </IconButton>
          <Typography sx={{ fontSize: 14, fontWeight: isWinner ? 700 : 400, lineHeight: 1, transform: "rotate(90deg)" }}>
            {score ?? 0}
          </Typography>
          <IconButton
            size="small"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleChange(1)}
            sx={{ p: btnPadding }}
          >
            <ArrowUpwardIcon sx={{ fontSize: 11, transform: "rotate(90deg)" }} />
          </IconButton>
        </Box>
      </StyledTableCell>
    );
  }
  return (
    <StyledTableCell sx={{ p: 0, color: isWinner ? "#16A34A" : "inherit" }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 0.25 }}>
        <IconButton
          size="small"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => handleChange(1)}
          sx={{ p: btnPadding }}
        >
          <ArrowUpwardIcon sx={{ fontSize: 11 }} />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: isWinner ? 700 : 400, lineHeight: 1 }}>
          {score ?? 0}
        </Typography>
        <IconButton
          size="small"
          disabled={(score ?? 0) <= 0}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => handleChange(-1)}
          sx={{ p: btnPadding }}
        >
          <ArrowDownwardIcon sx={{ fontSize: 11 }} />
        </IconButton>
      </Box>
    </StyledTableCell>
  );
}

// ─── Sortable 행 컴포넌트 ──────────────────────────────────────────────────
interface BracketRowProps {
  participant: LeagueParticipantItem;
  rowIdx: number;
  n: number;
  localOrder: LeagueParticipantItem[];
  editMode: boolean;
  reorderMode: "push";
  canManage: boolean;
  onMove: (idx: number, dir: "up" | "down") => void;
  landscape: boolean;
  matchLookup: Map<string, LeagueMatch>;
  wins: number;
  losses: number;
  rank: number;
  tieSetDiff: string;
  hasPlayed: boolean;
  leagueId: string;
  winScore: number | null;
  isMe: boolean;
}

const SortableBracketRow = memo(function SortableBracketRow({
  participant, rowIdx, n, localOrder, editMode, canManage, onMove, landscape,
  matchLookup, wins, losses, rank, tieSetDiff, hasPlayed, leagueId, winScore, isMe,
}: BracketRowProps) {
  const canDrag = editMode && canManage;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: participant.id, disabled: !canDrag });

  return (
    <TableRow
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 99 : "auto",
        bgcolor: isDragging ? "action.hover" : "inherit",
      }}
    >
      {/* 시드 번호 셀: 드래그 핸들 + 모드별 버튼 */}
      <NumberRowCell
        sx={{ p: 0.5, ...(canDrag && { cursor: "grab", touchAction: "none" }) }}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
      >
        {editMode && canManage ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <IconButton
                size="small" disabled={rowIdx === 0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMove(rowIdx, "up")}
                sx={{ p: 0.25 }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 13 }} />
              </IconButton>
              <Typography sx={{ fontSize: 11, lineHeight: 1 }}>{rowIdx + 1}</Typography>
              <IconButton
                size="small" disabled={rowIdx === n - 1}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMove(rowIdx, "down")}
                sx={{ p: 0.25 }}
              >
                <ArrowDownwardIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
        ) : (
          rowIdx + 1
        )}
      </NumberRowCell>

      <BodyHeaderCell sx={isMe ? { bgcolor: "#EFF6FF" } : undefined}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
          <DivBadge division={participant.division} />
          <span style={isMe ? { color: "#2F80ED", fontWeight: 700 } : undefined}>{participant.name}</span>
        </Box>
      </BodyHeaderCell>

      {localOrder.map((colPlayer, colIdx) => {
        if (rowIdx === colIdx) return <DiagonalScoreCell key={colIdx} landscape={landscape} />;
        const m = matchLookup.get(`${participant.id}__${colPlayer.id}`);
        const isA = m?.participant_a_id === participant.id;
        return (
          <BracketScoreCell key={colIdx} match={m} isA={isA} leagueId={leagueId} winScore={winScore} canManage={canManage} landscape={landscape} />
        );
      })}

      <StyledTableCell sx={{ bgcolor: "#F0FDF4", color: wins > 0 ? "#16A34A" : "inherit", fontWeight: wins > 0 ? 700 : 400 }}>
        {hasPlayed ? wins : ""}
      </StyledTableCell>
      <StyledTableCell sx={{ bgcolor: "#FFF1F2", color: losses > 0 ? "#DC2626" : "inherit" }}>
        {hasPlayed ? losses : ""}
      </StyledTableCell>
      <StyledTableCell sx={{ color: rank === 1 && hasPlayed ? "#DC2626" : "inherit", fontWeight: rank === 1 && hasPlayed ? 700 : 400 }}>
        {hasPlayed ? rank : ""}
      </StyledTableCell>
      <StyledTableCell>
        {tieSetDiff || ""}
      </StyledTableCell>
    </TableRow>
  );
});

// ──────────────────────────────────────────────────────────────────────────
export default function LeagueBracket() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: leagueData, isLoading: leagueLoading, refetch: refetchLeague } = useGetLeagueQuery(id ?? "", { skip: !id });
  const { data: participantData, isLoading: participantsLoading, refetch: refetchParticipants } = useGetLeagueParticipantsQuery(id ?? "", {
    skip: !id,
    pollingInterval: 15000,
  });
  const { data: matchData, refetch: refetchMatches } = useGetLeagueMatchesQuery(id ?? "", {
    skip: !id,
    pollingInterval: 15000,
  });

  const handleRefresh = useCallback(() => {
    refetchLeague();
    refetchParticipants();
    refetchMatches();
  }, [refetchLeague, refetchParticipants, refetchMatches]);

  const league = leagueData?.league;
  const { data: groupData } = useGetGroupDetailQuery(league?.group_id ?? "", { skip: !league?.group_id });
  const authUser = useAppSelector((s) => s.auth.user);
  const isCreator = !!authUser && league?.created_by_id === authUser.id;
  const canManage = (groupData?.myRole === "owner" || groupData?.myRole === "admin") || isCreator;
  const myName = groupData?.members?.find((m) => m.user_id === authUser?.id)?.name ?? authUser?.name ?? null;

  const rawParticipants = useMemo(
    () => participantData?.participants ?? [],
    [participantData],
  );

  // ── 로컬 상태 ────────────────────────────────────────────────────────────
  // editOrder: null = 사용자가 아직 순서를 바꾸지 않음 → rawParticipants 그대로 사용
  const [editOrder, setEditOrder]   = useState<typeof rawParticipants | null>(null);
  const localOrder                  = editOrder ?? rawParticipants;
  const setLocalOrder = useCallback(
    (fn: (prev: typeof rawParticipants) => typeof rawParticipants) =>
      setEditOrder((prev) => fn(prev ?? rawParticipants)),
    [rawParticipants],
  );

  const [editMode, setEditMode]     = useState(false);
  const [reorderMode] = useState<"push">("push");
  const [rulesAnchor, setRulesAnchor] = useState<HTMLButtonElement | null>(null);
  const [landscape, setLandscape]     = useState(false);

  // ── 스케일 계산 ──────────────────────────────────────────────────────────
  const wrapperRef      = useRef<HTMLDivElement>(null);
  const wrapperTableRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [reorderParticipants] = useReorderLeagueParticipantsMutation();

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // ── 재배치 핸들러 (useCallback → SortableBracketRow memo 효과) ───────────
  const handleMove = useCallback((idx: number, dir: "up" | "down") => {
    setLocalOrder((prev) => {
      const next = idx + (dir === "up" ? -1 : 1);
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      reorderParticipants({ leagueId: id ?? "", order: arr.map((p) => p.id) });
      return arr;
    });
  }, [setLocalOrder, reorderParticipants, id]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      reorderParticipants({ leagueId: id ?? "", order: next.map((p) => p.id) });
      return next;
    });
  }, [setLocalOrder, reorderParticipants, id]);

  const toggleEdit = useCallback(() => {
    setEditMode((v) => !v);
  }, []);

  // ── 스케일: dataReady가 true가 될 때 ref가 붙으므로 deps에 포함 ──────────
  const dataReady = !!league && rawParticipants.length > 0;
  useLayoutEffect(() => {
    function updateScale() {
      if (!wrapperRef.current || !wrapperTableRef.current) return;
      const ww = wrapperRef.current.clientWidth;
      const wh = wrapperRef.current.clientHeight;
      const tw = wrapperTableRef.current.scrollWidth;
      const th = wrapperTableRef.current.scrollHeight;
      if (!tw || !th) return;
      // portrait(writingMode: vertical-rl): 물리적 tw/th가 시각적으로 뒤바뀜
      // → 시각 너비 = physical height(th), 시각 높이 = physical width(tw)
      const s = landscape
        ? Math.min(ww / tw, wh / th)
        : Math.min(ww / th, wh / tw);
      setScale(s);
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    if (wrapperTableRef.current) ro.observe(wrapperTableRef.current);
    window.addEventListener("resize", updateScale);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateScale); };
  }, [landscape, dataReady]);

  const n = localOrder.length;

  // ── 경기 데이터 연계 ──────────────────────────────────────────────────────
  const matchLookup = useMemo(() => {
    const map = new Map<string, LeagueMatch>();
    for (const m of matchData?.matches ?? []) {
      if (m.participant_a_id && m.participant_b_id) {
        map.set(`${m.participant_a_id}__${m.participant_b_id}`, m);
        map.set(`${m.participant_b_id}__${m.participant_a_id}`, m);
      }
    }
    return map;
  }, [matchData]);

  const playerStats = useMemo(() => localOrder.map((player) => {
    let wins = 0, losses = 0;
    for (const m of matchData?.matches ?? []) {
      if (m.status !== "done") continue;
      const isA = m.participant_a_id === player.id;
      const isB = m.participant_b_id === player.id;
      if (!isA && !isB) continue;
      const my = isA ? (m.score_a ?? 0) : (m.score_b ?? 0);
      const opp = isA ? (m.score_b ?? 0) : (m.score_a ?? 0);
      if (my > opp) wins++; else losses++;
    }
    return { wins, losses, hasPlayed: wins + losses > 0 };
  }), [localOrder, matchData]);

  const { rankings, tieSetDiffs } = useMemo(() => {
    const n = localOrder.length;
    // 동점 그룹 파악
    const byWins = new Map<number, number[]>();
    localOrder.forEach((_, i) => {
      const w = playerStats[i]?.wins ?? 0;
      if (!byWins.has(w)) byWins.set(w, []);
      byWins.get(w)!.push(i);
    });

    // 동점 그룹 내 직접 대결 득실 계산
    const tieWon = new Array(n).fill(0);
    const tieLost = new Array(n).fill(0);
    const isTied = new Array(n).fill(false);
    for (const group of byWins.values()) {
      if (group.length < 2) continue;
      const groupIds = new Set(group.map((i) => localOrder[i].id));
      for (const i of group) {
        isTied[i] = true;
        const player = localOrder[i];
        for (const m of matchData?.matches ?? []) {
          if (m.status !== "done") continue;
          const isA = m.participant_a_id === player.id;
          const isB = m.participant_b_id === player.id;
          if (!isA && !isB) continue;
          const oppId = isA ? m.participant_b_id : m.participant_a_id;
          if (!oppId || !groupIds.has(oppId)) continue;
          tieWon[i] += isA ? (m.score_a ?? 0) : (m.score_b ?? 0);
          tieLost[i] += isA ? (m.score_b ?? 0) : (m.score_a ?? 0);
        }
      }
    }

    const indices = localOrder.map((_, i) => i);
    indices.sort((a, b) => {
      const sa = playerStats[a], sb = playerStats[b];
      if (sa.wins !== sb.wins) return sb.wins - sa.wins;
      const ratioA = tieLost[a] === 0 ? Infinity : tieWon[a] / tieLost[a];
      const ratioB = tieLost[b] === 0 ? Infinity : tieWon[b] / tieLost[b];
      return ratioB - ratioA;
    });
    const rankMap = new Array(n).fill(0);
    indices.forEach((playerIdx, rankIdx) => { rankMap[playerIdx] = rankIdx + 1; });

    const diffs = localOrder.map((_, i) => {
      if (!isTied[i] || !playerStats[i].hasPlayed) return "";
      if (tieWon[i] === 0 && tieLost[i] === 0) return "";
      return `${tieWon[i]}/${tieLost[i]}`;
    });

    return { rankings: rankMap, tieSetDiffs: diffs };
  }, [playerStats, localOrder, matchData]);

  if (leagueLoading || participantsLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!league || rawParticipants.length === 0) return null;

  const leagueStarted = league.status === "completed";
  const date          = formatLeagueDate(league.start_date);

  // ── JSX ──────────────────────────────────────────────────────────────────
  return createPortal(
    <Box sx={{
      bgcolor: "#fff",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "fixed",
      inset: 0,
      zIndex: 1300,
    }}>

      {/* ===== 헤더 바 ===== */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.75, borderBottom: "1px solid #E5E7EB", gap: 0.5 }}>
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ flexShrink: 0 }}>
          <ChevronLeftIcon />
        </IconButton>

        {/* 리그 정보 + ⓘ */}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.25, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {date} / {league.type} {league.format} / {league.rules}
          </Typography>
          <Tooltip title="경기 규칙 설명">
            <IconButton size="small" onClick={(e) => setRulesAnchor(rulesAnchor ? null : e.currentTarget)} sx={{ flexShrink: 0, p: 0.25 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: "#9CA3AF" }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 수정 버튼 (pill 스타일) */}
        {!leagueStarted && canManage && (
          <Button
            size="small"
            variant="contained"
            startIcon={editMode ? <CheckIcon sx={{ fontSize: 14 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
            onClick={toggleEdit}
            sx={{
              borderRadius: "20px", fontSize: 11, fontWeight: 700, px: 1.5, py: 0.4,
              textTransform: "none", flexShrink: 0, minWidth: "auto", boxShadow: "none",
              bgcolor: editMode ? "#10B981" : "#2563EB",
              "&:hover": { bgcolor: editMode ? "#059669" : "#1D4ED8", boxShadow: "none" },
            }}
          >
            {editMode ? "완료" : "수정"}
          </Button>
        )}

        {/* × 닫기 */}
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ flexShrink: 0 }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* ===== 경기 규칙 Popover ===== */}
      <Popover
        open={Boolean(rulesAnchor)}
        anchorEl={rulesAnchor}
        onClose={() => setRulesAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, maxWidth: 500 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>경기 규칙</Typography>
          <Typography sx={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-line" }}>
            3전 2선승제: 세 번의 경기 중 두 번을 먼저 이기면 승리합니다.<br/>
            5전 3선승제: 다섯 번의 경기 중 세 번을 먼저 이기면 승리합니다.<br/>
            7전 4선승제: 일곱 번의 경기 중 네 번을 먼저 이기면 승리합니다.<br/>
            3세트제: 세 번의 경기를 모두 해야 합니다. 2대0이 되어도 세 번째 경기를 진행합니다.
          </Typography>
        </Box>
      </Popover>



      {/* ===== 대진표 영역 (회전) ===== */}
      <Box
        ref={wrapperRef}
        sx={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0, bgcolor: "#F0F2F5" }}
      >
        {/* 플로팅 버튼 묶음 */}
        <Tooltip title="새로고침">
          <IconButton
            onClick={handleRefresh}
            sx={{
              position: "absolute", bottom: 67, right: 14, zIndex: 10,
              bgcolor: "#fff",
              color: "#6B7280",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              width: 45, height: 45,
              "&:hover": { bgcolor: "#F3F4F6" },
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={landscape ? "세로 보기" : "가로 보기"}>
          <IconButton
            onClick={() => setLandscape((v) => !v)}
            sx={{
              position: "absolute", bottom: 14, right: 14, zIndex: 10,
              bgcolor: landscape ? "#2563EB" : "#fff",
              color: landscape ? "#fff" : "#6B7280",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              width: 45, height: 45,
              "&:hover": { bgcolor: landscape ? "#1D4ED8" : "#F3F4F6" },
            }}
          >
            <ScreenRotationIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box
          ref={wrapperTableRef}
          sx={{
            // portrait: writingMode로 90° 회전해서 세로화면에 맞춤
            // landscape: 전체 Box가 rotate(-90deg) 되므로 writingMode 불필요
            ...(!landscape && {
              writingMode: "vertical-rl",
              textOrientation: "sideways",
            }),
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            display: "inline-block",
            padding: "10px",
          }}
        >

          {/* ─── 대진표 테이블 ─── */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: "10px", overflow: "hidden" }}>
              <Table sx={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "3px" }}>
                <TableHead>
                  <TableRow>
                    <NumberHeaderCell colSpan={2} rowSpan={2} sx={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, letterSpacing: 0.3 }}>참가명단</NumberHeaderCell>
                    {localOrder.map((_, idx) => (
                      <NumberHeaderCell key={idx}>
                        <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#3B82F6", color: "white", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {idx + 1}
                        </Box>
                      </NumberHeaderCell>
                    ))}
                    <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#F0FDF4", color: "#16A34A" }}>승</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#FFF1F2", color: "#DC2626" }}>패</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2}>순위</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2} sx={{ fontSize: landscape ? "13px" : "14px" }}>동점자{<br />}세트 득실</NumberHeaderCell>
                  </TableRow>
                  <TableRow>
                    {localOrder.map((p) => {
                      const isMe = !!myName && p.name === myName;
                      return (
                        <NameHeaderCell key={p.id} sx={isMe ? { bgcolor: "#EFF6FF" } : undefined}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
                            <DivBadge division={p.division} />
                            <Box component="span" sx={{ minHeight: landscape ? "" : "70px", color: isMe ? "#2F80ED" : "inherit", fontWeight: isMe ? 700 : "inherit" }}>
                              {p.name}
                            </Box>
                          </Box>
                        </NameHeaderCell>
                      );
                    })}
                  </TableRow>
                </TableHead>

                <SortableContext items={localOrder.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {localOrder.map((rowPlayer, rowIdx) => (
                      <SortableBracketRow
                        key={rowPlayer.id}
                        participant={rowPlayer}
                        rowIdx={rowIdx}
                        n={n}
                        localOrder={localOrder}
                        editMode={editMode}
                        reorderMode={reorderMode}
                        canManage={canManage}
                        onMove={handleMove}
                        landscape={landscape}
                        matchLookup={matchLookup}
                        wins={playerStats[rowIdx]?.wins ?? 0}
                        losses={playerStats[rowIdx]?.losses ?? 0}
                        rank={rankings[rowIdx] ?? 0}
                        tieSetDiff={tieSetDiffs[rowIdx] ?? ""}
                        hasPlayed={playerStats[rowIdx]?.hasPlayed ?? false}
                        leagueId={id ?? ""}
                        winScore={getWinScore(league?.rules)}
                        isMe={!!myName && rowPlayer.name === myName}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </TableContainer>
          </DndContext>

          {/* ─── 경기 순서 (다크 카드) ─── */}
          <Box sx={{ mt: landscape ? 1.5 : 0, mr: landscape ? 0 : 1.5 }}>
            <Box sx={{ bgcolor: "#1A1D2E", borderRadius: "12px", px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1.5, minHeight: 72 }}>
              {/* 라벨 */}
              <Box sx={{ flexShrink: 0, textAlign: "center" }}>
                <Typography sx={{ fontSize: 7, fontWeight: 700, color: "#6B7280", letterSpacing: 1.5 }}>SCHEDULE</Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#F9FAFB", lineHeight: 1.3 }}>경기{"\n"}순서</Typography>
              </Box>

              {/* 경기 카드 */}
              <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", flex: 1, "&::-webkit-scrollbar": { display: "none" } }}>
                {(matchData?.matches ?? []).map((m) => {
                  const p1Idx = localOrder.findIndex((p) => p.id === m.participant_a_id);
                  const p2Idx = localOrder.findIndex((p) => p.id === m.participant_b_id);
                  if (p1Idx === -1 || p2Idx === -1) return null;
                  const isDone = m.status === "done";
                  const isPlaying = m.status === "playing";
                  const numColor = isDone ? "#6B7280" : isPlaying ? "#60A5FA" : "#F9FAFB";
                  return (
                    <Box key={m.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                      <Box sx={{ bgcolor: isDone ? "#374151" : isPlaying ? "#1E3A5F" : "#2D3748", borderRadius: "5px", px: 1.25, py: 0.75, textAlign: "center", minWidth: 42, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Typography sx={{ color: numColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{p1Idx + 1}</Typography>
                        <Box sx={{ width: "100%", height: "1px", bgcolor: "#4B5563", my: 0.25 }} />
                        <Typography sx={{ color: numColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{p2Idx + 1}</Typography>
                      </Box>
                      <Box sx={{ bgcolor: m.court ? (isPlaying ? "#2563EB" : "#374151") : "#1F2937", borderRadius: "100px", px: 0.75, py: 0.15 }}>
                        <Typography sx={{ fontSize: 8, color: m.court ? (isPlaying ? "white" : "#9CA3AF") : "#374151", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {m.court || "미정"}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>,
    document.body
  );
}
