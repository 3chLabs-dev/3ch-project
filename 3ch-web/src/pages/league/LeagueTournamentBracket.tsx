import { createPortal } from "react-dom";
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, IconButton, InputAdornment,
  TextField, Tooltip, Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  useGetLeagueQuery,
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useAssignMatchParticipantMutation,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { formatLeagueDate } from "../../utils/dateUtils";

// ─── 단일 토너먼트 레이아웃 상수 ────────────────────────────────────────────
// 단일 토너먼트(라운드로빈 등)에서 매치 박스를 좌→우 방향으로 나열할 때 사용
const MW = 152;  // 매치 박스 너비 (px)
const MH = 60;   // 매치 박스 높이 - 상단 슬롯(A) + 하단 슬롯(B) 포함
const RGAP = 56; // 라운드 간 수평 간격 (라운드 사이 SVG 커넥터 공간)
const PX = 32;   // 캔버스 좌우 패딩
const PT = 40;   // 캔버스 상단 패딩 (라운드 레이블 공간)
const PB = 32;   // 캔버스 하단 패딩

// ─── 상·하위 (center-out) 레이아웃 상수 ─────────────────────────────────────
// 상·하위 토너먼트는 16강이 중앙에, 상위 브래킷이 위로, 하위 브래킷이 아래로 펼쳐지는
// "center-out" 구조를 사용한다. 각 라운드는 CO_ROW_H 간격으로 수직 배치됨.
const CO_PT = 110;        // 캔버스 상단 패딩 — 상위 우승자 박스(CO_WINNER_H + 여백) 공간 포함
const CO_WINNER_W = 214;  // 우승자 박스 너비 — CO_MATCH_W와 동일하게 맞춤
const CO_WINNER_H = 72;   // 우승자 박스 높이
const VB_LABEL_H = 20;    // 각 슬롯 박스 상단 라운드/시드 레이블 영역 높이
const CO_ROW_H = 140;     // 라운드 간 수직 간격 (SVG 커넥터 포함)
const CO_H_GAP = 20;      // 같은 라운드 내 매치 간 수평 간격
const CO_GROUP_GAP = 30;  // 2경기씩 묶인 그룹 간 추가 수평 간격 (시각적 그루핑)
const CO_CENTER_GAP = 52; // 좌측 절반과 우측 절반 사이 중앙 빈 공간 (결승선 공간)
const CO_PX = 20;         // 캔버스 좌우 패딩

// ─── 개별 슬롯 박스 (상·하위 전 라운드) 상수 ────────────────────────────────
// 상·하위 토너먼트에서 A 슬롯과 B 슬롯을 독립 박스로 나란히 렌더링
const SS_W = 96;          // 슬롯 박스 너비 (이름이 잘리지 않도록 충분히 확보)
const SS_H = 76;          // 슬롯 박스 높이 (라벨 20 + 이름 영역 + 점수 영역 24)
const SS_GAP = 22;        // A·B 슬롯 사이 간격 — "vs" 텍스트 표시 공간
const CO_MATCH_W = SS_W * 2 + SS_GAP;  // 매치 1개 전체 너비 = 96*2 + 22 = 214px

// ─── 표준 토너먼트 시드 배치 ────────────────────────────────────────────────
/**
 * n명 규모 토너먼트의 시드 배치 순서를 반환한다.
 * 백엔드(league.js)의 seededBracket 함수와 동일한 알고리즘을 사용하므로
 * 서버에서 배정한 참가자와 프론트 시드 표시가 일치한다.
 *
 * 반환값은 매치 슬롯 순서대로 나열된 시드 번호 배열:
 *   seededBracket(8) = [1,8, 4,5, 3,6, 2,7]
 *   seededBracket(16) = [1,16, 8,9, 5,12, 4,13, 3,14, 6,11, 7,10, 2,15]
 *
 * 알고리즘:
 *   1. buildPrimary: 재귀적으로 상위 시드를 절반씩 분할하여 좌·우 서브트리에 배치
 *   2. 최종 배열: primary[i]와 그 상대(n+1-primary[i])를 쌍으로 나열
 */
function seededBracket(n: number): number[] {
  function buildPrimary(size: number): number[] {
    if (size === 2) return [1];
    const prev = buildPrimary(size / 2);
    const half = size / 2;
    const result: number[] = [];
    for (let i = 0; i < prev.length; i++) {
      const s = prev[i];
      const comp = half + 1 - s;
      if (i % 2 === 0) { result.push(s, comp); }
      else             { result.push(comp, s); }
    }
    return result;
  }
  const primary = buildPrimary(n);
  const result: number[] = [];
  for (const s of primary) result.push(s, n + 1 - s);
  return result;
}

// ─── 위치 타입 ───────────────────────────────────────────────────────────────
interface MatchPos { id: string; x: number; y: number; match: LeagueMatch }

// ─── 슬롯 액션 타입 ──────────────────────────────────────────────────────────
interface SlotActions {
  canManage: boolean;
  canRegister: boolean; // 수동 편성일 때만 true
  editMode: boolean;
  swapFirstKey: string | null; // "{matchId}:{slot}"
  seedMap: Map<string, { a: number; b: number }>;
  onRegister: (matchId: string, slot: "a" | "b") => void;
  onSwapSelect: (matchId: string, slot: "a" | "b", participantId: string | null, name: string | null) => void;
}

// ─── 단일 토너먼트 위치 계산 (좌→우) ────────────────────────────────────────
/**
 * 단일 토너먼트(싱글·라운드로빈)의 각 매치에 캔버스 좌표(x, y)를 계산한다.
 *
 * 레이아웃 규칙:
 *   - X축: 라운드 번호에 따라 왼쪽(1라운드)→오른쪽(결승) 방향으로 배치
 *          x = PX + (round - 1) * (MW + RGAP)
 *   - Y축: 1라운드 매치를 균등 간격으로 나열하고,
 *          상위 라운드는 자식 두 매치의 Y 중간값에 배치 (트리 중앙 정렬)
 *
 * upper 브래킷(bracket=null 또는 'upper') 매치만 처리하며,
 * match_order 기준으로 정렬 후 계산한다.
 */
function calcPositions(matches: LeagueMatch[]): MatchPos[] {
  const upper = matches.filter(
    (m) => m.round_number != null && (!m.bracket || m.bracket === "upper"),
  );
  if (!upper.length) return [];

  const byRound = new Map<number, LeagueMatch[]>();
  for (const m of upper) {
    const r = m.round_number!;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  }
  for (const arr of byRound.values()) arr.sort((a, b) => a.match_order - b.match_order);

  const maxRound = Math.max(...byRound.keys());
  const yMap = new Map<string, number>();
  (byRound.get(1) ?? []).forEach((m, i) => yMap.set(m.id, i * (MH + 8)));
  for (let r = 2; r <= maxRound; r++) {
    const prev = byRound.get(r - 1) ?? [];
    const curr = byRound.get(r) ?? [];
    curr.forEach((m, i) => {
      const a = prev[i * 2], b = prev[i * 2 + 1];
      if (a && b) yMap.set(m.id, ((yMap.get(a.id) ?? 0) + (yMap.get(b.id) ?? 0)) / 2);
    });
  }

  const result: MatchPos[] = [];
  for (const [r, arr] of byRound) {
    const x = PX + (r - 1) * (MW + RGAP);
    for (const m of arr) result.push({ id: m.id, x, y: PT + (yMap.get(m.id) ?? 0), match: m });
  }
  return result;
}

// ─── 상·하위 토너먼트 위치 계산 (center-out) ─────────────────────────────────
/**
 * 상·하위 토너먼트(더블 엘리미네이션)의 각 매치에 캔버스 좌표를 계산한다.
 *
 * center-out 레이아웃 구조:
 *   ┌─────────────────────────────┐
 *   │      [상위 결승]             │  ← 최상단 (round=maxUpper, y=CO_PT)
 *   │    [상위 4강] [상위 4강]     │
 *   │  [상위 8강] ... [상위 8강]   │
 *   │        [16강 중앙 배치]      │  ← centerY (상·하위 분기점)
 *   │  [하위 8강] ... [하위 8강]   │
 *   │    [하위 4강] [하위 4강]     │
 *   │      [하위 결승]             │  ← 최하단
 *   └─────────────────────────────┘
 *
 * X축 계산 (1라운드):
 *   - 전체 매치를 좌 절반 / 우 절반으로 나누고, 절반 내부는 2경기씩 그룹화
 *   - 좌 절반: CO_PX부터 오른쪽으로, 우 절반: 중앙 간격(CO_CENTER_GAP) 이후 오른쪽으로
 *   - 2경기 그룹 사이에 CO_GROUP_GAP 추가 (시각적 구분)
 *   - 상위 라운드는 자식 두 매치의 x 평균으로 중앙 정렬
 *
 * Y축 계산:
 *   - centerY = CO_PT + (maxUpper - 1) * CO_ROW_H (1라운드 위치)
 *   - 상위 라운드: centerY - (round - 1) * CO_ROW_H  (위로 올라감)
 *   - 하위 라운드: centerY + round * CO_ROW_H         (아래로 내려감)
 *
 * 하위 브래킷 X 좌표는 상위 패자(loser_next_match_id)와 하위 승자(next_match_id)
 * 의 X 평균으로 결정해 연결선이 자연스럽게 이어지도록 한다.
 */
function calcCenterOutPositions(matches: LeagueMatch[]): MatchPos[] {
  const upper = matches.filter(
    (m) => m.round_number != null && (!m.bracket || m.bracket === "upper"),
  );
  if (!upper.length) return [];

  const upperByRound = new Map<number, LeagueMatch[]>();
  for (const m of upper) {
    const r = m.round_number!;
    if (!upperByRound.has(r)) upperByRound.set(r, []);
    upperByRound.get(r)!.push(m);
  }
  for (const arr of upperByRound.values()) arr.sort((a, b) => a.match_order - b.match_order);

  const xMap = new Map<string, number>();

  const r1 = upperByRound.get(1) ?? [];
  const n = r1.length;
  const half = Math.ceil(n / 2);
  r1.forEach((m, i) => {
    const j = i < half ? i : i - half;
    const groupOffset = Math.floor(j / 2) * CO_GROUP_GAP;
    const x = i < half
      ? CO_PX + i * (CO_MATCH_W + CO_H_GAP) + groupOffset
      : CO_PX + half * (CO_MATCH_W + CO_H_GAP) + Math.floor(half / 2) * CO_GROUP_GAP + CO_CENTER_GAP + j * (CO_MATCH_W + CO_H_GAP) + groupOffset;
    xMap.set(m.id, x);
  });

  const maxUpper = Math.max(...upperByRound.keys());
  for (let r = 2; r <= maxUpper; r++) {
    const prev = upperByRound.get(r - 1) ?? [];
    const curr = upperByRound.get(r) ?? [];
    curr.forEach((m, i) => {
      const src1 = prev[i * 2];
      const src2 = prev[i * 2 + 1];
      const x1 = xMap.get(src1?.id ?? "") ?? CO_PX;
      const x2 = xMap.get(src2?.id ?? "") ?? x1;
      xMap.set(m.id, (x1 + x2) / 2);
    });
  }

  const centerY = CO_PT + (maxUpper - 1) * CO_ROW_H;
  const result: MatchPos[] = [];

  for (const [r, arr] of upperByRound) {
    const y = centerY - (r - 1) * CO_ROW_H;
    for (const m of arr) result.push({ id: m.id, x: xMap.get(m.id) ?? CO_PX, y, match: m });
  }

  const lower = matches.filter(
    (m) => m.round_number != null && m.bracket === "lower",
  );
  if (lower.length) {
    const lowerByRound = new Map<number, LeagueMatch[]>();
    for (const m of lower) {
      const r = m.round_number!;
      if (!lowerByRound.has(r)) lowerByRound.set(r, []);
      lowerByRound.get(r)!.push(m);
    }
    for (const arr of lowerByRound.values()) arr.sort((a, b) => a.match_order - b.match_order);

    const fromUpper = new Map<string, string[]>();
    for (const m of upper) {
      if (m.loser_next_match_id) {
        if (!fromUpper.has(m.loser_next_match_id)) fromUpper.set(m.loser_next_match_id, []);
        fromUpper.get(m.loser_next_match_id)!.push(m.id);
      }
    }
    const fromLower = new Map<string, string[]>();
    for (const m of lower) {
      if (m.next_match_id) {
        if (!fromLower.has(m.next_match_id)) fromLower.set(m.next_match_id, []);
        fromLower.get(m.next_match_id)!.push(m.id);
      }
    }

    const maxLower = Math.max(...lowerByRound.keys());
    for (let r = 1; r <= maxLower; r++) {
      for (const m of lowerByRound.get(r) ?? []) {
        if (xMap.has(m.id)) continue;
        const srcs = [...(fromUpper.get(m.id) ?? []), ...(fromLower.get(m.id) ?? [])];
        xMap.set(m.id, srcs.length
          ? srcs.reduce((s, id) => s + (xMap.get(id) ?? 0), 0) / srcs.length
          : CO_PX);
      }
    }

    for (const [r, arr] of lowerByRound) {
      const y = centerY + r * CO_ROW_H;
      for (const m of arr) result.push({ id: m.id, x: xMap.get(m.id) ?? CO_PX, y, match: m });
    }
  }

  return result;
}

// ─── 매치 박스 (단일 토너먼트용) ─────────────────────────────────────────────
/**
 * 단일 토너먼트에서 사용하는 매치 박스 컴포넌트.
 * 세로로 A 슬롯(상단)과 B 슬롯(하단)이 배치된다.
 *
 * 기능:
 *   - 라운드 레이블 / 시드 번호 표시 (1라운드만 시드 표시)
 *   - 부수(division) 주황 원형 배지 표시
 *   - 승자 슬롯은 초록 배경으로 강조
 *   - 편성 모드(editMode): 슬롯 클릭 시 스왑 대상 선택 (파란 테두리 강조)
 *   - 등록 모드(canRegister + !editMode): 비어있는 슬롯 클릭 시 참가자 등록 팝업
 *   - BYE: 1라운드에 참가자가 없으면 이탤릭 "BYE" 표시
 */
function MatchBox({ pos, actions }: { pos: MatchPos; actions?: SlotActions }) {
  const { x, y, match: m } = pos;
  const isLower = m.bracket === "lower";
  const isR1 = m.round_number === 1 && !isLower;
  const done = m.status === "done";
  const winA = done && m.score_a != null && m.score_b != null && m.score_a > m.score_b;
  const winB = done && m.score_a != null && m.score_b != null && m.score_b > m.score_a;
  const nameA = m.participant_a_name;
  const nameB = m.participant_b_name;
  const isByeA = !nameA && isR1;
  const isByeB = !nameB && isR1;

  const swapSelA = actions?.swapFirstKey === `${m.id}:a`;
  const swapSelB = actions?.swapFirstKey === `${m.id}:b`;
  const seed = actions?.seedMap?.get(m.id);

  const handleSlotA = () => {
    if (!actions || !isR1) return;
    if (actions.editMode) {
      actions.onSwapSelect(m.id, "a", m.participant_a_id, nameA ?? null);
    } else if (actions.canRegister && !nameA) {
      actions.onRegister(m.id, "a");
    }
  };

  const handleSlotB = () => {
    if (!actions || !isR1) return;
    if (actions.editMode) {
      actions.onSwapSelect(m.id, "b", m.participant_b_id, nameB ?? null);
    } else if (actions.canRegister && !nameB) {
      actions.onRegister(m.id, "b");
    }
  };

  const slotACursor = isR1 && (actions?.canRegister && !nameA) || (actions?.canManage && actions.editMode) ? "pointer" : "default";
  const slotBCursor = isR1 && (actions?.canRegister && !nameB) || (actions?.canManage && actions.editMode) ? "pointer" : "default";

  return (
    <Box sx={{
      position: "absolute", left: x, top: y,
      width: MW, height: MH,
      bgcolor: isLower ? "#FAF5FF" : "background.paper",
      border: `1.5px solid ${isLower ? "#DDD6FE" : "#E2E8F0"}`,
      borderRadius: "6px",
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    }}>
      <Box
        onClick={handleSlotA}
        sx={{
          height: MH / 2, display: "flex", alignItems: "center", px: 1, gap: 0.5,
          borderBottom: `1px solid ${isLower ? "#EDE9FE" : "#F1F5F9"}`,
          bgcolor: swapSelA ? "#DBEAFE" : winA ? "#F0FDF4" : "transparent",
          cursor: slotACursor,
          outline: swapSelA ? "2px solid #3B82F6" : "none",
        }}
      >
        {m.participant_a_division && (
          <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#111827", flexShrink: 0, lineHeight: 1 }}>{m.participant_a_division}</Box>
        )}
        {isR1 && !nameA ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
            {seed?.a && <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#94A3B8" }}>1-{seed.a}</Typography>}
            {actions?.canRegister && !actions.editMode && (
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#93C5FD" }}>등록</Typography>
            )}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 11, fontWeight: isByeA ? 400 : 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: winA ? "#16A34A" : isByeA ? "#9CA3AF" : "text.primary", fontStyle: isByeA ? "italic" : "normal" }}>
            {nameA ?? (isR1 ? "BYE" : "")}
          </Typography>
        )}
        {m.score_a != null && <Typography sx={{ fontSize: 12, fontWeight: 800, color: winA ? "#16A34A" : "#6B7280", flexShrink: 0 }}>{m.score_a}</Typography>}
      </Box>
      <Box
        onClick={handleSlotB}
        sx={{
          height: MH / 2, display: "flex", alignItems: "center", px: 1, gap: 0.5,
          bgcolor: swapSelB ? "#DBEAFE" : winB ? "#F0FDF4" : "transparent",
          cursor: slotBCursor,
          outline: swapSelB ? "2px solid #3B82F6" : "none",
        }}
      >
        {m.participant_b_division && (
          <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#111827", flexShrink: 0, lineHeight: 1 }}>{m.participant_b_division}</Box>
        )}
        {isR1 && !nameB ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
            {seed?.b && <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#94A3B8" }}>1-{seed.b}</Typography>}
            {actions?.canRegister && !actions.editMode && (
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#93C5FD" }}>등록</Typography>
            )}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 11, fontWeight: isByeB ? 400 : 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: winB ? "#16A34A" : isByeB ? "#9CA3AF" : "text.primary", fontStyle: isByeB ? "italic" : "normal" }}>
            {nameB ?? (isR1 ? "BYE" : "")}
          </Typography>
        )}
        {m.score_b != null && <Typography sx={{ fontSize: 12, fontWeight: 800, color: winB ? "#16A34A" : "#6B7280", flexShrink: 0 }}>{m.score_b}</Typography>}
      </Box>
    </Box>
  );
}

// ─── 개별 슬롯 박스 (상·하위 토너먼트용) ────────────────────────────────────
/**
 * 상·하위 토너먼트에서 A·B 슬롯을 독립적인 박스로 렌더링하는 컴포넌트.
 * MatchBox와 달리 슬롯 하나가 곧 하나의 박스이며, 두 박스가 나란히 배치된다:
 *   [슬롯A 박스] <── SS_GAP(vs 공간) ──> [슬롯B 박스]
 *
 * 레이아웃 (세로 3행):
 *   ┌──────────────────┐
 *   │  라운드/시드 레이블 │  ← VB_LABEL_H(20px), 상위=파랑, 하위=보라 배경
 *   │  부수○ 이름       │  ← flex 영역, 승자는 초록 글씨
 *   │      점수         │  ← 24px 고정, 승자는 초록 배경 + 굵은 숫자
 *   └──────────────────┘
 *
 * 클릭 동작:
 *   - editMode ON: 스왑 대상으로 선택 (파란 테두리 강조)
 *   - editMode OFF + canRegister + 빈 슬롯: 참가자 등록 팝업 열기
 *   - 이외: 클릭 무반응
 */
function SingleSlotBox({ pos, slot, actions }: { pos: MatchPos; slot: "a" | "b"; actions?: SlotActions }) {
  const { x: baseX, y, match: m } = pos;
  const x = slot === "a" ? baseX : baseX + SS_W + SS_GAP;
  const isR1 = m.round_number === 1 && m.bracket !== "lower";
  const done = m.status === "done";
  const name = slot === "a" ? m.participant_a_name : m.participant_b_name;
  const participantId = slot === "a" ? m.participant_a_id : m.participant_b_id;
  const score = slot === "a" ? m.score_a : m.score_b;
  const otherScore = slot === "a" ? m.score_b : m.score_a;
  const win = done && score != null && otherScore != null && score > otherScore;
  const isBye = !name && isR1;
  const division = slot === "a" ? m.participant_a_division : m.participant_b_division;
  const seed = actions?.seedMap?.get(m.id);
  const seedNum = slot === "a" ? seed?.a : seed?.b;
  const swapSel = actions?.swapFirstKey === `${m.id}:${slot}`;

  const handleClick = () => {
    if (!actions || !isR1) return;
    if (actions.editMode) {
      actions.onSwapSelect(m.id, slot, participantId, name ?? null);
    } else if (actions.canRegister && !name) {
      actions.onRegister(m.id, slot);
    }
  };

  const cursor = isR1 && ((actions?.canRegister && !name) || (actions?.canManage && actions.editMode)) ? "pointer" : "default";

  return (
    <Box sx={{
      position: "absolute", left: x, top: y,
      width: SS_W, height: SS_H,
      bgcolor: win ? "#F0FDF4" : swapSel ? "#DBEAFE" : "background.paper",
      border: `1.5px solid ${win ? "#86EFAC" : swapSel ? "#3B82F6" : "#E2E8F0"}`,
      borderRadius: "6px",
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      display: "flex", flexDirection: "column",
      cursor,
      outline: swapSel ? "2px solid #3B82F6" : "none",
    }} onClick={handleClick}>

      {/* 라운드/시드 레이블 */}
      <Box sx={{
        height: VB_LABEL_H, display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: m.bracket === "lower" ? "#F5F3FF" : "#EFF6FF",
        borderBottom: `1px solid ${m.bracket === "lower" ? "#DDD6FE" : "#E2E8F0"}`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: 8, fontWeight: 700, color: m.bracket === "lower" ? "#7C3AED" : "#2563EB", lineHeight: 1 }}>
          {isR1 && seedNum ? `1-${seedNum}` : (m.match_label ?? `R${m.round_number}`)}
        </Typography>
      </Box>

      {/* 이름 행 */}
      <Box sx={{ display: "flex", alignItems: "center", px: 0.75, gap: 0.4, flex: 1, minWidth: 0 }}>
        {division && (
          <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#111827", flexShrink: 0, lineHeight: 1 }}>{division}</Box>
        )}
        {isR1 && !name ? (
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#93C5FD" }}>
            {actions?.canRegister && !actions.editMode ? "등록" : ""}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 11, fontWeight: isBye ? 400 : 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: win ? "#16A34A" : isBye ? "#9CA3AF" : "#111827", fontStyle: isBye ? "italic" : "normal" }}>
            {name ?? (isR1 ? "BYE" : "")}
          </Typography>
        )}
      </Box>

      {/* 점수 행 */}
      <Box sx={{
        height: 24, display: "flex", alignItems: "center", justifyContent: "center",
        borderTop: `1px solid ${win ? "#BBF7D0" : "#F1F5F9"}`,
        bgcolor: win ? "#DCFCE7" : "#F8FAFC",
        flexShrink: 0,
      }}>
        {score != null ? (
          <Typography sx={{ fontSize: 14, fontWeight: 900, color: win ? "#16A34A" : "#374151", lineHeight: 1 }}>
            {score}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 10, color: "#CBD5E1" }}>-</Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── 단일 토너먼트 SVG 커넥터 (좌→우) ───────────────────────────────────────
/**
 * 단일 토너먼트 매치 간 연결선을 SVG path로 렌더링한다.
 *
 * 각 매치에서 next_match_id가 있는 경우 다음 라운드 매치로 수평+수직+수평
 * 꺾인 선(└─ 형태)을 그린다:
 *   M (현재 매치 우측 끝, 중앙) → H (라운드 간 중간 x) → V (다음 매치 슬롯 y) → H (다음 매치 좌측)
 *
 * next_slot='a' 이면 상단(MH/4), 'b' 이면 하단(3*MH/4) 높이에 연결된다.
 * 색상: #CBD5E1 (연한 회색)
 */
function Connectors({ positions }: { positions: MatchPos[] }) {
  const posById = new Map(positions.map((p) => [p.id, p]));
  return (
    <>
      {positions.map(({ id, x, y, match: m }) => {
        if (!m.next_match_id) return null;
        const tgt = posById.get(m.next_match_id);
        if (!tgt) return null;
        const sx = x + MW, sy = y + MH / 2;
        const tx = tgt.x;
        const ty = tgt.y + (m.next_slot === "a" ? MH / 4 : (3 * MH) / 4);
        const mx = sx + RGAP / 2;
        return <path key={`c-${id}`} d={`M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`} stroke="#CBD5E1" strokeWidth={1.5} fill="none" />;
      })}
    </>
  );
}

// ─── 상·하위 토너먼트 SVG 커넥터 ────────────────────────────────────────────
/**
 * 상·하위 토너먼트(더블 엘리미네이션)의 매치 간 연결선을 SVG path로 렌더링한다.
 *
 * 연결 종류:
 *   1. 승자 연결 (winner advancement):
 *      - byWinnerUpper: 상위 브래킷 내 승자 → 다음 상위 라운드
 *      - byWinnerLower: 하위 브래킷 내 승자 → 다음 하위 라운드
 *      모두 #94A3B8(회색) 선으로 표시
 *
 *   2. 패자 연결 (loser drop):
 *      - byLoserTarget: 상위 브래킷 패자 → 하위 브래킷 대상 매치
 *      동일하게 #94A3B8 선으로 표시
 *
 * drawBracket 내부 로직 (⊓/⊔ 브래킷 형태):
 *   - 자식 2개인 경우: 두 자식을 midY에서 수평으로 연결 후 부모로 수직 줄기
 *       M cx1 srcY → V midY → H cx2 → V srcY  (수평 팔)
 *       M pcx tgtY → V midY                    (수직 줄기)
 *   - 자식 1개인 경우: 단순 꺾인 선으로 직접 연결
 *       M cx1 srcY → V midY → H pcx → V tgtY
 *
 *   goingUp=true  (상위 브래킷): 자식이 아래(큰 Y), 부모가 위(작은 Y) → srcY=매치 상단, tgtY=부모 하단
 *   goingUp=false (하위 브래킷): 자식이 위(작은 Y), 부모가 아래(큰 Y) → srcY=매치 하단, tgtY=부모 상단
 *
 * 각 매치 중심 x(mcx) = pos.x + CO_MATCH_W / 2 로 A·B 슬롯 중앙을 기준으로 한다.
 */
function CenterOutConnectors({ positions }: { positions: MatchPos[] }) {
  const posById = new Map(positions.map((p) => [p.id, p]));
  const paths: React.ReactElement[] = [];
  const mcx = (pos: MatchPos) => pos.x + CO_MATCH_W / 2;

  const drawBracket = (
    childrenByParent: Map<string, MatchPos[]>,
    getParentPos: (id: string) => MatchPos | undefined,
    stroke: string,
    keyPrefix: string,
  ) => {
    for (const [parentId, children] of childrenByParent) {
      const parentPos = getParentPos(parentId);
      if (!parentPos) continue;
      const sorted = [...children].sort((a, b) => a.x - b.x);
      const pcx = mcx(parentPos);
      const goingUp = parentPos.y < sorted[0].y;
      // goingUp=true: 자식이 아래(큰 Y), 부모가 위(작은 Y) → 상위 브래킷
      // goingUp=false: 자식이 위(작은 Y), 부모가 아래(큰 Y) → 하위 브래킷
      const srcY = goingUp ? sorted[0].y : sorted[0].y + SS_H;
      const tgtY = goingUp ? parentPos.y + SS_H : parentPos.y;
      const midY = (srcY + tgtY) / 2;

      if (sorted.length === 2) {
        const cx1 = mcx(sorted[0]);
        const cx2 = mcx(sorted[1]);
        // ⊓ 또는 ⊔: 두 자식을 midY에서 수평 연결 + 부모 줄기
        paths.push(
          <path key={`${keyPrefix}-br-${parentId}`}
            d={`M ${cx1} ${srcY} V ${midY} H ${cx2} V ${srcY}`}
            stroke={stroke} strokeWidth={1.5} fill="none"
          />,
          <path key={`${keyPrefix}-st-${parentId}`}
            d={`M ${pcx} ${tgtY} V ${midY}`}
            stroke={stroke} strokeWidth={1.5} fill="none"
          />,
        );
      } else {
        const cx1 = mcx(sorted[0]);
        paths.push(
          <path key={`${keyPrefix}-l-${parentId}`}
            d={`M ${cx1} ${srcY} V ${midY} H ${pcx} V ${tgtY}`}
            stroke={stroke} strokeWidth={1.5} fill="none"
          />,
        );
      }
    }
  };

  // ── 승자 연결: 부모가 상위면 하늘색, 하위면 보라색 ──
  const byWinnerUpper = new Map<string, MatchPos[]>();
  const byWinnerLower = new Map<string, MatchPos[]>();
  for (const pos of positions) {
    if (!pos.match.next_match_id) continue;
    const pid = pos.match.next_match_id;
    const parentPos = posById.get(pid);
    const isLowerParent = parentPos?.match.bracket === "lower";
    const map = isLowerParent ? byWinnerLower : byWinnerUpper;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(pos);
  }
  drawBracket(byWinnerUpper, (id) => posById.get(id), "#94A3B8", "wn");
  drawBracket(byWinnerLower, (id) => posById.get(id), "#94A3B8", "wl");

  // ── 패자 연결: 소스들을 하위 대상별로 묶어서 ⊔ 브래킷 ──
  const byLoserTarget = new Map<string, MatchPos[]>();
  for (const pos of positions) {
    if (!pos.match.loser_next_match_id) continue;
    const tid = pos.match.loser_next_match_id;
    if (!byLoserTarget.has(tid)) byLoserTarget.set(tid, []);
    byLoserTarget.get(tid)!.push(pos);
  }
  drawBracket(byLoserTarget, (id) => posById.get(id), "#94A3B8", "lo");

  return <>{paths}</>;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
export default function LeagueTournamentBracket() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);

  // 참가자 등록 팝업
  const [registerTarget, setRegisterTarget] = useState<{ matchId: string; slot: "a" | "b" } | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");

  // 스왑 모드: 첫 번째 선택 슬롯
  const [swapFirst, setSwapFirst] = useState<{
    matchId: string; slot: "a" | "b";
    participantId: string | null; name: string | null;
  } | null>(null);

  const { data: leagueData, refetch: refetchLeague } = useGetLeagueQuery(id!);
  const { data: matchesData, isLoading, refetch: refetchMatches } =
    useGetLeagueMatchesQuery(id!, { pollingInterval: 15000 });
  const { data: groupData } = useGetGroupDetailQuery(
    leagueData?.league?.group_id ?? "",
    { skip: !leagueData?.league?.group_id },
  );

  const league = leagueData?.league;
  const matches = useMemo(() => matchesData?.matches ?? [], [matchesData]);

  const isDoubleElim = matches.some((m) => m.bracket === "lower");
  const canManage = groupData?.myRole === "owner" || groupData?.myRole === "admin";
  const isCompleted = league?.status === "completed";

  const { data: participantsData } = useGetLeagueParticipantsQuery(id!, { skip: !canManage });
  const participants = useMemo(() => participantsData?.participants ?? [], [participantsData]);

  const [assignParticipant, { isLoading: isAssigning }] = useAssignMatchParticipantMutation();

  const handleRefresh = () => { refetchLeague(); refetchMatches(); };

  const handleEditToggle = () => {
    setEditMode((v) => !v);
    setSwapFirst(null);
    setRegisterTarget(null);
  };

  // 등록 버튼 클릭 → 팝업 열기
  const handleRegister = (matchId: string, slot: "a" | "b") => {
    setRegisterTarget({ matchId, slot });
    setParticipantSearch("");
  };

  // 팝업에서 참가자 선택 → 슬롯에 배정
  const handleAssign = async (participantId: string) => {
    if (!registerTarget || isAssigning) return;
    const body = registerTarget.slot === "a"
      ? { participant_a_id: participantId }
      : { participant_b_id: participantId };
    await assignParticipant({ leagueId: id!, matchId: registerTarget.matchId, ...body });
    setRegisterTarget(null);
  };

  // 스왑 모드: 슬롯 클릭
  const handleSwapSelect = async (
    matchId: string, slot: "a" | "b",
    participantId: string | null, name: string | null,
  ) => {
    if (!swapFirst) {
      setSwapFirst({ matchId, slot, participantId, name });
      return;
    }
    // 같은 슬롯 클릭 → 선택 취소
    if (swapFirst.matchId === matchId && swapFirst.slot === slot) {
      setSwapFirst(null);
      return;
    }
    // 스왑 실행
    const first = swapFirst;
    setSwapFirst(null);

    if (first.matchId === matchId) {
      // 같은 매치 내 A↔B 스왑 → 한 번에 처리
      await assignParticipant({
        leagueId: id!,
        matchId,
        participant_a_id: slot === "a" ? first.participantId : participantId,
        participant_b_id: slot === "b" ? first.participantId : participantId,
      });
    } else {
      // 다른 매치 간 스왑 → 순차 처리
      const bodyFirst = first.slot === "a"
        ? { participant_a_id: participantId }
        : { participant_b_id: participantId };
      const bodySecond = slot === "a"
        ? { participant_a_id: first.participantId }
        : { participant_b_id: first.participantId };
      await assignParticipant({ leagueId: id!, matchId: first.matchId, ...bodyFirst });
      await assignParticipant({ leagueId: id!, matchId, ...bodySecond });
    }
  };

  const isManualSeeding = league?.tournament_seeding === "manual";

  // R1 상위 브래킷 배치 공식 (seededBracket 동일 로직)
  const seedMap = useMemo(() => {
    const r1Upper = matches.filter((m) => m.round_number === 1 && m.bracket !== "lower");
    const bracketSize = r1Upper.length * 2;
    if (bracketSize < 2) return new Map<string, { a: number; b: number }>();
    const positions = seededBracket(bracketSize);
    const sorted = [...r1Upper].sort((a, b) => a.match_order - b.match_order);
    const map = new Map<string, { a: number; b: number }>();
    sorted.forEach((m, i) => map.set(m.id, { a: positions[i * 2], b: positions[i * 2 + 1] }));
    return map;
  }, [matches]);

  // 배치된 참가자 ID → 시드 번호 라벨 (예: "1번", "16번")
  const assignedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [matchId, seeds] of seedMap.entries()) {
      const m = matches.find((x) => x.id === matchId);
      if (!m) continue;
      if (m.participant_a_id) map.set(m.participant_a_id, `1-${seeds.a}`);
      if (m.participant_b_id) map.set(m.participant_b_id, `1-${seeds.b}`);
    }
    return map;
  }, [matches, seedMap]);

  const slotActions: SlotActions = {
    canManage,
    canRegister: canManage && isManualSeeding,
    editMode,
    swapFirstKey: swapFirst ? `${swapFirst.matchId}:${swapFirst.slot}` : null,
    seedMap,
    onRegister: handleRegister,
    onSwapSelect: handleSwapSelect,
  };

  const positions = useMemo(
    () => isDoubleElim ? calcCenterOutPositions(matches) : calcPositions(matches),
    [matches, isDoubleElim],
  );

  // 상위/하위 우승자 계산
  const { upperWinner, lowerWinner, upperFinalPos, lowerFinalPos } = useMemo(() => {
    if (!isDoubleElim) return { upperWinner: null, lowerWinner: null, upperFinalPos: null, lowerFinalPos: null };
    const posMap = new Map(positions.map((p) => [p.id, p]));
    const upperMatches = matches.filter((m) => !m.bracket || m.bracket === "upper");
    const lowerMatches = matches.filter((m) => m.bracket === "lower");
    const maxUpperRound = Math.max(...upperMatches.map((m) => m.round_number ?? 0));
    const maxLowerRound = Math.max(...lowerMatches.map((m) => m.round_number ?? 0));
    const upperFinal = upperMatches.find((m) => m.round_number === maxUpperRound);
    const lowerFinal = lowerMatches.find((m) => m.round_number === maxLowerRound);
    const getWinner = (m?: LeagueMatch) => {
      if (!m || m.status !== "done") return null;
      const sa = m.score_a ?? 0, sb = m.score_b ?? 0;
      if (sa === sb) return null;
      return sa > sb
        ? { name: m.participant_a_name, division: m.participant_a_division }
        : { name: m.participant_b_name, division: m.participant_b_division };
    };
    return {
      upperWinner: getWinner(upperFinal),
      lowerWinner: getWinner(lowerFinal),
      upperFinalPos: upperFinal ? posMap.get(upperFinal.id) ?? null : null,
      lowerFinalPos: lowerFinal ? posMap.get(lowerFinal.id) ?? null : null,
    };
  }, [isDoubleElim, matches, positions]);

  const roundLabels = useMemo(() => {
    if (isDoubleElim) return new Map<number, string>();
    const map = new Map<number, string>();
    for (const m of matches) {
      if (m.round_number && m.match_label && (!m.bracket || m.bracket === "upper"))
        map.set(m.round_number, m.match_label);
    }
    return map;
  }, [matches, isDoubleElim]);

  const { canvasW, canvasH } = useMemo(() => {
    if (!positions.length) return { canvasW: 400, canvasH: 300 };
    if (isDoubleElim) {
      const maxX = positions.reduce((acc, p) => Math.max(acc, p.x + CO_MATCH_W), 0) + CO_PX;
      const maxY = positions.reduce((acc, p) => Math.max(acc, p.y + SS_H), 0) + CO_WINNER_H + 30 + PB;
      return { canvasW: maxX, canvasH: maxY };
    }
    const maxRound = Math.max(...positions.map((p) => p.match.round_number ?? 1));
    const w = PX * 2 + maxRound * MW + (maxRound - 1) * RGAP;
    const h = positions.reduce((acc, p) => Math.max(acc, p.y + MH), PT) + PB;
    return { canvasW: w, canvasH: h };
  }, [positions, isDoubleElim]);

  // 필터된 참가자 목록
  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    return q ? participants.filter((p) => p.name.toLowerCase().includes(q) || (p.division ?? "").toLowerCase().includes(q)) : participants;
  }, [participants, participantSearch]);

  if (isLoading) {
    return createPortal(
      <Box sx={{ bgcolor: "#fff", position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>,
      document.body,
    );
  }

  if (!positions.length) {
    return createPortal(
      <Box sx={{ bgcolor: "#fff", position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Typography color="text.secondary" mb={2}>생성된 대진표가 없습니다.</Typography>
        <Button variant="contained" disableElevation onClick={() => navigate(`/league/${id}/tournament`)}>
          대진표 생성하기
        </Button>
      </Box>,
      document.body,
    );
  }

  return createPortal(
    <Box sx={{ bgcolor: "#fff", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", inset: 0, zIndex: 9999 }}>

      {/* ── 헤더 ── */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.75, borderBottom: "1px solid #E5E7EB", gap: 0.5, flexShrink: 0 }}>
        <IconButton size="small" onClick={() => navigate(-1)} sx={{ flexShrink: 0 }}>
          <ChevronLeftIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {league ? `${formatLeagueDate(league.start_date)} / ${league.type} ${league.format ?? ""}` : ""}
          </Typography>
        </Box>

        {isDoubleElim && (
          <Box sx={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", bgcolor: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", px: 1, py: 0.25, flexShrink: 0 }}>
            상·하위
          </Box>
        )}

        {/* 스왑 모드 안내 */}
        {editMode && swapFirst && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", px: 1, py: 0.25, flexShrink: 0 }}>
            <SwapHorizIcon sx={{ fontSize: 13, color: "#3B82F6" }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#3B82F6" }}>
              {swapFirst.name ?? "BYE"} 선택됨
            </Typography>
          </Box>
        )}

        {!isCompleted && canManage && (
          <Button
            size="small"
            variant="contained"
            startIcon={editMode ? <CheckIcon sx={{ fontSize: 14 }} /> : <EditIcon sx={{ fontSize: 14 }} />}
            onClick={handleEditToggle}
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

        <IconButton size="small" onClick={() => navigate(-1)} sx={{ flexShrink: 0 }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* ── 대진표 스크롤 영역 ── */}
      <Box sx={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0, bgcolor: "#F0F2F5" }}>
        <Box sx={{ position: "absolute", top: 0, bottom: 0, left: 0, right: registerTarget ? 260 : 0, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "flex-start", transition: "right 0.2s ease" }}>
          <Box sx={{ minWidth: "100%", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Box sx={{ width: canvasW * zoom, height: canvasH * zoom, position: "relative", flexShrink: 0 }}>
            <Box sx={{
              position: "absolute", top: 0, left: 0,
              width: canvasW, height: canvasH,
              transformOrigin: "top left",
              transform: `scale(${zoom})`,
            }}>
              <svg style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} width={canvasW} height={canvasH}>
                {isDoubleElim
                  ? <CenterOutConnectors positions={positions} />
                  : <Connectors positions={positions} />
                }
              </svg>

              {!isDoubleElim && [...roundLabels.entries()].map(([r, label]) => (
                <Typography key={`lbl-${r}`} sx={{
                  position: "absolute", top: 10,
                  left: PX + (r - 1) * (MW + RGAP),
                  width: MW, textAlign: "center",
                  fontSize: 12, fontWeight: 700, color: "#64748B",
                }}>
                  {label}
                </Typography>
              ))}

              {positions.map((pos) => {
                if (!isDoubleElim) return <MatchBox key={pos.id} pos={pos} actions={canManage && !isCompleted ? slotActions : undefined} />;
                return (
                  <React.Fragment key={pos.id}>
                    <SingleSlotBox pos={pos} slot="a" actions={canManage && !isCompleted ? slotActions : undefined} />
                    <Typography sx={{
                      position: "absolute",
                      left: pos.x + SS_W,
                      top: pos.y + SS_H / 2 - 8,
                      width: SS_GAP,
                      textAlign: "center",
                      fontSize: 11, fontWeight: 900, color: "#94A3B8", lineHeight: 1,
                      pointerEvents: "none",
                    }}>vs</Typography>
                    <SingleSlotBox pos={pos} slot="b" actions={canManage && !isCompleted ? slotActions : undefined} />
                  </React.Fragment>
                );
              })}

              {/* ── 상위 우승자 박스 ── */}
              {isDoubleElim && upperFinalPos && (() => {
                const cx = upperFinalPos.x + CO_MATCH_W / 2;
                const bx = cx - CO_WINNER_W / 2;
                const by = upperFinalPos.y - CO_WINNER_H - 16;
                return (
                  <Box key="upper-winner" sx={{
                    position: "absolute", left: bx, top: by,
                    width: CO_WINNER_W, height: CO_WINNER_H,
                    bgcolor: upperWinner ? "#FFF7ED" : "#F8FAFC",
                    border: `2px solid ${upperWinner ? "#FB923C" : "#E2E8F0"}`,
                    borderRadius: "8px",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    boxShadow: upperWinner ? "0 2px 8px rgba(251,146,60,0.2)" : "none",
                    gap: 0.4,
                  }}>
                    <EmojiEventsIcon sx={{ fontSize: 16, color: upperWinner ? "#F59E0B" : "#CBD5E1" }} />
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: upperWinner ? "#F59E0B" : "#94A3B8" }}>
                      상위 우승
                    </Typography>
                    {upperWinner ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                        {upperWinner.division && (
                          <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#111827", flexShrink: 0, lineHeight: 1 }}>{upperWinner.division}</Box>
                        )}
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#111827" }}>{upperWinner.name}</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 9, color: "#CBD5E1" }}>미결정</Typography>
                    )}
                  </Box>
                );
              })()}

              {/* ── 하위 우승자 박스 ── */}
              {isDoubleElim && lowerFinalPos && (() => {
                const cx = lowerFinalPos.x + CO_MATCH_W / 2;
                const bx = cx - CO_WINNER_W / 2;
                const by = lowerFinalPos.y + SS_H + 16;
                return (
                  <Box key="lower-winner" sx={{
                    position: "absolute", left: bx, top: by,
                    width: CO_WINNER_W, height: CO_WINNER_H,
                    bgcolor: lowerWinner ? "#F5F3FF" : "#F8FAFC",
                    border: `2px solid ${lowerWinner ? "#A78BFA" : "#E2E8F0"}`,
                    borderRadius: "8px",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    boxShadow: lowerWinner ? "0 2px 8px rgba(167,139,250,0.2)" : "none",
                    gap: 0.4,
                  }}>
                    <EmojiEventsIcon sx={{ fontSize: 16, color: lowerWinner ? "#7C3AED" : "#CBD5E1" }} />
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: lowerWinner ? "#7C3AED" : "#94A3B8" }}>
                      하위 우승
                    </Typography>
                    {lowerWinner ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                        {lowerWinner.division && (
                          <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#111827", flexShrink: 0, lineHeight: 1 }}>{lowerWinner.division}</Box>
                        )}
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#111827" }}>{lowerWinner.name}</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 9, color: "#CBD5E1" }}>미결정</Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
            </Box>
          </Box>
        </Box>

        {/* ── 플로팅 버튼 (우하단) ── */}
        <Box sx={{
          position: "absolute", bottom: 70, right: 14, zIndex: 10,
          bgcolor: "#fff", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", alignItems: "center", p: 0.25,
        }}>
          <IconButton size="small" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}>
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#6B7280", lineHeight: 1, my: 0.25 }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton size="small" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Tooltip title="새로고침">
          <IconButton
            onClick={handleRefresh}
            sx={{
              position: "absolute", bottom: 14, right: 14, zIndex: 10,
              bgcolor: "#fff", color: "#6B7280",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              width: 45, height: 45,
              "&:hover": { bgcolor: "#F3F4F6" },
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── 참가자 등록 팝업 (우측 패널) ── */}
      {registerTarget && (
        <Box sx={{
          position: "fixed", right: 0, top: 0, bottom: 0,
          width: 260, zIndex: 10001,
          bgcolor: "#fff",
          boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
        }}>
          {/* 팝업 헤더 */}
          <Box sx={{ px: 2, pt: 2, pb: 1, borderBottom: "1px solid #F1F5F9" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900 }}>참가자 등록</Typography>
              <IconButton size="small" onClick={() => setRegisterTarget(null)}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
              참가자 ({assignedMap.size} / {participants.length}명)
            </Typography>
          </Box>

          {/* 검색 */}
          <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid #F1F5F9" }}>
            <TextField
              size="small"
              fullWidth
              placeholder="이름 또는 부수 검색"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiInputBase-input": { fontSize: 12 } }}
            />
          </Box>

          {/* 참가자 목록 */}
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {filteredParticipants.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography sx={{ fontSize: 12, color: "text.disabled" }}>검색 결과가 없습니다.</Typography>
              </Box>
            ) : (
              filteredParticipants.map((p) => {
                const posLabel = assignedMap.get(p.id);
                const isAssigned = !!posLabel;
                return (
                  <Box
                    key={p.id}
                    sx={{
                      display: "flex", alignItems: "center", px: 2, py: 1,
                      borderBottom: "1px solid #F9FAFB",
                      "&:hover": { bgcolor: "#F9FAFB" },
                    }}
                  >
                    {p.division && (
                      <Box sx={{
                        fontSize: 9, fontWeight: 700, color: "#fff", bgcolor: "#FAAA47",
                        borderRadius: "3px", px: 0.5, lineHeight: "16px", flexShrink: 0, mr: 0.75,
                      }}>
                        {p.division}
                      </Box>
                    )}
                    <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </Typography>
                    <Button
                      size="small"
                      variant={isAssigned ? "outlined" : "contained"}
                      disableElevation
                      onClick={() => handleAssign(p.id)}
                      disabled={isAssigning}
                      sx={{
                        minWidth: 44, height: 24, fontSize: 11, fontWeight: 700,
                        borderRadius: "12px", px: 1, flexShrink: 0,
                        ...(isAssigned
                          ? { borderColor: "#9CA3AF", color: "#6B7280", bgcolor: "#F3F4F6" }
                          : { bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }),
                      }}
                    >
                      {isAssigned ? posLabel : "등록"}
                    </Button>
                  </Box>
                );
              })
            )}
          </Box>

          {/* 닫기 버튼 */}
          <Box sx={{ p: 1.5, borderTop: "1px solid #F1F5F9" }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setRegisterTarget(null)}
              sx={{ borderRadius: 1, fontSize: 13, fontWeight: 700, color: "text.secondary", borderColor: "#E5E7EB" }}
            >
              닫기
            </Button>
          </Box>
        </Box>
      )}
    </Box>,
    document.body,
  );
}
