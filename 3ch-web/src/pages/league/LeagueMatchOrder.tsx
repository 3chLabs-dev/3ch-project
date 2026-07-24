import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, Tab, Tabs, TextField, Typography, Tooltip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AccountTreeIcon from "@mui/icons-material/AccountTree";
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
  useExtendLeagueMatchesMutation,
  useGetLeagueParticipantsQuery,
  useGetLeagueProgramQuery,
  useSyncLeagueProgramMatchesMutation,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";
import { useOutletContext } from "react-router-dom";
import { usePushNotification } from "../../hooks/usePushNotification";
import {
  applyProgramMatchState,
  applyProgramTournamentAdvancement,
  generateProgramRoundMatches,
  getStoredProgramOption,
  saveProgramMatchPatch,
  type ProgramMatchPatch,
} from "../../utils/programMatchGenerator";

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

interface RoundTab { key: string; label: string; roundNumber: number; bracket: "upper" | "lower" }

function seededBracket(n: number): number[] {
  let arr = [1, 2];
  while (arr.length < n) {
    const size = arr.length * 2 + 1;
    arr = arr.flatMap((x) => [x, size - x]);
  }
  return arr;
}

const AUTO_COMPLETE_DELAY_MS = 4000;

function participantNameIncludes(name: string | null | undefined, targetName: string | null | undefined) {
  if (!name || !targetName) return false;
  return name.split(" · ").some((part) => part.trim() === targetName.trim());
}

function getWinScore(rules?: string | null): number | null {
  if (!rules) return null;
  if (rules.includes("3세트제")) return null;
  if (rules.includes("3전 2선승") || rules.includes("BEST_OF_3")) return 2;
  if (rules.includes("5전 3선승") || rules.includes("BEST_OF_5")) return 3;
  if (rules.includes("7전 4선승") || rules.includes("BEST_OF_7")) return 4;
  return null;
}

// ─── 참가자 행 (번호 + 이름/부 + 점수) ──────────────────────────────────────
/** 테두리 박스 안 참가자 행: [번호셀] | [배지+이름] [점수] */
function ParticipantRow({
  name, division, seedLabel, orderLabel, isMe, score, wins, canEditScore, onMinus, onPlus,
}: {
  name: string | null; division: string | null; seedLabel?: string; orderLabel?: string; isMe?: boolean;
  score: number; wins: boolean; canEditScore: boolean;
  onMinus: () => void; onPlus: () => void;
}) {
  const leftLabel = seedLabel ?? orderLabel ?? division ?? "";
  return (
    <Stack direction="row" alignItems="stretch" sx={{ minHeight: 54 }}>
      {/* 왼쪽 번호 셀 */}
      <Box sx={{ width: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1.5px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: seedLabel ? 12 : 22, fontWeight: 900, color: seedLabel ? "#94A3B8" : "#C4C9D4" }}>
          {leftLabel}
        </Typography>
      </Box>

      {/* 배지 + 이름 */}
      <Stack direction="row" alignItems="center" spacing={0.5} flex={1} px={1.5} minWidth={0}>
        {division && (
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", color: name?.startsWith("팀 ") || name?.includes(" · ") ? "#FF0000" : "#000", fontSize: 9, fontWeight: 900, flexShrink: 0, px: 0.3 }}>
            {division}
          </Box>
        )}
        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, whiteSpace: "normal", color: wins ? "#16A34A" : isMe ? "#2F80ED" : "#111827" }}>
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
  match, index, canManage, canMember, leagueId, rules, myName, seedA, seedB, orderA, orderB, onMatchStarted, onProgramMatchUpdate,
}: {
  match: LeagueMatch;
  index: number;
  canManage: boolean;
  canMember: boolean;
  leagueId: string;
  rules?: string | null;
  myName?: string;
  seedA?: string;
  seedB?: string;
  orderA?: string;
  orderB?: string;
  onMatchStarted?: (matchId: string) => void;
  onProgramMatchUpdate?: (matchId: string, updates: ProgramMatchPatch) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id, disabled: !canManage });
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [deleteMatch] = useDeleteLeagueMatchMutation();
  const [notifyMatch] = useNotifyLeagueMatchMutation();
  const courtRef = useRef<HTMLInputElement>(null);
  const autoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMatchRef = useRef(match);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    latestMatchRef.current = match;
  }, [match]);

  const getWinnerPatch = useCallback((nextMatch: LeagueMatch): ProgramMatchPatch | null => {
    if (nextMatch.status !== "done") return null;
    const scoreA = nextMatch.score_a;
    const scoreB = nextMatch.score_b;
    const hasScoreA = typeof scoreA === "number";
    const hasScoreB = typeof scoreB === "number";
    const winnerSlot = hasScoreA && hasScoreB && scoreA !== scoreB
      ? scoreA > scoreB ? "a" : "b"
      : nextMatch.participant_a_id && !nextMatch.participant_b_id ? "a"
      : nextMatch.participant_b_id && !nextMatch.participant_a_id ? "b"
      : null;

    if (!winnerSlot) return null;
    return winnerSlot === "a"
      ? {
          participant_a_id: nextMatch.participant_a_id,
          participant_a_name: nextMatch.participant_a_name,
          participant_a_division: nextMatch.participant_a_division,
        }
      : {
          participant_a_id: nextMatch.participant_b_id,
          participant_a_name: nextMatch.participant_b_name,
          participant_a_division: nextMatch.participant_b_division,
        };
  }, []);

  const updateCurrentMatch = useCallback((updates: ProgramMatchPatch) => {
    const nextMatch = { ...latestMatchRef.current, ...updates };
    latestMatchRef.current = nextMatch;
    if (onProgramMatchUpdate) {
      onProgramMatchUpdate(match.id, updates);
      if (nextMatch.next_match_id && nextMatch.next_slot) {
        const winnerPatch = getWinnerPatch(nextMatch);
        if (winnerPatch) {
          onProgramMatchUpdate(
            nextMatch.next_match_id,
            nextMatch.next_slot === "a"
              ? winnerPatch
              : {
                  participant_b_id: winnerPatch.participant_a_id,
                  participant_b_name: winnerPatch.participant_a_name,
                  participant_b_division: winnerPatch.participant_a_division,
                },
          );
        }
      }
      return;
    }
    updateMatch({ leagueId, matchId: match.id, updates });
  }, [getWinnerPatch, leagueId, match.id, onProgramMatchUpdate, updateMatch]);

  const scheduleAutoComplete = useCallback(() => {
    if (match.status !== "playing" && match.status !== "done") return;
    if (autoCompleteTimerRef.current) {
      clearTimeout(autoCompleteTimerRef.current);
    }
    autoCompleteTimerRef.current = setTimeout(() => {
      updateCurrentMatch({ status: "done" });
      autoCompleteTimerRef.current = null;
    }, AUTO_COMPLETE_DELAY_MS);
  }, [match.status, updateCurrentMatch]);

  useEffect(() => () => {
    if (autoCompleteTimerRef.current) {
      clearTimeout(autoCompleteTimerRef.current);
    }
  }, []);

  const matchLabel = useCallback(() => {
    const aDiv = match.participant_a_division ? `(${match.participant_a_division})` : "";
    const bDiv = match.participant_b_division ? `(${match.participant_b_division})` : "";
    return `${index + 1}경기\n${aDiv}${match.participant_a_name ?? "?"} VS ${bDiv}${match.participant_b_name ?? "?"}`;
  }, [match, index]);

  const handleScore = useCallback((side: "a" | "b", delta: number) => {
    const current = side === "a" ? (match.score_a ?? 0) : (match.score_b ?? 0);
    const next = Math.max(0, current + delta);
    updateCurrentMatch(side === "a" ? { score_a: next } : { score_b: next });
    scheduleAutoComplete();
  }, [match, scheduleAutoComplete, updateCurrentMatch]);

  const handleCourtBlur = useCallback(() => {
    const val = courtRef.current?.value ?? "";
    if (val !== (match.court ?? "")) {
      updateCurrentMatch({ court: val || null });
    }
  }, [match, updateCurrentMatch]);

  const handleStatus = useCallback(() => {
    const sa = match.score_a ?? 0;
    const sb = match.score_b ?? 0;
    if (match.status === "pending") {
      if (!window.confirm(`${matchLabel()}\n시작하겠습니까?`)) return;
      onMatchStarted?.(match.id);
    } else if (match.status === "playing") {
      if (!window.confirm(`${matchLabel()}\n종료되었습니까?`)) return;
    }
    updateCurrentMatch({ status: NEXT_STATUS[match.status], score_a: sa, score_b: sb });
  }, [match, matchLabel, onMatchStarted, updateCurrentMatch]);

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
    const matchOrderUrl = `${window.location.origin}/league/${leagueId}/matches`;
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    const kakao = (window as unknown as { Kakao?: { init?: (key: string) => void; isInitialized?: () => boolean; Share?: { sendDefault: (o: unknown) => void } } }).Kakao;
    if (kakao && kakaoKey && !kakao.isInitialized?.()) {
      kakao.init?.(kakaoKey);
    }
    if (kakao?.isInitialized?.() && kakao.Share) {
      kakao.Share.sendDefault({
        objectType: "text",
        text,
        link: { mobileWebUrl: matchOrderUrl, webUrl: matchOrderUrl },
      });
    } else {
      navigator.clipboard?.writeText(text).then(() => alert("메시지가 복사되었습니다.\n카카오톡에 붙여넣기 해주세요."));
    }
  }, [matchLabel, leagueId]);

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
                    <Box sx={{ width: 20, height: 20, bgcolor: "#FEE500", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <Box component="img" src="/kakao-logo.png" alt="카카오톡" sx={{ width: 14, height: 14, objectFit: "contain" }} />
                    </Box>
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
            seedLabel={seedA}
            orderLabel={orderA}
            isMe={participantNameIncludes(match.participant_a_name, myName)}
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
            seedLabel={seedB}
            orderLabel={orderB}
            isMe={participantNameIncludes(match.participant_b_name, myName)}
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
  const [searchParams] = useSearchParams();
  const isProgramMode = searchParams.get("program") === "1";
  const programRound = Number.parseInt(searchParams.get("round") ?? "1", 10) || 1;
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotification();
  const { scrollToTop } = useOutletContext<{ scrollToTop: () => void }>();

  const { data: leagueData } = useGetLeagueQuery(leagueId, { skip: !leagueId });
  const league = leagueData?.league;
  const isGroupLeague = league?.format?.startsWith("조별리그") ?? false;
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
  const { data: participantData } = useGetLeagueParticipantsQuery(leagueId, { skip: !leagueId, refetchOnMountOrArgChange: true, });
  const { data: programData } = useGetLeagueProgramQuery(leagueId, { skip: !isProgramMode || !leagueId });
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [finishRoundConfirmOpen, setFinishRoundConfirmOpen] = useState(false);
  const [startedMatchIds, setStartedMatchIds] = useState<string[]>([]);
  // 순서만 로컬에 보관. 경기 데이터는 항상 RTK Query 캐시에서 가져와야 optimistic update가 즉시 반영됨
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [programMatchStateVersion, setProgramMatchStateVersion] = useState(0);
  const [selectedBracketIndex, setSelectedBracketIndex] = useState(1);

  const rawParticipants = useMemo(() => participantData?.participants ?? [], [participantData]);
  const programOption = useMemo(
    () => (isProgramMode && leagueId ? (programData?.program?.program_data as ReturnType<typeof getStoredProgramOption> | undefined) ?? getStoredProgramOption(leagueId) : null),
    [isProgramMode, leagueId, programData],
  );
  const currentProgramBlock = isProgramMode ? programOption?.blocks?.[programRound - 1] : undefined;
  const bracketPath = currentProgramBlock?.format === "TOURNAMENT" ? "tournament-bracket" : "bracket";
  const isTournamentProgramRound = isProgramMode && currentProgramBlock?.format === "TOURNAMENT";
  const isProgramFinalRound =
    isProgramMode &&
    (
      programOption?.rounds?.[programRound - 1]?.option === "FINAL" ||
      currentProgramBlock?.title.includes("본선") === true
    );
  const programSourceMatches = useMemo(() => {
    if (!isProgramMode || !leagueId || !programOption) return matchData?.matches ?? [];

    const sourceMatches = [...(matchData?.matches ?? [])];
    for (let round = 1; round < programRound; round += 1) {
      const generatedRoundMatches = applyProgramMatchState(
        generateProgramRoundMatches(leagueId, programOption, rawParticipants, round, sourceMatches),
        leagueId,
        round,
      );
      generatedRoundMatches.forEach((match) => {
        const existingIndex = sourceMatches.findIndex((sourceMatch) => sourceMatch.id === match.id);
        if (existingIndex < 0) {
          sourceMatches.push(match);
          return;
        }
        const serverMatch = sourceMatches[existingIndex];
        sourceMatches[existingIndex] = {
          ...match,
          ...serverMatch,
          participant_a_id: serverMatch.participant_a_id ?? match.participant_a_id,
          participant_a_name: serverMatch.participant_a_name ?? match.participant_a_name,
          participant_a_division: serverMatch.participant_a_division ?? match.participant_a_division,
          participant_b_id: serverMatch.participant_b_id ?? match.participant_b_id,
          participant_b_name: serverMatch.participant_b_name ?? match.participant_b_name,
          participant_b_division: serverMatch.participant_b_division ?? match.participant_b_division,
        };
      });
    }
    return sourceMatches;
  }, [isProgramMode, leagueId, matchData?.matches, programOption, programRound, rawParticipants]);
  const generatedProgramMatches = useMemo(
    () => isProgramMode
      ? applyProgramTournamentAdvancement(
          applyProgramMatchState(
            generateProgramRoundMatches(leagueId, programOption, rawParticipants, programRound, programSourceMatches),
            leagueId,
            programRound,
          ),
        )
      : [],
    [isProgramMode, leagueId, programOption, rawParticipants, programRound, programMatchStateVersion, programSourceMatches],
  );
  const serverProgramMatches = useMemo(
    () => (matchData?.matches ?? []).filter((match) => match.is_program && match.program_round === programRound),
    [matchData?.matches, programRound],
  );
  const programMatches = useMemo(() => {
    const serverById = new Map(serverProgramMatches.map((match) => [match.id, match]));
    const hydratedMatches = generatedProgramMatches.map((match) => {
      const serverMatch = serverById.get(match.id);
      if (!serverMatch) return match;
      return {
        ...match,
        match_order: serverMatch.match_order,
        score_a: match.score_a ?? serverMatch.score_a,
        score_b: match.score_b ?? serverMatch.score_b,
        court: match.court ?? serverMatch.court,
        status: match.status !== "pending" ? match.status : serverMatch.status,
      };
    });
    return applyProgramTournamentAdvancement(hydratedMatches)
      .sort((left, right) => left.match_order - right.match_order);
  }, [generatedProgramMatches, serverProgramMatches]);
  const tournamentBracketIndexes = useMemo(
    () => [...new Set(programMatches.map((match) => match.tournament_bracket_index ?? 1))].sort((a, b) => a - b),
    [programMatches],
  );
  const activeProgramMatches = useMemo(
    () => isTournamentProgramRound
      ? programMatches.filter((match) => (match.tournament_bracket_index ?? 1) === selectedBracketIndex)
      : programMatches,
    [isTournamentProgramRound, programMatches, selectedBracketIndex],
  );

  const updateProgramMatch = useCallback((matchId: string, updates: ProgramMatchPatch) => {
    if (!leagueId) return;
    if (serverProgramMatches.some((match) => match.id === matchId)) {
      updateMatch({ leagueId, matchId, updates });
      return;
    }
    saveProgramMatchPatch(leagueId, programRound, matchId, updates);
    setProgramMatchStateVersion((version) => version + 1);
  }, [leagueId, programRound, serverProgramMatches, updateMatch]);

  // 1. 조 이름 목록 추출 ("1조", "2조" ...)
  const groupNames = useMemo(() => {
    if (isProgramMode) {
      if (currentProgramBlock?.format !== "GROUP") return [];
      const names = new Set(
        programMatches
          .map((match) => match.match_label)
          .filter(Boolean) as string[]
      );
      return Array.from(names).sort((a, b) => parseInt(a) - parseInt(b));
    }

    if (!isGroupLeague) return [];

    const names = new Set(rawParticipants.map(p => p.group_name).filter(Boolean) as string[]);
    return Array.from(names).sort((a, b) => parseInt(a) - parseInt(b));
  }, [currentProgramBlock?.format, isGroupLeague, isProgramMode, programMatches, rawParticipants]);

  // 2. 현재 선택된 조 상태 관리
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [tournamentTabKey, setTournamentTabKey] = useState<string | null>(null);

  // 조 목록이 생기면 첫 번째 조를 기본으로 선택
  useEffect(() => {
    if (groupNames.length > 0 && (!selectedGroup || !groupNames.includes(selectedGroup))) {
      setTimeout(() => setSelectedGroup(groupNames[0]), 0);
    }
  }, [groupNames, selectedGroup]);

  useEffect(() => {
    setTimeout(() => setLocalOrder(null), 0);
  }, [selectedGroup]);

  // 참가자 ID -> 조 이름 매핑 (빠른 검색용)
  const participantGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    rawParticipants.forEach(p => {
      if (p.group_name) map.set(p.id, p.group_name);
    });
    return map;
  }, [rawParticipants]);

  const matches = useMemo(() => {
    if (isProgramMode) {
      let ordered = localOrder
        ? localOrder.map((id) => activeProgramMatches.find((m) => m.id === id)).filter((m): m is LeagueMatch => !!m)
        : activeProgramMatches;

      if (groupNames.length > 0 && selectedGroup) {
        ordered = ordered.filter((m) => m.match_label === selectedGroup);
      }

      const sorted = [...ordered].sort((a, b) => {
        const aStartedIndex = startedMatchIds.indexOf(a.id);
        const bStartedIndex = startedMatchIds.indexOf(b.id);
        if (aStartedIndex !== -1 || bStartedIndex !== -1) {
          if (aStartedIndex === -1) return 1;
          if (bStartedIndex === -1) return -1;
          return aStartedIndex - bStartedIndex;
        }
        if (a.status === "playing" && b.status !== "playing") return -1;
        if (a.status !== "playing" && b.status === "playing") return 1;
        return 0;
      });

      return sorted;
    }

    // bracket이 있는 경기(토너먼트 경기)는 리그 경기 순서 뷰에서 제외
    let serverMatches = (matchData?.matches ?? []).filter((m) => !m.bracket);

    // 조별리그인 경우 선택된 조의 경기만 남기기
    if (groupNames.length > 0 && selectedGroup) {
      serverMatches = serverMatches.filter(m => {
        const groupA = m.participant_a_id ? participantGroupMap.get(m.participant_a_id) : null;
        const groupB = m.participant_b_id ? participantGroupMap.get(m.participant_b_id) : null;
        // 둘 중 한 명이라도 현재 선택된 조에 속해있다면 화면에 표시
        return groupA === selectedGroup || groupB === selectedGroup;
      });
    }

    const ordered = localOrder
      ? localOrder.map((id) => serverMatches.find((m) => m.id === id)).filter((m): m is LeagueMatch => !!m)
      : serverMatches;

    const sorted = [...ordered].sort((a, b) => {
      const aStartedIndex = startedMatchIds.indexOf(a.id);
      const bStartedIndex = startedMatchIds.indexOf(b.id);
      if (aStartedIndex !== -1 || bStartedIndex !== -1) {
        if (aStartedIndex === -1) return 1;
        if (bStartedIndex === -1) return -1;
        return aStartedIndex - bStartedIndex;
      }
      if (a.status === "playing" && b.status !== "playing") return -1;
      if (a.status !== "playing" && b.status === "playing") return 1;
      return 0;
    });

    return sorted;
  }, [activeProgramMatches, isProgramMode, localOrder, matchData?.matches, groupNames.length, selectedGroup, participantGroupMap, startedMatchIds]);

  const participantNumberMap = useMemo(() => {
    const map = new Map<string, string>();
    if (isTournamentProgramRound) return map;

    let sourceMatches = isProgramMode
      ? activeProgramMatches
      : (matchData?.matches ?? []).filter((match) => !match.bracket);
    if (groupNames.length > 0 && selectedGroup) {
      sourceMatches = isProgramMode
        ? sourceMatches.filter((match) => match.match_label === selectedGroup)
        : sourceMatches.filter((match) => {
            const groupA = match.participant_a_id ? participantGroupMap.get(match.participant_a_id) : null;
            const groupB = match.participant_b_id ? participantGroupMap.get(match.participant_b_id) : null;
            return groupA === selectedGroup || groupB === selectedGroup;
          });
    }

    if (isProgramMode) {
      sourceMatches.forEach((match) => {
        if (match.participant_a_id && match.participant_a_seed_label) {
          map.set(match.participant_a_id, match.participant_a_seed_label);
        }
        if (match.participant_b_id && match.participant_b_seed_label) {
          map.set(match.participant_b_id, match.participant_b_seed_label);
        }
      });
      if (map.size > 0) return map;
    }

    const participantIds = new Set(
      sourceMatches.flatMap((match) => [match.participant_a_id, match.participant_b_id]).filter(Boolean) as string[],
    );
    const orderedIds = rawParticipants
      .filter((participant) => participantIds.has(participant.id))
      .map((participant) => participant.id);

    sourceMatches.forEach((match) => {
      [match.participant_a_id, match.participant_b_id].forEach((participantId) => {
        if (participantId && participantIds.has(participantId) && !orderedIds.includes(participantId)) {
          orderedIds.push(participantId);
        }
      });
    });
    orderedIds.forEach((participantId, index) => map.set(participantId, String(index + 1)));
    return map;
  }, [
    activeProgramMatches,
    groupNames.length,
    isProgramMode,
    isTournamentProgramRound,
    matchData?.matches,
    participantGroupMap,
    rawParticipants,
    selectedGroup,
  ]);

  const tournamentTabs = useMemo<RoundTab[]>(() => {
    if (!isTournamentProgramRound) return [];
    return (["upper", "lower"] as const).flatMap((bracket) => {
      const rounds = [...new Set(activeProgramMatches
        .filter((match) => match.bracket === bracket)
        .map((match) => match.round_number ?? 0)
        .filter((round) => round > 0))]
        .sort((a, b) => a - b);

      return rounds.map((roundNumber) => {
        const sample = activeProgramMatches.find((match) => match.bracket === bracket && match.round_number === roundNumber);
        return {
          key: `${bracket}-${roundNumber}`,
          label: sample?.match_label ?? `${bracket === "upper" ? "상위" : "하위"} R${roundNumber}`,
          roundNumber,
          bracket,
        };
      });
    });
  }, [activeProgramMatches, isTournamentProgramRound]);

  const activeTournamentTab = tournamentTabKey ?? tournamentTabs[0]?.key ?? "";
  const visibleMatches = useMemo(() => {
    if (!isTournamentProgramRound) return matches;
    const currentTab = tournamentTabs.find((tab) => tab.key === activeTournamentTab);
    if (!currentTab) return [];
    return matches.filter((match) => match.bracket === currentTab.bracket && match.round_number === currentTab.roundNumber);
  }, [activeTournamentTab, isTournamentProgramRound, matches, tournamentTabs]);
  const displayedMatches = useMemo(() => {
    let filtered = visibleMatches.filter((match) => !match.is_no_game);
    if (mineOnly && myName) {
      filtered = filtered.filter(
        (match) => participantNameIncludes(match.participant_a_name, myName)
          || participantNameIncludes(match.participant_b_name, myName)
      );
    }
    if (!search.trim()) return filtered;

    const q = search.trim().toLowerCase();
    return filtered.filter((match) =>
      [match.participant_a_name, match.participant_b_name, match.participant_a_division, match.participant_b_division]
        .some((value) => value?.toLowerCase().includes(q))
    );
  }, [mineOnly, myName, search, visibleMatches]);
  const hasNextProgramRound = isProgramMode && programRound < (programOption?.blocks?.length ?? 0);
  const handleFinishProgramRound = useCallback(() => {
    if (!isProgramMode || !leagueId || !hasNextProgramRound) return;
    const nextRound = programRound + 1;
    localStorage.setItem(`league-program-active-round-${leagueId}`, String(nextRound));
    setFinishRoundConfirmOpen(false);
    navigate(`/league/${leagueId}/program/matches?program=1&round=${nextRound}`);
  }, [hasNextProgramRound, isProgramMode, leagueId, navigate, programRound]);

  const tournamentSeedMap = useMemo(() => {
    if (!isTournamentProgramRound) return new Map<string, { a: string; b: string }>();
    const firstRoundMatches = activeProgramMatches
      .filter((match) => match.bracket === "upper" && match.round_number === 1)
      .sort((a, b) => a.match_order - b.match_order);
    const bracketSize = firstRoundMatches.length * 2;
    if (bracketSize < 2) return new Map<string, { a: string; b: string }>();

    const seeds = seededBracket(bracketSize);
    const map = new Map<string, { a: string; b: string }>();
    firstRoundMatches.forEach((match, index) => {
      map.set(match.id, {
        a: match.participant_a_seed_label ?? `1-${seeds[index * 2]}`,
        b: match.participant_b_seed_label ?? `1-${seeds[index * 2 + 1]}`,
      });
    });
    return map;
  }, [activeProgramMatches, isTournamentProgramRound]);

  const [initMatches, { isLoading: isIniting }] = useInitLeagueMatchesMutation();
  const [extendMatches, {isLoading: isExtending }] = useExtendLeagueMatchesMutation();
  const [reorderMatches] = useReorderLeagueMatchesMutation();
  const [syncLeagueProgramMatches] = useSyncLeagueProgramMatchesMutation();
  const initCalledRef = useRef(false);
  const programSyncCalledRef = useRef<string | null>(null);

  // 현재 경기 수 계산
  const expectedMatchCount = useMemo(() => {
    if (rawParticipants.length < 2) return 0;

    const isGroupMode = rawParticipants.some(p => p.group_name);

    if (isGroupMode) {
      // 조별리그: 각 조별 인원을 파악해서 매치 수를 각각 계산 후 합산
      const groupCounts: Record<string, number> = {};
      rawParticipants.forEach(p => {
        if (p.group_name) {
          groupCounts[p.group_name] = (groupCounts[p.group_name] || 0) + 1;
        }
      });

      let total = 0;
      for (const gName in groupCounts) {
        const count = groupCounts[gName];
        if (count >= 2) {
          total += (count * (count - 1)) / 2; // 각 조 안에서의 경기 수 누적
        }
      }
      return total;
    } else {
      // 💡 단일리그(개인전): 전체 인원으로 매치 수 계산
      const count = rawParticipants.length;
      return (count * (count - 1)) / 2;
    }
  }, [rawParticipants]);

  // 경기 없고 canManage 확정되면 자동 생성 (한 번만) — invalidatesTags로 자동 refetch됨
  useEffect(() => {
    if (isProgramMode) return;
    if (!matchData || matchData.matches.length > 0) return;
    if (!canManage) return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initMatches({ id: leagueId });
  }, [isProgramMode, matchData, canManage, leagueId, initMatches]);

  useEffect(() => {
    if (isProgramMode) return;
    if (!matchData) return;
    if ( matchData.matches.length < 1 ) return;
    if (!canManage) return;
    if ( expectedMatchCount === matchData?.matches.length ) return;
    extendMatches({ id: leagueId });
  },[isProgramMode, matchData, canManage, expectedMatchCount, leagueId, extendMatches]);

  const handleRefresh = useCallback(() => {
    setLocalOrder(null);
    if (isProgramMode) return;
    refetchMatches();
  }, [isProgramMode, refetchMatches]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = matches.findIndex((m) => m.id === active.id);
    const newIdx = matches.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(matches, oldIdx, newIdx);
    const previousOrder = matches.map((match) => match.id);
    const nextOrder = reordered.map((match) => match.id);
    setLocalOrder(nextOrder);
    try {
      await reorderMatches({ leagueId, order: nextOrder }).unwrap();
    } catch {
      setLocalOrder(previousOrder);
      window.alert("경기 순서를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }, [matches, leagueId, reorderMatches]);

  useEffect(() => {
    if (!isProgramMode || !programOption) return;
    const currentBlock = programOption.blocks?.[programRound - 1];
    if (!currentBlock) return;
    const matchesToSync = isProgramFinalRound ? programMatches : generatedProgramMatches;
    if (matchesToSync.length === 0) return;
    if (
      currentBlock.type === "SINGLES" &&
      !matchesToSync.some((match) => match.participant_a_id && match.participant_b_id)
    ) return;

    const syncKey = `${leagueId}-${programRound}-${matchesToSync.map((match) => `${match.id}:${match.participant_a_id ?? ""}:${match.participant_b_id ?? ""}`).join("|")}`;
    const serverKey = `${leagueId}-${programRound}-${serverProgramMatches.map((match) => `${match.id}:${match.participant_a_id ?? ""}:${match.participant_b_id ?? ""}`).join("|")}`;
    if (serverProgramMatches.length > 0 && serverKey === syncKey) return;
    if (programSyncCalledRef.current === syncKey) return;
    programSyncCalledRef.current = syncKey;

    syncLeagueProgramMatches({
      leagueId,
      matches: matchesToSync.map((match) => ({
        ...match,
        program_round: programRound,
        program_block_type: currentBlock.type,
      })),
    });
  }, [generatedProgramMatches, isProgramFinalRound, isProgramMode, leagueId, programMatches, programOption, programRound, serverProgramMatches, syncLeagueProgramMatches]);


  if (!isProgramMode && matchLoading) {
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
          variant={isTournamentProgramRound ? "text" : "outlined"}
          startIcon={isTournamentProgramRound ? <AccountTreeIcon sx={{ fontSize: 14 }} /> : undefined}
          onClick={() =>
            navigate(
              isProgramMode
                ? `/league/${leagueId}/program/${bracketPath}?program=1&round=${programRound}&format=${currentProgramBlock?.format ?? ""}`
                : league?.format === "GPT 인식"
                  ? `/league/${leagueId}/gpt-vision`
                  : `/league/${leagueId}/bracket`
            )
          }
          sx={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "none",
            color: "#2563EB",
            flexShrink: 0,
            ...(isTournamentProgramRound
              ? { minWidth: "auto", px: 1 }
              : {
                  borderColor: "#93C5FD",
                  borderRadius: "16px",
                  px: 1.5,
                  py: 0.35,
                  "&:hover": { borderColor: "#2563EB", bgcolor: "#EFF6FF" },
                }),
          }}
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

      {/* 조 선택 탭 (조별리그일 때만 표시됨) */}
      {isTournamentProgramRound && tournamentBracketIndexes.length > 1 && (
        <Box sx={{ bgcolor: "#F8FAFC", borderBottom: "1px solid #E5E7EB", mx: -2 }}>
          <Tabs
            value={selectedBracketIndex}
            onChange={(_, value) => { setSelectedBracketIndex(value); setTournamentTabKey(null); }}
            variant="fullWidth"
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 800, py: 0 } }}
          >
            {tournamentBracketIndexes.map((index) => <Tab key={index} value={index} label={`본선 ${String.fromCharCode(64 + index)}`} />)}
          </Tabs>
        </Box>
      )}
      {isTournamentProgramRound && tournamentTabs.length > 0 && (
        <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #E5E7EB", mx: -2 }}>
          <Tabs
            value={activeTournamentTab}
            onChange={(_, value) => setTournamentTabKey(value)}
            variant="scrollable"
            scrollButtons
            allowScrollButtonsMobile
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 700, px: 1.5, py: 0 }, "& .MuiTabScrollButton-root": { width: 28 } }}
          >
            {tournamentTabs.map((tab) => <Tab key={tab.key} value={tab.key} label={tab.label} />)}
          </Tabs>
        </Box>
      )}

      {!isTournamentProgramRound && groupNames.length > 0 && (
        <Box sx={{ px: 0, pt: 1, pb: 0.5 }}>
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", '&::-webkit-scrollbar': { display: 'none' } }}>
            {groupNames.map(gName => (
              <Button
                key={gName}
                variant={selectedGroup === gName ? "contained" : "outlined"}
                onClick={() => setSelectedGroup(gName)}
                size="small"
                sx={{
                  minWidth: 60, borderRadius: 1.5, fontWeight: 800, fontSize: 13, boxShadow: "none",
                  ...(selectedGroup === gName ? { bgcolor: "#2563EB" } : { color: "#6B7280", borderColor: "#D1D5DB", bgcolor: "#fff" })
                }}
              >
                {gName}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

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
              <InputAdornment position="end" sx={{ gap: 0.75 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setMineOnly((value) => !value)}
                  disabled={!myName}
                  sx={{
                    minWidth: 70,
                    height: 28,
                    borderRadius: 1,
                    px: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: mineOnly ? "#9CA3AF" : "#1976d2",
                    borderColor: mineOnly ? "#0000001f" : "#1976d2",
                    bgcolor: "#fff",
                    whiteSpace: "nowrap",
                    "&:hover": {
                      borderColor: mineOnly ? "#0000003d" : "#1976d2",
                      bgcolor: mineOnly ? "#F9FAFB" : "#EFF6FF",
                    },
                  }}
                >
                  {mineOnly ? "전체 경기" : "내 경기"}
                </Button>
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
      {displayedMatches.length === 0 ? (
        <Box display="flex" justifyContent="center" pt={4}>
          {!isProgramMode && isIniting ? (
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
        {isExtending ? (
          <CircularProgress />
        ) : (
          <SortableContext items={displayedMatches.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1}>
              {displayedMatches.map((match, displayIndex) => {
                const originalIndex = isProgramMode
                  ? programMatches.findIndex((m) => m.id === match.id)
                  : (matchData?.matches ?? [])
                  .filter((m) => !m.bracket)
                  .findIndex((m) => m.id === match.id);
                const seed = tournamentSeedMap.get(match.id);

                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    index={originalIndex >= 0 ? originalIndex : displayIndex}
                    canManage={canManage}
                    canMember={canMember}
                    leagueId={leagueId}
                    rules={isProgramMode ? currentProgramBlock?.matchRule : league?.rules}
                    myName={myName ?? undefined}
                    seedA={isTournamentProgramRound ? seed?.a : undefined}
                    seedB={isTournamentProgramRound ? seed?.b : undefined}
                    orderA={!isTournamentProgramRound && match.participant_a_id
                      ? participantNumberMap.get(match.participant_a_id)
                      : undefined}
                    orderB={!isTournamentProgramRound && match.participant_b_id
                      ? participantNumberMap.get(match.participant_b_id)
                      : undefined}
                    onMatchStarted={(matchId) => setStartedMatchIds((ids) => [matchId, ...ids.filter((id) => id !== matchId)])}
                    onProgramMatchUpdate={isProgramMode ? updateProgramMatch : undefined}
                  />
                );
              })}
            </Stack>
          </SortableContext>
      )}
        </DndContext>
      )}

      {hasNextProgramRound && (
        <Box
          sx={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "calc(72px + env(safe-area-inset-bottom))",
            zIndex: 1200,
            width: "min(calc(100% - 32px), 393px)",
          }}
        >
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={() => setFinishRoundConfirmOpen(true)}
            sx={{
              height: 44,
              borderRadius: 2,
              fontSize: 14,
              fontWeight: 900,
              bgcolor: "#2563EB",
              boxShadow: "0 8px 18px rgba(37,99,235,0.24)",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            {programRound}라운드 종료
          </Button>
        </Box>
      )}

      <Tooltip title="상단으로">
        <IconButton onClick={scrollToTop} sx={{ position: "absolute", bottom: "calc(202px + env(safe-area-inset-bottom))", right: 14, zIndex: 10, bgcolor: "#fff", color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: "#F3F4F6" } }}>
          <ArrowUpwardIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="새로고침">
        <IconButton onClick={handleRefresh} sx={{ position: "absolute", bottom: "calc(252px + env(safe-area-inset-bottom))", right: 14, zIndex: 10, bgcolor: "#fff", color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 45, height: 45, "&:hover": { bgcolor: "#F3F4F6" } }}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Dialog
        open={finishRoundConfirmOpen}
        onClose={() => setFinishRoundConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17, pb: 1 }}>
          {programRound}라운드 종료
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 0 }}>
          <Typography>
            다음 라운드로 넘어가시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setFinishRoundConfirmOpen(false)} sx={{ fontWeight: 700 }}>
            취소
          </Button>
          <Button variant="contained" disableElevation onClick={handleFinishProgramRound} sx={{ fontWeight: 800 }}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
