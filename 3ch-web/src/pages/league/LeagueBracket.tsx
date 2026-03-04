import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Box, CircularProgress, IconButton, Paper, Popover,
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
import { formatLeagueDate } from "../../utils/dateUtils";
import { generateRoundRobin } from "../../utils/leagueUtils";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueMatchesQuery,
  useUpdateLeagueMatchMutation,
  type LeagueParticipantItem,
  type LeagueMatch,
} from "../../features/league/leagueApi";

// ─── Styled ────────────────────────────────────────────────────────────────
const BASE_CELL = { border: "1px solid #ccc", padding: "6px", textAlign: "center" as const, fontSize: 14 };

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
  border: "1px solid #ccc",
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
function BracketScoreCell({ match, isA, leagueId, is3set }: {
  match: LeagueMatch | undefined;
  isA: boolean;
  leagueId: string;
  is3set: boolean;
}) {
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const canEdit = match?.status === "playing" || match?.status === "done";
  const score = canEdit ? ((isA ? match!.score_a : match!.score_b) ?? 0) : null;
  const opp   = canEdit ? ((isA ? match!.score_b : match!.score_a) ?? 0) : null;
  const isWinner = !is3set && match?.status === "done" && score !== null && opp !== null && score > opp;

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!match || !canEdit) return;
    const val = Math.max(0, parseInt(e.target.value) || 0);
    const cur = isA ? match.score_a : match.score_b;
    if (val !== (cur ?? 0)) {
      updateMatch({ leagueId, matchId: match.id, updates: isA ? { score_a: val } : { score_b: val } });
    }
  };

  if (!canEdit) {
    return <StyledTableCell>{score !== null ? score : ""}</StyledTableCell>;
  }
  return (
    <StyledTableCell sx={{ p: 0, color: isWinner ? "#DC2626" : "inherit" }}>
      <input
        key={`${match!.id}-${isA}-${score}`}
        type="number"
        defaultValue={score ?? 0}
        onBlur={handleBlur}
        style={{ textAlign: "center", fontSize: 14, width: "100%", height: 28, border: "none", outline: "none", background: "transparent", padding: 0, color: "inherit", fontWeight: isWinner ? 700 : 400 }}
      />
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
  onMove: (idx: number, dir: "up" | "down") => void;
  landscape: boolean;
  matchLookup: Map<string, LeagueMatch>;
  wins: number;
  losses: number;
  rank: number;
  tieSetDiff: string;
  hasPlayed: boolean;
  leagueId: string;
  is3set: boolean;
}

const SortableBracketRow = memo(function SortableBracketRow({
  participant, rowIdx, n, localOrder, editMode, onMove, landscape,
  matchLookup, wins, losses, rank, tieSetDiff, hasPlayed, leagueId, is3set,
}: BracketRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: participant.id, disabled: !editMode });

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
        sx={{ p: 0.5, ...(editMode && { cursor: "grab", touchAction: "none" }) }}
        {...(editMode ? { ...attributes, ...listeners } : {})}
      >
        {editMode ? (
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

      <BodyHeaderCell>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
          <DivBadge division={participant.division} />
          <span>{participant.name}</span>
        </Box>
      </BodyHeaderCell>

      {localOrder.map((colPlayer, colIdx) => {
        if (rowIdx === colIdx) return <DiagonalScoreCell key={colIdx} landscape={landscape} />;
        const m = matchLookup.get(`${participant.id}__${colPlayer.id}`);
        const isA = m?.participant_a_id === participant.id;
        return (
          <BracketScoreCell key={colIdx} match={m} isA={isA} leagueId={leagueId} is3set={is3set} />
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

  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id ?? "", { skip: !id });
  const { data: participantData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id ?? "", {
    skip: !id,
    pollingInterval: 15000,
  });
  const { data: matchData } = useGetLeagueMatchesQuery(id ?? "", {
    skip: !id,
    pollingInterval: 15000,
  });

  const league = leagueData?.league;
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
      return arr;
    });
  }, [setLocalOrder]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, [setLocalOrder]);

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

  const n     = localOrder.length;
  const games = useMemo(() => generateRoundRobin(n), [n]);

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
  return (
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
      <Box sx={{ display: "flex", alignItems: "center", px: 0.5, py: 0.5, borderBottom: "1px solid #E5E7EB", gap: 0.25 }}>
        <IconButton size="small" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </IconButton>

        <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 600, mx: 0.5, lineHeight: 1.4 }} noWrap>
          {date} / {league.type} {league.format} / {league.rules}
          {/* ⓘ 경기 규칙 */}
          <Tooltip title="경기 규칙 설명">
            <IconButton size="small" onClick={(e) => setRulesAnchor(rulesAnchor ? null : e.currentTarget)}>
              <InfoOutlinedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Typography>

        {/* 가로/세로 전환 */}
        <Tooltip title={landscape ? "세로 보기" : "가로 보기"}>
          <IconButton size="small" onClick={() => setLandscape((v) => !v)}>
            <ScreenRotationIcon sx={{ fontSize: 20, ...(landscape && { color: "primary.main" }) }} />
          </IconButton>
        </Tooltip>

        

        {/* 수정 (리그 시작 전만) */}
        {!leagueStarted && (
          <Tooltip title={editMode ? "수정 완료" : "대진표 수정"}>
            <IconButton size="small" onClick={toggleEdit}>
              {editMode
                ? <CheckIcon sx={{ fontSize: 20, color: "primary.main" }} />
                : <EditIcon sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        )}

        {/* × 닫기 */}
        <IconButton size="small" onClick={() => navigate(-1)}>
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
        sx={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}
      >
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
          }}
        >

          {/* ─── 대진표 테이블 ─── */}
          <TableContainer component={Paper} sx={{ borderRadius: 0 }}>
            <Table sx={{ tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  <NumberHeaderCell rowSpan={2} />
                  <NumberHeaderCell rowSpan={2} />
                  {localOrder.map((_, idx) => (
                    <NumberHeaderCell key={idx}>{idx + 1}</NumberHeaderCell>
                  ))}
                  <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#F0FDF4", color: "#16A34A" }}>승</NumberHeaderCell>
                  <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#FFF1F2", color: "#DC2626" }}>패</NumberHeaderCell>
                  <NumberHeaderCell rowSpan={2}>순위</NumberHeaderCell>
                  <NumberHeaderCell rowSpan={2}>동점자{<br />}세트 득실</NumberHeaderCell>
                </TableRow>
                <TableRow>
                  {localOrder.map((p) => (
                    <NameHeaderCell key={p.id}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
                        <DivBadge division={p.division} />
                          <Box component="span" sx={{minHeight: landscape ? "" : "70px"}}>
                            {p.name}
                          </Box>
                      </Box>
                    </NameHeaderCell>
                  ))}
                </TableRow>
              </TableHead>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                        onMove={handleMove}
                        landscape={landscape}
                        matchLookup={matchLookup}
                        wins={playerStats[rowIdx]?.wins ?? 0}
                        losses={playerStats[rowIdx]?.losses ?? 0}
                        rank={rankings[rowIdx] ?? 0}
                        tieSetDiff={tieSetDiffs[rowIdx] ?? ""}
                        hasPlayed={playerStats[rowIdx]?.hasPlayed ?? false}
                        leagueId={id ?? ""}
                        is3set={!!league?.rules?.includes("3세트제")}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </TableContainer>

          {/* ─── 경기 순서 테이블 ─── */}
          <Box sx={{ mt: landscape ? 1.5 : 0, mr: landscape ? 0 : 1.5 }}>
            <TableContainer sx={{ borderRadius: 0 }}>
              <Table size="small">
                <TableBody>
                  {/* 경기 번호 */}
                  <TableRow>
                    <TableCell rowSpan={4} sx={{ ...BASE_CELL, width: 32, fontWeight: 700, fontSize: 10, p: "3px 2px", bgcolor: "#F3F4F6", color: "#6B7280" }}>경기{<br />}순서</TableCell>
                    {games.map(([p1, p2], idx) => {
                      const m = matchLookup.get(`${localOrder[p1]?.id}__${localOrder[p2]?.id}`);
                      const isDone = m?.status === "done";
                      const isPlaying = m?.status === "playing";
                      return (
                        <TableCell key={idx} sx={{
                          ...BASE_CELL, width: 30, fontSize: 10, fontWeight: 700, p: "3px 1px",
                          bgcolor: isDone ? "#E5E7EB" : isPlaying ? "#DBEAFE" : "#F3F4F6",
                          color: isDone ? "#9CA3AF" : isPlaying ? "#2F80ED" : "#6B7280",
                        }}>{idx + 1}</TableCell>
                      );
                    })}
                  </TableRow>

                  {/* 선수 A */}
                  <TableRow>
                    {games.map(([p1, p2], idx) => {
                      const m = matchLookup.get(`${localOrder[p1]?.id}__${localOrder[p2]?.id}`);
                      const isDone = m?.status === "done";
                      return (
                        <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, fontSize: 11, fontWeight: 700, p: "2px 1px", color: isDone ? "#9CA3AF" : "inherit" }}>
                          {p1 + 1}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* 선수 B */}
                  <TableRow>
                    {games.map(([p1, p2], idx) => {
                      const m = matchLookup.get(`${localOrder[p1]?.id}__${localOrder[p2]?.id}`);
                      const isDone = m?.status === "done";
                      return (
                        <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, fontSize: 11, fontWeight: 700, p: "2px 1px", color: isDone ? "#9CA3AF" : "inherit" }}>
                          {p2 + 1}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* 코트 (DB에서) */}
                  <TableRow>
                    {games.map(([p1, p2], idx) => {
                      const m = matchLookup.get(`${localOrder[p1]?.id}__${localOrder[p2]?.id}`);
                      const isDone = m?.status === "done";
                      return (
                        <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, p: "2px 1px", color: isDone ? "#9CA3AF" : "#6B7280", fontSize: 10 }}>
                          {m?.court ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
