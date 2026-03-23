import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ScreenRotationIcon from "@mui/icons-material/ScreenRotation";
import RefreshIcon from "@mui/icons-material/Refresh";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
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

// ─── 색상 상수 ────────────────────────────────────────────────────────────────
// 매직 컬러 문자열을 한 곳에서 관리. 디자인 변경 시 여기만 수정하면 됨
const COLOR = {
  win:         "#16A34A", // 승리 (초록)
  loss:        "#DC2626", // 패배 / 1위 (빨강)
  primary:     "#2563EB", // 주요 액션 버튼
  divBadge:    "#FAAA47", // 부수 배지 배경 (주황)
  myHighlight: "#EFF6FF", // 내 행 하이라이트 (연파랑 배경)
  myText:      "#2F80ED", // 내 이름 텍스트 색
  darkCard:    "#1A1D2E", // 경기 순서 패널 배경
} as const;

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
/**
 * 경기 규칙 문자열에서 "선승 점수"를 반환한다.
 * - 3세트제: null (선승 개념 없음, 무조건 3세트 진행)
 * - 3전 2선승: 2
 * - 5전 3선승: 3
 * - 7전 4선승: 4
 * BracketScoreCell에서 이 값을 이용해 승리한 선수의 점수를 초록색 볼드로 표시
 */
function getWinScore(rules?: string | null): number | null {
  if (!rules) return null;
  if (rules.includes("3세트제"))    return null;
  if (rules.includes("3전 2선승"))  return 2;
  if (rules.includes("5전 3선승"))  return 3;
  if (rules.includes("7전 4선승"))  return 4;
  return null;
}

const NEXT_STATUS: Record<string, "pending" | "playing" | "done"> = {
  pending: "playing",
  playing: "done",
  done: "done",
};

// ─── Styled 셀 ────────────────────────────────────────────────────────────────
// 모든 셀의 공통 베이스 스타일 (padding / 정렬 / 테두리)
const BASE_CELL = { padding: "5px 4px", textAlign: "center" as const, fontSize: 14, border: "1px solid #E5E7EB", borderRadius: "8px" };

const StyledTableCell  = styled(TableCell)(() => ({ ...BASE_CELL, width: 65 }));
// 헤더 1행: 시드 번호 (파란 원) / 승·패·순위 등 집계 컬럼 헤더
const NumberHeaderCell = styled(TableCell)(({ theme }) => ({ ...BASE_CELL, width: 65, fontWeight: 600, backgroundColor: theme.palette.grey[200], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }));
// 바디 행의 시드 번호 셀 (드래그 핸들 겸용)
const NumberRowCell    = styled(TableCell)(({ theme }) => ({ ...BASE_CELL, width: 65, fontWeight: 600, backgroundColor: theme.palette.grey[200] }));
// 헤더 2행: 열 방향 참가자 이름 (세로 텍스트 환경에서 최소 높이 확보)
const NameHeaderCell   = styled(TableCell)(({ theme }) => ({ ...BASE_CELL, width: 65, maxWidth: 65, fontWeight: 500, fontSize: 11, backgroundColor: theme.palette.grey[100], whiteSpace: "normal", wordBreak: "keep-all", lineHeight: 1.3 }));
// 바디 행의 행 방향 참가자 이름 셀
const BodyHeaderCell   = styled(TableCell)(({ theme }) => ({ ...BASE_CELL, width: 65, maxWidth: 65, fontWeight: 600, fontSize: 11, backgroundColor: theme.palette.grey[100], whiteSpace: "normal", wordBreak: "keep-all", lineHeight: 1.3 }));

// ─── 대각선 셀 ────────────────────────────────────────────────────────────────
// 같은 참가자끼리 교차하는 셀 (자기 자신과의 대결은 없으므로 대각선 빗금 처리)
const DiagonalBase = styled(TableCell)(({ theme }) => ({
  position: "relative",
  padding: 0,
  textAlign: "center",
  width: 65,
  border: "1px solid #E5E7EB",
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: theme.palette.action.disabledBackground,
}));

/**
 * 대각선 빗금 셀
 * - ResizeObserver로 셀의 실제 크기를 측정해 빗금 각도(angle)를 동적 계산
 * - landscape=true: 양수 각도 / false: 음수 각도 (writingMode 90° 회전에 대응)
 */
function DiagonalScoreCell({ landscape }: { landscape: boolean }) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [angle, setAngle] = useState(45);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const { offsetWidth: w, offsetHeight: h } = el;
      if (w && h) setAngle((Math.atan(h / w) * 180) / Math.PI);
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

// ─── 부 배지 ──────────────────────────────────────────────────────────────────
// 참가자 이름 옆에 표시하는 "부수" 원형 배지 (예: 3부 → "3")
// division이 없으면 렌더링하지 않음
function DivBadge({ division }: { division?: string | null }) {
  if (!division) return null;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%",
        bgcolor: COLOR.divBadge, color: "#000",
        fontSize: 9, fontWeight: 900, lineHeight: 1,
        flexShrink: 0, verticalAlign: "middle",
      }}
    >
      {division}
    </Box>
  );
}

// ─── 점수 조정 버튼 (공통) ────────────────────────────────────────────────────
// BracketScoreCell(점수 조정)과 SortableBracketRow(시드 순서 이동)에서 공통 사용
// - rotate=true: writingMode가 90° 회전된 portrait 모드에서 화살표 방향 보정
// - onPointerDown stopPropagation: DnD 드래그 이벤트와 충돌 방지
function ScoreButton({ icon, disabled, rotate, variant = "order", onClick }: {
  icon: "up" | "down";
  disabled?: boolean;
  rotate?: boolean;
  variant?: "score" | "order";
  onClick: () => void;
}) {
  const Icon = variant === "score"
    ? (icon === "up" ? AddIcon : RemoveIcon)
    : (icon === "up" ? ArrowUpwardIcon : ArrowDownwardIcon);
  return (
    <IconButton
      size="small"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      sx={{ p: 0.75, minWidth: 28, minHeight: 28 }}
    >
      <Icon sx={{ fontSize: 16, ...(rotate && { transform: "rotate(90deg)" }) }} />
    </IconButton>
  );
}

// ─── 점수 셀 (편집 가능) ──────────────────────────────────────────────────────
/**
 * 대진표의 각 교차 점수 셀
 *
 * 표시 조건:
 * - match가 없거나 pending 상태: 빈 칸
 * - playing / done 상태: 점수 표시
 *
 * 편집 조건 (canEdit = canManage && isActive):
 * - 관리자/오너/리그 생성자만 편집 가능
 * - playing 또는 done 상태인 경기만 편집 가능 (pending은 불가)
 * - editMode(시드 순서 수정 모드)와는 무관하게 항상 편집 가능
 *
 * 방향별 레이아웃:
 * - landscape(가로): ↑ 점수 ↓ 세로 배치
 * - portrait(세로, writingMode 적용): ← 점수 → 가로 배치 + 아이콘 90° 회전
 */
function BracketScoreCell({ match, isA, leagueId, winScore, canManage, landscape }: {
  match: LeagueMatch | undefined;
  isA: boolean;         // 현재 행 참가자가 해당 경기의 A선수인지 여부
  leagueId: string;
  winScore: number | null; // 선승 기준 점수 (null이면 선승제 아님)
  canManage: boolean;
  landscape: boolean;
}) {
  const [updateMatch] = useUpdateLeagueMatchMutation();

  const isActive = match?.status === "playing" || match?.status === "done";
  const score    = isActive ? ((isA ? match!.score_a : match!.score_b) ?? 0) : null;
  const oppScore = isActive ? ((isA ? match!.score_b : match!.score_a) ?? 0) : null;
  // 선승제에서 정확히 winScore 점을 획득한 경우 → 승자 스타일 적용
  const isWinner = winScore !== null && match?.status === "done" && score !== null && oppScore !== null && score === winScore;
  const canEdit  = canManage && isActive;

  const handleChange = (delta: number) => {
    if (!match || !canEdit) return;
    const cur  = (isA ? match.score_a : match.score_b) ?? 0;
    const next = Math.max(0, cur + delta); // 0 미만 방지
    updateMatch({ leagueId, matchId: match.id, updates: isA ? { score_a: next } : { score_b: next } });
  };

  const winnerStyle = { color: isWinner ? COLOR.win : "inherit", fontWeight: isWinner ? 700 : 400 };

  // 편집 불가: 점수 숫자만 표시 (빈 칸 또는 숫자)
  if (!canEdit) {
    return <StyledTableCell sx={winnerStyle}>{score !== null ? score : ""}</StyledTableCell>;
  }

  // landscape / portrait 공통: [↓] 점수 [↑] 가로 배치, 좌우 여백 있게
  const inner = (
    <Box sx={{
      display: "flex", flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
      ...(landscape ? {} : { writingMode: "horizontal-tb" }),
      px: 0.25, height: "100%", gap: 0.25,
    }}>
      <ScoreButton icon="down" variant="score" disabled={(score ?? 0) <= 0} rotate={!landscape} onClick={() => handleChange(-1)} />
      <Typography sx={{ fontSize: 14, ...winnerStyle, lineHeight: 1, ...(landscape ? {} : { transform: "rotate(90deg)" }), minWidth: 14, textAlign: "center" }}>
        {score ?? 0}
      </Typography>
      <ScoreButton icon="up" variant="score" rotate={!landscape} onClick={() => handleChange(1)} />
    </Box>
  );

  return (
    <StyledTableCell sx={{ p: 0, verticalAlign: "middle", ...winnerStyle }}>
      {inner}
    </StyledTableCell>
  );
}

// ─── Sortable 행 ──────────────────────────────────────────────────────────────
interface BracketRowProps {
  participant: LeagueParticipantItem;
  rowIdx: number;       // 현재 행의 인덱스 (0-based)
  n: number;            // 전체 참가자 수 (첫/마지막 행 이동 비활성화에 사용)
  localOrder: LeagueParticipantItem[]; // 현재 표시 순서 (열 헤더와 동기화용)
  editMode: boolean;    // 시드 순서 편집 모드 여부
  canManage: boolean;   // 관리 권한 (오너/어드민/생성자) - 드래그 전용
  canScore: boolean;    // 점수 편집 권한 (canManage || public 리그)
  onMove: (idx: number, dir: "up" | "down") => void; // 버튼 클릭 이동 핸들러
  landscape: boolean;
  matchLookup: Map<string, LeagueMatch>; // "aId__bId" 키로 경기 빠르게 조회
  wins: number;
  losses: number;
  rank: number;
  tieSetDiff: string;   // 동점자 처리용 직접 대결 득실 (예: "5/3")
  hasPlayed: boolean;   // 한 경기라도 완료되었는지 (false면 집계 셀 빈 칸)
  leagueId: string;
  winScore: number | null;
  isMe: boolean;        // 현재 로그인 유저와 동일 여부 (하이라이트 용)
}

/**
 * 대진표 한 행 (참가자 1명)
 *
 * memo 적용: matchLookup / playerStats 등 부모에서 useMemo로 관리되므로
 * 관련 없는 다른 참가자 행이 리렌더링되지 않도록 방지
 *
 * 드래그 앤 드롭:
 * - editMode && canManage일 때만 드래그 활성화 (useSortable disabled 옵션)
 * - 시드 번호 셀 자체가 드래그 핸들 역할을 겸함
 */
const SortableBracketRow = memo(function SortableBracketRow({
  participant, rowIdx, n, localOrder, editMode, canManage, canScore, onMove, landscape,
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
        opacity: isDragging ? 0.4 : 1,   // 드래그 중인 행 반투명
        zIndex: isDragging ? 99 : "auto",
        bgcolor: isDragging ? "action.hover" : "inherit",
      }}
    >
      {/* 시드 번호 셀: 편집 모드에서는 ↑↓ 버튼 + 드래그 핸들로 전환 */}
      <NumberRowCell
        sx={{ p: 0.5, ...(canDrag && { cursor: "grab", touchAction: "none" }) }}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
      >
        {editMode && canManage ? (
          landscape ? (
            // 가로(landscape): 위·아래 화살표 세로 배치
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ScoreButton icon="up"   disabled={rowIdx === 0}     onClick={() => onMove(rowIdx, "up")} />
              <Typography sx={{ fontSize: 11, lineHeight: 1 }}>{rowIdx + 1}</Typography>
              <ScoreButton icon="down" disabled={rowIdx === n - 1} onClick={() => onMove(rowIdx, "down")} />
            </Box>
          ) : (
            // 세로(portrait): writingMode 상속으로 인한 90° 회전 보정
            // BracketScoreCell portrait 처리와 동일한 방식
            // portrait에서 부모 vertical-rl이 90° 회전 → 물리적 좌=시각적 상, 물리적 우=시각적 하
            // 따라서 시각적으로 ↑(위)가 먼저 보이려면 물리적으로 down을 먼저 배치
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", writingMode: "horizontal-tb", px: 0.25, height: "100%" }}>
              <ScoreButton icon="down" rotate disabled={rowIdx === n - 1} onClick={() => onMove(rowIdx, "down")} />
              <Typography sx={{ fontSize: 11, lineHeight: 1, transform: "rotate(90deg)" }}>{rowIdx + 1}</Typography>
              <ScoreButton icon="up"   rotate disabled={rowIdx === 0}     onClick={() => onMove(rowIdx, "up")} />
            </Box>
          )
        ) : (
          rowIdx + 1
        )}
      </NumberRowCell>

      {/* 행 방향 이름: 본인이면 파란 텍스트 + 연파랑 배경 */}
      <BodyHeaderCell sx={isMe ? { bgcolor: COLOR.myHighlight } : undefined}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
          <DivBadge division={participant.division} />
          <span style={isMe ? { color: COLOR.myText, fontWeight: 700 } : undefined}>{participant.name}</span>
        </Box>
      </BodyHeaderCell>

      {/* 점수 셀: 같은 인덱스(자기 자신)는 대각선 셀, 나머지는 점수 편집 셀 */}
      {localOrder.map((colPlayer, colIdx) => {
        if (rowIdx === colIdx) return <DiagonalScoreCell key={colIdx} landscape={landscape} />;
        const m   = matchLookup.get(`${participant.id}__${colPlayer.id}`);
        const isA = m?.participant_a_id === participant.id;
        return (
          <BracketScoreCell key={colIdx} match={m} isA={isA} leagueId={leagueId} winScore={winScore} canManage={canScore} landscape={landscape} />
        );
      })}

      {/* 집계 셀: 한 경기도 완료 전(hasPlayed=false)이면 빈 칸으로 표시 */}
      <StyledTableCell sx={{ bgcolor: "#F0FDF4", color: wins > 0 ? COLOR.win : "inherit", fontWeight: wins > 0 ? 700 : 400 }}>
        {hasPlayed ? wins : ""}
      </StyledTableCell>
      <StyledTableCell sx={{ bgcolor: "#FFF1F2", color: losses > 0 ? COLOR.loss : "inherit" }}>
        {hasPlayed ? losses : ""}
      </StyledTableCell>
      {/* 1위는 빨간 볼드로 강조 */}
      <StyledTableCell sx={{ color: rank === 1 && hasPlayed ? COLOR.loss : "inherit", fontWeight: rank === 1 && hasPlayed ? 700 : 400 }}>
        {hasPlayed ? rank : ""}
      </StyledTableCell>
      {/* 동점자 직접 대결 득실 (동점이 없으면 빈 칸) */}
      <StyledTableCell>{tieSetDiff || ""}</StyledTableCell>
    </TableRow>
  );
});

// ─── 커스텀 훅: 경기 통계 / 순위 계산 ───────────────────────────────────────
/**
 * 참가자별 승/패 집계 + 동점자 처리 순위를 계산한다.
 *
 * 순위 결정 우선순위:
 * 1. 승수 많은 순
 * 2. 동점자끼리 직접 대결 세트 득실비 (tieWon / tieLost) 높은 순
 *
 * tieSetDiffs: 동점 그룹에 속한 참가자만 "득/실" 형식으로 반환, 나머지는 빈 문자열
 */
function useMatchStats(localOrder: LeagueParticipantItem[], matches: LeagueMatch[]) {
  // 1단계: 참가자별 승/패 집계
  const playerStats = useMemo(() => localOrder.map((player) => {
    let wins = 0, losses = 0;
    for (const m of matches) {
      if (m.status !== "done") continue;
      const isA = m.participant_a_id === player.id;
      const isB = m.participant_b_id === player.id;
      if (!isA && !isB) continue;
      const my  = isA ? (m.score_a ?? 0) : (m.score_b ?? 0);
      const opp = isA ? (m.score_b ?? 0) : (m.score_a ?? 0);
      if (my > opp) wins++; else losses++;
    }
    return { wins, losses, hasPlayed: wins + losses > 0 };
  }), [localOrder, matches]);

  // 2단계: 동점자 처리 후 순위 결정
  const { rankings, tieSetDiffs } = useMemo(() => {
    const count = localOrder.length;

    // 승수별로 참가자 인덱스 그룹핑 (동점 그룹 파악)
    const byWins = new Map<number, number[]>();
    localOrder.forEach((_, i) => {
      const w = playerStats[i]?.wins ?? 0;
      if (!byWins.has(w)) byWins.set(w, []);
      byWins.get(w)!.push(i);
    });

    // 동점 그룹 내에서만 직접 대결 세트 득/실 계산
    const tieWon  = new Array(count).fill(0);
    const tieLost = new Array(count).fill(0);
    const isTied  = new Array(count).fill(false);

    for (const group of byWins.values()) {
      if (group.length < 2) continue; // 단독 승수면 동점 처리 불필요
      const groupIds = new Set(group.map((i) => localOrder[i].id));
      for (const i of group) {
        isTied[i] = true;
        const player = localOrder[i];
        for (const m of matches) {
          if (m.status !== "done") continue;
          const isA   = m.participant_a_id === player.id;
          const isB   = m.participant_b_id === player.id;
          if (!isA && !isB) continue;
          const oppId = isA ? m.participant_b_id : m.participant_a_id;
          if (!oppId || !groupIds.has(oppId)) continue; // 같은 동점 그룹과의 대결만 집계
          tieWon[i]  += isA ? (m.score_a ?? 0) : (m.score_b ?? 0);
          tieLost[i] += isA ? (m.score_b ?? 0) : (m.score_a ?? 0);
        }
      }
    }

    // 최종 정렬: 승수 → 직접 대결 득실비
    const indices = localOrder.map((_, i) => i);
    indices.sort((a, b) => {
      const sa = playerStats[a], sb = playerStats[b];
      if (sa.wins !== sb.wins) return sb.wins - sa.wins;
      const ratioA = tieLost[a] === 0 ? Infinity : tieWon[a] / tieLost[a];
      const ratioB = tieLost[b] === 0 ? Infinity : tieWon[b] / tieLost[b];
      return ratioB - ratioA;
    });

    // 정렬 결과를 인덱스 → 순위 매핑으로 변환
    const rankMap = new Array(count).fill(0);
    indices.forEach((playerIdx, rankIdx) => { rankMap[playerIdx] = rankIdx + 1; });

    // 동점자 득실 표시 문자열 ("득/실", 동점 아니거나 미경기면 빈 문자열)
    const diffs = localOrder.map((_, i) => {
      if (!isTied[i] || !playerStats[i].hasPlayed) return "";
      if (tieWon[i] === 0 && tieLost[i] === 0) return "";
      return `${tieWon[i]}/${tieLost[i]}`;
    });

    return { rankings: rankMap, tieSetDiffs: diffs };
  }, [playerStats, localOrder, matches]);

  return { playerStats, rankings, tieSetDiffs };
}

// ─── 경기 순서 패널 ───────────────────────────────────────────────────────────
/**
 * 대진표 하단의 경기 순서 카드 패널 (다크 테마)
 *
 * 각 카드: 시드 번호 쌍(p1 vs p2) + 코트 배지
 * 상태별 색상:
 * - pending: 흰 텍스트 / 어두운 카드
 * - playing: 파란 텍스트 + 파란 코트 배지
 * - done:    회색 텍스트 (흐림 처리)
 *
 * 방향별 마진:
 * - landscape: 테이블 아래에 세로로 붙음 (mt: 1.5)
 * - portrait:  테이블 오른쪽에 가로로 붙음 (mr: 1.5)
 */
function MatchSchedulePanel({ matches, localOrder, landscape, leagueId }: {
  matches: LeagueMatch[];
  localOrder: LeagueParticipantItem[];
  landscape: boolean;
  leagueId: string;
}) {
  const [updateMatch] = useUpdateLeagueMatchMutation();

  const handleStatus = useCallback((match: LeagueMatch, index: number) => {
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

}, [leagueId, updateMatch]);
  return (
    <Box sx={{ mt: landscape ? 1.5 : 0, mr: landscape ? 0 : 1.5 }}>
      <Box sx={{ bgcolor: COLOR.darkCard, borderRadius: "12px", px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1.5, minHeight: 72 }}>

        {/* 라벨 */}
        <Box sx={{ flexShrink: 0, textAlign: "center" }}>
          <Typography sx={{ fontSize: 7, fontWeight: 700, color: "#6B7280", letterSpacing: 1.5 }}>SCHEDULE</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#F9FAFB", lineHeight: 1.3 }}>경기{"\n"}순서</Typography>
        </Box>

        {/* 가로 스크롤 가능한 경기 카드 목록 */}
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", flex: 1, "&::-webkit-scrollbar": { display: "none" } }}>
          {matches.map((m, i) => {
            const p1Idx = localOrder.findIndex((p) => p.id === m.participant_a_id);
            const p2Idx = localOrder.findIndex((p) => p.id === m.participant_b_id);
            // 참가자 목록에 없는 경기는 표시 생략
            if (p1Idx === -1 || p2Idx === -1) return null;

            const isDone    = m.status === "done";
            const isPlaying = m.status === "playing";
            // 상태별 색상 결정
            const numColor   = isDone ? "#6B7280" : isPlaying ? "#60A5FA" : "#F9FAFB";
            const cardBg     = isDone ? "#374151" : isPlaying ? "#1E3A5F" : "#2D3748";
            const courtBg    = m.court ? (isPlaying ? COLOR.primary : "#374151") : "#1F2937";
            const courtColor = m.court ? (isPlaying ? "white" : "#9CA3AF") : "#374151";

            return (
              <Box key={m.id} onClick={() => handleStatus(m, i)} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                {/* 시드 번호 카드 */}
                <Box sx={{ bgcolor: cardBg, borderRadius: "5px", px: 1.25, py: 0.75, textAlign: "center", minWidth: 42, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Typography sx={{ color: numColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{p1Idx + 1}</Typography>
                  <Box sx={{ width: "100%", height: "1px", bgcolor: "#4B5563", my: 0.25 }} />
                  <Typography sx={{ color: numColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{p2Idx + 1}</Typography>
                </Box>
                {/* 코트 배지: 코트 미배정이면 글자색=배경색(사실상 투명하게) */}
                <Box sx={{ bgcolor: courtBg, borderRadius: "100px", px: 0.75, py: 0.15 }}>
                  <Typography sx={{ fontSize: 8, color: courtColor, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {m.court || "미정"}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
/**
 * 리그 대진표 페이지
 *
 * document.body에 Portal로 렌더링 → 전체화면(fixed) 오버레이 형태
 * 라우트: /league/:id/bracket
 *
 * 주요 기능:
 * 1. 리그 참가자 간 라운드로빈 대진표 표시
 * 2. 점수 편집 (canManage && 경기 상태가 playing/done인 경우)
 * 3. 시드 순서 편집 (수정 버튼 클릭 → editMode, 드래그 또는 ↑↓ 버튼)
 * 4. 승/패/순위/동점자 세트 득실 자동 집계
 * 5. landscape(가로) ↔ portrait(세로, writingMode 활용) 전환
 * 6. 15초 폴링으로 실시간 경기 데이터 갱신
 */
export default function LeagueBracket() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── 데이터 페칭 ──────────────────────────────────────────────────────────
  // 참가자·경기는 15초마다 자동 갱신 (실시간 점수 반영)
  const { data: leagueData, isLoading: leagueLoading, refetch: refetchLeague } =
    useGetLeagueQuery(id ?? "", { skip: !id });
  const { data: participantData, isLoading: participantsLoading, refetch: refetchParticipants } =
    useGetLeagueParticipantsQuery(id ?? "", { skip: !id, pollingInterval: 15000 });
  const { data: matchData, refetch: refetchMatches } =
    useGetLeagueMatchesQuery(id ?? "", { skip: !id, pollingInterval: 15000 });

  const league          = leagueData?.league;
  // useMemo로 감싸서 matchData 객체 참조가 바뀔 때만 재생성 (불필요한 하위 useMemo 재실행 방지)
  const matches         = useMemo(() => matchData?.matches ?? [], [matchData]);
  const rawParticipants = useMemo(() => participantData?.participants ?? [], [participantData]);

  // ── 권한 ─────────────────────────────────────────────────────────────────
  // canManage: 점수 편집 + 시드 순서 변경 가능 여부
  const { data: groupData } = useGetGroupDetailQuery(league?.group_id ?? "", { skip: !league?.group_id });
  const authUser  = useAppSelector((s) => s.auth.user);
  const isCreator = !!authUser && league?.created_by_id === authUser.id;
  const canManage = groupData?.myRole === "owner" || groupData?.myRole === "admin" || isCreator;
  const canScore = canManage || league?.join_permission === "public";
  // 그룹 멤버 이름 우선, 없으면 계정 이름, 비로그인 게스트는 localStorage 저장 이름 사용
  const myName    = groupData?.members?.find((m) => m.user_id === authUser?.id)?.name
    ?? authUser?.name
    ?? (id ? localStorage.getItem(`guestName_${id}`) : null)
    ?? null;

  // ── 참가자 순서 상태 ──────────────────────────────────────────────────────
  // editOrder=null: 서버 데이터(rawParticipants) 그대로 사용
  // editOrder≠null: 사용자가 순서를 변경한 로컬 상태 (서버에도 즉시 반영)
  const [editOrder, setEditOrder] = useState<typeof rawParticipants | null>(null);
  const localOrder = editOrder ?? rawParticipants;
  const setLocalOrder = useCallback(
    (fn: (prev: typeof rawParticipants) => typeof rawParticipants) =>
      setEditOrder((prev) => fn(prev ?? rawParticipants)),
    [rawParticipants],
  );

  // ── UI 상태 ───────────────────────────────────────────────────────────────
  // editMode: 시드 번호 순서 변경 모드 (점수 편집과는 별개)
  const [editMode, setEditMode]       = useState(false);
  // rulesAnchor: 경기 규칙 Popover 앵커 (null이면 닫힘)
  const [rulesAnchor, setRulesAnchor] = useState<HTMLButtonElement | null>(null);
  // landscape: false=세로(writingMode 회전) / true=가로(일반 layout)
  const [landscape, setLandscape]     = useState(false);

  // ── 스케일 계산 ───────────────────────────────────────────────────────────
  // 참가자 수에 따라 테이블이 화면보다 클 수 있으므로 CSS scale로 축소 fit
  // portrait 모드는 writingMode로 90° 회전되어 있어 물리적 tw/th가 시각 기준과 반전됨
  const wrapperRef      = useRef<HTMLDivElement>(null);  // 화면 영역 ref
  const wrapperTableRef = useRef<HTMLDivElement>(null);  // 전체 transform 컨테이너 ref
  const tableOnlyRef    = useRef<HTMLDivElement>(null);  // 스케일 계산용: 테이블만 (schedule 제외)
  const [autoFitScale, setAutoFitScale] = useState(1);  // 화면에 딱 맞는 자동 스케일
  const [naturalTw, setNaturalTw]       = useState(0);  // 테이블 원본(비스케일) 너비
  const [naturalTh, setNaturalTh]       = useState(0);  // 테이블 원본(비스케일) 높이
  const [userZoom, setUserZoom]         = useState(1);  // 사용자 줌 배율 (1 = 자동 fit)
  const dataReady = !!league && rawParticipants.length > 0; // 데이터 로드 완료 여부 (useLayoutEffect deps)

  // 기기 실제 회전 감지 → landscape 자동 동기화 + userZoom 리셋
  useEffect(() => {
    const syncOrientation = () => {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      setLandscape(isLandscape);
      setUserZoom(1);
    };
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", syncOrientation);
    // 최초 진입 시 기기 방향에 맞게 초기화
    syncOrientation();
    return () => mq.removeEventListener("change", syncOrientation);
  }, []);

  useLayoutEffect(() => {
    const updateScale = () => {
      if (!wrapperRef.current || !wrapperTableRef.current) return;
      const ww = wrapperRef.current.clientWidth;
      const wh = wrapperRef.current.clientHeight;
      const tw = wrapperTableRef.current.scrollWidth;
      const th = wrapperTableRef.current.scrollHeight;
      if (!tw || !th) return;
      // landscape: 가로/세로 중 작은 비율 기준 fit → overflow 없이 화면에 꽉 맞춤 (상한 없음)
      // portrait:  writingMode 90° 회전 → 시각 너비=th, 시각 높이=tw
      //            schedule 패널이 vertical-rl에서 scrollHeight를 왜곡하므로 테이블만 측정
      const thForScale = (!landscape && tableOnlyRef.current)
        ? tableOnlyRef.current.scrollHeight
        : th;
      setAutoFitScale(landscape ? Math.min(ww / tw, wh / th) : ww / thForScale);
      setNaturalTw(tw);
      setNaturalTh(th);
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (wrapperRef.current)      ro.observe(wrapperRef.current);
    if (wrapperTableRef.current) ro.observe(wrapperTableRef.current);
    if (tableOnlyRef.current)    ro.observe(tableOnlyRef.current);
    window.addEventListener("resize", updateScale);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateScale); };
  }, [landscape, dataReady]);

  // ── DnD 순서 변경 ─────────────────────────────────────────────────────────
  const [reorderParticipants] = useReorderLeagueParticipantsMutation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),   // 마우스: 8px 이상 이동 시 드래그 시작
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }), // 터치: 200ms 롱프레스 후 드래그
  );

  // 버튼 ↑↓ 클릭으로 한 칸 이동 (인접 요소와 swap 후 서버에 전체 순서 저장)
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

  // 드래그 앤 드롭으로 임의 위치 이동 (arrayMove 후 서버에 전체 순서 저장)
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

  // 수동 새로고침: 리그·참가자·경기 3개 쿼리 동시 refetch
  const handleRefresh = useCallback(() => {
    refetchLeague();
    refetchParticipants();
    refetchMatches();
  }, [refetchLeague, refetchParticipants, refetchMatches]);

  // 이미지 저장: 테이블을 가로 방향으로 캡처 후 PNG 다운로드
  const handleSaveImage = useCallback(async () => {
    const el = wrapperTableRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.writingMode = "horizontal-tb";
    clone.style.position = "fixed";
    clone.style.top = "-99999px";
    clone.style.left = "0";
    document.body.appendChild(clone);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `대진표_${league?.name ?? "bracket"}.png`;
      a.click();
    } finally {
      document.body.removeChild(clone);
    }
  }, [league?.name]);

  // 인쇄: 이미지로 캡처 후 새 창 인쇄
  const handlePrint = useCallback(async () => {
    const el = wrapperTableRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.writingMode = "horizontal-tb";
    clone.style.position = "fixed";
    clone.style.top = "-99999px";
    clone.style.left = "0";
    document.body.appendChild(clone);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`<html><head><title>대진표</title><style>body{margin:0}img{max-width:100%}@media print{body{margin:0}}</style></head><body><img src="${canvas.toDataURL("image/png")}" /></body></html>`);
      win.document.close();
      win.focus();
      win.onload = () => { win.print(); };
    } finally {
      document.body.removeChild(clone);
    }
  }, []);

  // ── 경기 데이터 ───────────────────────────────────────────────────────────
  // matchLookup: "aId__bId" 또는 "bId__aId" 양방향 키로 O(1) 조회
  // (행·열 참가자 ID 조합이 a/b 순서와 무관하게 매칭되도록 양방향 저장)
  const matchLookup = useMemo(() => {
    const map = new Map<string, LeagueMatch>();
    for (const m of matches) {
      if (m.participant_a_id && m.participant_b_id) {
        map.set(`${m.participant_a_id}__${m.participant_b_id}`, m);
        map.set(`${m.participant_b_id}__${m.participant_a_id}`, m);
      }
    }
    return map;
  }, [matches]);

  const { playerStats, rankings, tieSetDiffs } = useMatchStats(localOrder, matches);

  // ── 로딩 / 빈 상태 ───────────────────────────────────────────────────────
  if (leagueLoading || participantsLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!league || rawParticipants.length === 0) return null;

  const n             = localOrder.length;
  const leagueStarted = league.status === "completed"; // 완료 상태면 수정 버튼 숨김
  const date          = formatLeagueDate(league.start_date);
  const winScore      = getWinScore(league.rules);
  const appliedScale  = autoFitScale * userZoom;
  // 줌 > 1이면 테이블이 화면을 초과 → 스크롤 가능하도록 시각적 크기를 spacer로 잡아줌
  // portrait: 90° 회전이므로 시각 너비=naturalTh, 시각 높이=naturalTw
  const visualW = naturalTw > 0 ? (landscape ? naturalTw : naturalTh) * appliedScale : 0;
  const visualH = naturalTh > 0 ? (landscape ? naturalTh : naturalTw) * appliedScale : 0;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return createPortal(
    <Box sx={{ bgcolor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", inset: 0, zIndex: 9999 }}>

      {/* ===== 헤더 바 ===== */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.75, borderBottom: "1px solid #E5E7EB", gap: 0.5 }}>
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ flexShrink: 0 }}>
          <ChevronLeftIcon />
        </IconButton>

        {/* 리그 정보 요약 + 규칙 설명 버튼 */}
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

        {/* 수정 버튼: 리그 완료 전 + 관리 권한자에게만 표시 */}
        {!leagueStarted && canManage && (
          <Button
            size="small"
            variant="contained"
            startIcon={editMode ? <CheckIcon sx={{ fontSize: 14 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
            onClick={() => setEditMode((v) => !v)}
            sx={{
              borderRadius: "20px", fontSize: 11, fontWeight: 700, px: 1.5, py: 0.4,
              textTransform: "none", flexShrink: 0, minWidth: "auto", boxShadow: "none",
              bgcolor: editMode ? "#10B981" : COLOR.primary,
              "&:hover": { bgcolor: editMode ? "#059669" : "#1D4ED8", boxShadow: "none" },
            }}
          >
            {editMode ? "완료" : "수정"}
          </Button>
        )}

        {/* 닫기 (뒤로 이동) */}
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
        transformOrigin={{ vertical: "top",    horizontal: "right" }}
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

      {/* ===== 대진표 영역 ===== */}
      <Box ref={wrapperRef} sx={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0, bgcolor: "#F0F2F5" }}>

        {/* 스크롤 가능한 내부 컨테이너: spacer가 실제로 넘칠 때만 scrollbar 등장 (overflow:auto는 항상 켜두기) */}
        <Box sx={{ position: "absolute", inset: 0, overflow: "auto" }}>
          {/* spacer: CSS transform은 레이아웃 크기에 영향을 안 주므로
              시각적 크기만큼 spacer를 두어 스크롤 범위를 확보 */}
          <Box sx={{ width: visualW || "100%", height: visualH || "100%", minWidth: "100%", minHeight: "100%", position: "relative", flexShrink: 0 }}>
            {/* 대진표 + 경기 순서 (scale 변환 컨테이너) */}
            <Box
              ref={wrapperTableRef}
              sx={{
                // portrait 모드: writingMode로 콘텐츠 전체를 90° 회전 → 세로 화면에서도 가로 테이블을 표시
                // landscape 모드: 일반 layout, scale만 적용
                ...(!landscape && { writingMode: "vertical-rl", textOrientation: "sideways" }),
                transformOrigin: "top left",
                transform: `scale(${appliedScale})`,
                display: "inline-block",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
          {/* 대진표 테이블 (DnD 컨텍스트 내부) */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <TableContainer ref={tableOnlyRef} component={Paper} elevation={3} sx={{ borderRadius: "10px", overflow: "hidden" }}>
              <Table sx={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "3px" }}>
                <TableHead>
                  {/* 1행: 시드 번호 원형 배지 (열 헤더) */}
                  <TableRow>
                    <NumberHeaderCell colSpan={2} rowSpan={2} sx={{ fontSize: 9, color: "#9CA3AF", fontWeight: 600, letterSpacing: 0.3 }}>참가명단</NumberHeaderCell>
                    {localOrder.map((_, idx) => (
                      <NumberHeaderCell key={idx}>
                        <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#3B82F6", color: "white", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {idx + 1}
                        </Box>
                      </NumberHeaderCell>
                    ))}
                    <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#F0FDF4", color: COLOR.win }}>승</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2} sx={{ bgcolor: "#FFF1F2", color: COLOR.loss }}>패</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2}>순위</NumberHeaderCell>
                    <NumberHeaderCell rowSpan={2} sx={{ fontSize: landscape ? "13px" : "14px" }}>동점자{<br />}세트 득실</NumberHeaderCell>
                  </TableRow>
                  {/* 2행: 참가자 이름 (열 헤더, portrait에서 세로로 표시) */}
                  <TableRow>
                    {localOrder.map((p) => {
                      const isMe = !!myName && p.name === myName;
                      return (
                        <NameHeaderCell key={p.id} sx={isMe ? { bgcolor: COLOR.myHighlight } : undefined}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4, flexWrap: "wrap" }}>
                            <DivBadge division={p.division} />
                            {/* portrait: minHeight로 세로 공간 확보 */}
                            <Box component="span" sx={{ minHeight: landscape ? "" : "70px", color: isMe ? COLOR.myText : "inherit", fontWeight: isMe ? 700 : "inherit" }}>
                              {p.name}
                            </Box>
                          </Box>
                        </NameHeaderCell>
                      );
                    })}
                  </TableRow>
                </TableHead>

                {/* 바디: 참가자별 행 (SortableContext로 DnD 순서 관리) */}
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
                        canManage={canManage}
                        canScore={canScore}
                        onMove={handleMove}
                        landscape={landscape}
                        matchLookup={matchLookup}
                        wins={playerStats[rowIdx]?.wins ?? 0}
                        losses={playerStats[rowIdx]?.losses ?? 0}
                        rank={rankings[rowIdx] ?? 0}
                        tieSetDiff={tieSetDiffs[rowIdx] ?? ""}
                        hasPlayed={playerStats[rowIdx]?.hasPlayed ?? false}
                        leagueId={id ?? ""}
                        winScore={winScore}
                        isMe={!!myName && rowPlayer.name === myName}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </TableContainer>
          </DndContext>

          {/* 경기 순서 패널 */}
          <MatchSchedulePanel matches={matches} localOrder={localOrder} landscape={landscape} leagueId={id ?? ""} />
            </Box>{/* /wrapperTableRef */}
          </Box>{/* /spacer */}
        </Box>{/* /scrollableInner */}

        {/* 플로팅 버튼들 (position: absolute, wrapperRef 기준 → 스크롤 영역 위에 고정) */}

        {/* 이미지 저장 / 인쇄 버튼 */}
        <Box sx={{ position: "absolute", bottom: 220, right: 14, zIndex: 10, writingMode: landscape ? "horizontal-tb" : "vertical-rl", bgcolor: "#fff", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", alignItems: "center", p: 0.25 }}>
          <Tooltip title="이미지 저장">
            <IconButton size="small" onClick={handleSaveImage}>
              <DownloadIcon sx={{ fontSize: 18, ...(landscape ? {} : { transform: "rotate(90deg)" }) }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="인쇄">
            <IconButton size="small" onClick={handlePrint}>
              <PrintIcon sx={{ fontSize: 18, ...(landscape ? {} : { transform: "rotate(90deg)" }) }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 줌 컨트롤: portrait=세로(writing-mode 회전), landscape=가로 */}
        <Box sx={{ position: "absolute", bottom: 126, right: 14, zIndex: 10, writingMode: landscape ? "horizontal-tb" : "vertical-rl", bgcolor: "#fff", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", alignItems: "center", p: 0.25 }}>
          <IconButton size="small" onClick={() => setUserZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}>
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#6B7280", lineHeight: 1, my: 0.25 }}>
            {Math.round(userZoom * 100)}%
          </Typography>
          <IconButton size="small" disabled={userZoom <= 0.5} onClick={() => setUserZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Tooltip title="새로고침">
          <IconButton onClick={handleRefresh} sx={{ position: "absolute", bottom: 67, right: 14, zIndex: 10, writingMode: landscape ? "horizontal-tb" : "vertical-rl", bgcolor: "#fff", color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: "#F3F4F6" } }}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={landscape ? "세로 보기" : "가로 보기"}>
          <IconButton onClick={() => { setLandscape((v) => !v); setUserZoom(1); }} sx={{ position: "absolute", bottom: 14, right: 14, zIndex: 10, writingMode: landscape ? "horizontal-tb" : "vertical-rl", bgcolor: landscape ? COLOR.primary : "#fff", color: landscape ? "#fff" : "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: landscape ? "#1D4ED8" : "#F3F4F6" } }}>
            <ScreenRotationIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

      </Box>{/* /wrapperRef */}
    </Box>,
    document.body
  );
}
