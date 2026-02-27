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
import { formatLeagueDate } from "../../utils/dateUtils";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
  type LeagueParticipantItem,
} from "../../features/league/leagueApi";

// ─── 라운드 경기 순서 생성 ────────────────────────────────────────────
// 반환값: [positionA, positionB] (0-indexed)
// 예) 4명 → (0,3),(1,2),(0,2),(1,3),(0,1),(2,3)
function generateRoundRobin(n: number): Array<[number, number]> {
  const games: Array<[number, number]> = [];
  const size = n % 2 === 0 ? n : n + 1; // 홀수면 추가
  const pos = Array.from({ length: size }, (_, i) => i);

  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const p1 = pos[i];
      const p2 = pos[size - 1 - i];
      if (p1 < n && p2 < n) games.push([p1, p2]); // bye(=n) 제외
    }
    // 첫 번째 고정, 나머지 회전
    const last = pos.splice(size - 1, 1)[0];
    pos.splice(1, 0, last);
  }
  return games;
}

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

function DiagonalScoreCell() {
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
        backgroundImage: `linear-gradient(${angle}deg,transparent 49.5%,${theme.palette.divider} 50%,${theme.palette.divider} 50.5%,transparent 51%)`,
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

// ─── Score InputBase helper ────────────────────────────────────────────────
const ScoreInput = memo(function ScoreInput({ disabled }: { disabled?: boolean }) {
  return (
    <input
      disabled={disabled}
      style={{ textAlign: "center", fontSize: 14, width: 32, height: 28, border: "none", outline: "none", background: "transparent", padding: 0, color: "inherit" }}
    />
  );
});

// ─── Sortable 행 컴포넌트 ──────────────────────────────────────────────────
interface BracketRowProps {
  participant: LeagueParticipantItem;
  rowIdx: number;
  n: number;
  localOrder: LeagueParticipantItem[];
  editMode: boolean;
  reorderMode: "push" | "swap";
  swapFirst: number | null;
  onMove: (idx: number, dir: "up" | "down") => void;
  onSwapClick: (idx: number) => void;
}

const SortableBracketRow = memo(function SortableBracketRow({
  participant, rowIdx, n, localOrder, editMode, reorderMode, swapFirst, onMove, onSwapClick,
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
          reorderMode === "push" ? (
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
            <Box
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSwapClick(rowIdx)}
              sx={{
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                bgcolor: swapFirst === rowIdx ? "#BFDBFE" : "transparent",
                borderRadius: 1, p: 0.5,
                border: swapFirst === rowIdx ? "1.5px solid #3B82F6" : "1.5px solid transparent",
              }}
            >
              <Typography sx={{ fontSize: 11 }}>{rowIdx + 1}</Typography>
            </Box>
          )
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

      {localOrder.map((_, colIdx) =>
        rowIdx === colIdx
          ? <DiagonalScoreCell key={colIdx} />
          : <StyledTableCell key={colIdx}><ScoreInput disabled={!editMode} /></StyledTableCell>
      )}

      <StyledTableCell sx={{ bgcolor: "#F0FDF4" }}><ScoreInput disabled={!editMode} /></StyledTableCell>
      <StyledTableCell sx={{ bgcolor: "#FFF1F2" }}><ScoreInput disabled={!editMode} /></StyledTableCell>
      <StyledTableCell><ScoreInput disabled={!editMode} /></StyledTableCell>
      <StyledTableCell><ScoreInput disabled={!editMode} /></StyledTableCell>
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
  const [reorderMode, setReorderMode] = useState<"push" | "swap">("push");
  const [swapFirst, setSwapFirst]   = useState<number | null>(null);
  const [courtMap, setCourtMap]     = useState<Record<number, string>>({});
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

  const handleSwapClick = useCallback((idx: number) => {
    if (swapFirst === null) {
      setSwapFirst(idx);
    } else if (swapFirst === idx) {
      setSwapFirst(null);
    } else {
      setLocalOrder((prev) => {
        const arr = [...prev];
        [arr[swapFirst], arr[idx]] = [arr[idx], arr[swapFirst]];
        return arr;
      });
      setSwapFirst(null);
    }
  }, [swapFirst, setLocalOrder]);

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
    setSwapFirst(null);
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
      setScale(Math.min(ww / tw, wh / th));
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
      ...(landscape ? {
        position: "fixed",
        inset: 0,
        zIndex: 1300,
      } : {
        height: "100%",
      }),
    }}>

      {/* ===== 헤더 바 ===== */}
      <Box sx={{ display: "flex", alignItems: "center", px: 0.5, py: 0.5, borderBottom: "1px solid #E5E7EB", gap: 0.25 }}>
        <IconButton size="small" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </IconButton>

        <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 600, mx: 0.5, lineHeight: 1.4 }} noWrap>
          {date} / {league.type} {league.format} / {league.rules}
        </Typography>

        {/* 가로/세로 전환 */}
        <Tooltip title={landscape ? "세로 보기" : "가로 보기"}>
          <IconButton size="small" onClick={() => setLandscape((v) => !v)}>
            <ScreenRotationIcon sx={{ fontSize: 20, ...(landscape && { color: "primary.main" }) }} />
          </IconButton>
        </Tooltip>

        {/* ⓘ 경기 규칙 */}
        <Tooltip title="경기 규칙 설명">
          <IconButton size="small" onClick={(e) => setRulesAnchor(rulesAnchor ? null : e.currentTarget)}>
            <InfoOutlinedIcon sx={{ fontSize: 20 }} />
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
            5전 3선승제: "다섯 번의 경기 중 세 번을 먼저 이기면 승리합니다."<br/>
            3전 2선승제: "세 번의 경기 중 두 번을 먼저 이기면 승리합니다."<br/>
            3세트제: "세 번의 경기를 모두 해야 합니다. 2대0이 되어도 세 번째 경기를 진행합니다."
          </Typography>
        </Box>
      </Popover>

      {/* ===== 수정 모드 툴바 ===== */}
      {editMode && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.75, bgcolor: "#F0F9FF", borderBottom: "1px solid #BAE6FD" }}>
          <Typography sx={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>재배치:</Typography>
          <Button
            size="small" disableElevation
            variant={reorderMode === "push" ? "contained" : "outlined"}
            onClick={() => setReorderMode("push")}
            sx={{ fontSize: 11, py: 0.25, px: 1, minWidth: 0 }}
          >
            밀어내기
          </Button>
          <Button
            size="small" disableElevation
            variant={reorderMode === "swap" ? "contained" : "outlined"}
            onClick={() => { setReorderMode("swap"); setSwapFirst(null); }}
            sx={{ fontSize: 11, py: 0.25, px: 1, minWidth: 0 }}
          >
            위치 맞바꾸기
          </Button>
          {reorderMode === "swap" && swapFirst !== null && (
            <Typography sx={{ fontSize: 11, color: "#0369A1" }}>
              {localOrder[swapFirst]?.name} → 다른 참가자 선택
            </Typography>
          )}
        </Box>
      )}

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
          {/* 상단 정보 */}
          <Box sx={{ mb: 2, fontWeight: 600, fontSize: 14 }}>
            {date} / {league.type} {league.format} / {league.rules}
          </Box>

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
                        <span>{p.name}</span>
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
                        swapFirst={swapFirst}
                        onMove={handleMove}
                        onSwapClick={handleSwapClick}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </TableContainer>

          {/* ─── 경기 순서 테이블 ─── */}
          <Box sx={{ mt: 1.5 }}>
            <TableContainer component={Paper} sx={{ borderRadius: 0 }}>
              <Table size="small">
                <TableBody>
                  {/* 경기 번호 */}
                  <TableRow>
                    <TableCell rowSpan={4} sx={{ ...BASE_CELL, width: 32, fontWeight: 700, fontSize: 10, p: "3px 2px", bgcolor: "#EEF2FF", color: "#4338CA" }}>경기{<br />}순서</TableCell>
                    {games.map((_, idx) => (
                      <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, fontSize: 10, fontWeight: 700, p: "3px 1px", bgcolor: "#EEF2FF", color: "#4338CA" }}>{idx + 1}</TableCell>
                    ))}
                  </TableRow>

                  {/* 선수 A */}
                  <TableRow>
                    {games.map(([p1], idx) => (
                      <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, fontSize: 11, fontWeight: 700, p: "2px 1px" }}>
                        {p1 + 1}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* 선수 B */}
                  <TableRow>
                    {games.map(([, p2], idx) => (
                      <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, fontSize: 11, fontWeight: 700, p: "2px 1px" }}>
                        {p2 + 1}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* 코트 입력 */}
                  <TableRow>
                    {games.map((_, idx) => (
                      <TableCell key={idx} sx={{ ...BASE_CELL, width: 30, p: "2px 1px" }}>
                        <input
                          placeholder="코트"
                          disabled={!editMode}
                          value={courtMap[idx] ?? ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCourtMap((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          style={{ textAlign: "center", fontSize: 10, width: 28, height: 20, border: "none", outline: "none", background: "transparent", padding: 0, color: "inherit" }}
                        />
                      </TableCell>
                    ))}
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
