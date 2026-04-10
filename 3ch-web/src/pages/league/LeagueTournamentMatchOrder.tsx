import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, InputAdornment, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SearchIcon from "@mui/icons-material/Search";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { usePushNotification } from "../../hooks/usePushNotification";
import {
  useGetLeagueQuery,
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useUpdateLeagueMatchMutation,
  useNotifyLeagueMatchMutation,
  useAssignMatchParticipantMutation,
  type LeagueMatch,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { useAppSelector } from "../../app/hooks";

// ─── 시드 배치 ────────────────────────────────────────────────────────────────
function seededBracket(n: number): number[] {
  function buildPrimary(size: number): number[] {
    if (size === 2) return [1];
    const prev = buildPrimary(size / 2);
    const half = size / 2;
    const result: number[] = [];
    for (let i = 0; i < prev.length; i++) {
      const s = prev[i];
      const comp = half + 1 - s;
      if (i % 2 === 0) { result.push(s, comp); } else { result.push(comp, s); }
    }
    return result;
  }
  const primary = buildPrimary(n);
  const result: number[] = [];
  for (const s of primary) result.push(s, n + 1 - s);
  return result;
}

// ─── 상태 ────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { pending: "시작", playing: "진행 중", done: "종료" };
const NEXT_STATUS: Record<string, "pending" | "playing" | "done"> = {
  pending: "playing", playing: "done", done: "done",
};

interface RoundTab { key: string; label: string; bracket: string; roundNumber: number }

// ─── 슬롯 행 ─────────────────────────────────────────────────────────────────
function SlotRow({ slot, name, seed, division, score, isWin, isR1, canManage, canScore, matchId, onRegister, onScore }: {
  slot: "a" | "b";
  name?: string | null;
  seed?: number;
  division?: string | null;
  score: number;
  isWin: boolean;
  isR1: boolean;
  canManage: boolean;
  canScore: boolean;
  matchId: string;
  onRegister: (matchId: string, slot: "a" | "b") => void;
  onScore: (slot: "a" | "b", delta: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="stretch" sx={{ minHeight: 54 }}>
      {/* 왼쪽 시드 셀 */}
      <Box sx={{ width: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1.5px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
          {isR1 && seed ? `1-${seed}` : ""}
        </Typography>
      </Box>

      {/* 이름 / 등록 / 미정 */}
      <Stack direction="row" alignItems="center" spacing={0.5} flex={1} px={1.5} minWidth={0}>
        {division && (
          <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#111827", flexShrink: 0 }}>
            {division}
          </Box>
        )}
        {name ? (
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: isWin ? "#16A34A" : "#111827" }}>
            {name}
          </Typography>
        ) : isR1 && canManage ? (
          <Button size="small" onClick={() => onRegister(matchId, slot)}
            sx={{ fontSize: 12, fontWeight: 700, px: 1.5, minWidth: 48, height: 28, borderRadius: 1, border: "1.5px solid #93C5FD", color: "#2563EB", whiteSpace: "nowrap", flexShrink: 0 }}>
            등록
          </Button>
        ) : (
          <Typography sx={{ fontSize: 13, color: "#CBD5E1", fontStyle: "italic" }}>미정</Typography>
        )}
      </Stack>

      {/* -[점수]+ */}
      <Stack direction="row" alignItems="center" sx={{ flexShrink: 0, pr: 1, gap: "4px" }}>
        <Box
          onClick={canScore ? () => onScore(slot, -1) : undefined}
          sx={{ width: 30, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", cursor: canScore ? "pointer" : "default", color: "#6B7280", userSelect: "none" }}
        >
          <RemoveIcon sx={{ fontSize: 14 }} />
        </Box>
        <Box sx={{ minWidth: 36, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 18, color: isWin ? "#16A34A" : "#111827" }}>{score}</Typography>
        </Box>
        <Box
          onClick={canScore ? () => onScore(slot, 1) : undefined}
          sx={{ width: 30, height: 30, border: "1.5px solid #E5E7EB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", cursor: canScore ? "pointer" : "default", color: "#2F80ED", userSelect: "none" }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </Box>
      </Stack>
    </Stack>
  );
}

// ─── 매치 카드 ────────────────────────────────────────────────────────────────
function MatchCard({
  match, matchIndex, canManage, leagueId, seedA, seedB, isR1, onRegister,
}: {
  match: LeagueMatch;
  matchIndex: number;
  canManage: boolean;
  leagueId: string;
  seedA?: number;
  seedB?: number;
  isR1: boolean;
  onRegister: (matchId: string, slot: "a" | "b") => void;
}) {
  const [updateMatch] = useUpdateLeagueMatchMutation();
  const [notifyMatch] = useNotifyLeagueMatchMutation();
  const courtRef = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const nameA = match.participant_a_name;
  const nameB = match.participant_b_name;
  const isDone = match.status === "done";
  const isPlaying = match.status === "playing";
  const sa = match.score_a ?? 0;
  const sb = match.score_b ?? 0;
  const winA = isDone && sa > sb;
  const winB = isDone && sb > sa;
  const canScore = canManage && (isPlaying || isDone);

  const handleScore = useCallback((slot: "a" | "b", delta: number) => {
    const cur = slot === "a" ? sa : sb;
    updateMatch({ leagueId, matchId: match.id, updates: slot === "a" ? { score_a: Math.max(0, cur + delta) } : { score_b: Math.max(0, cur + delta) } });
  }, [sa, sb, leagueId, match.id, updateMatch]);

  const commonSlotProps = { isR1, canManage, canScore, matchId: match.id, onRegister, onScore: handleScore };

  const handleCourtBlur = useCallback(() => {
    const val = courtRef.current?.value ?? "";
    if (val !== (match.court ?? "")) {
      updateMatch({ leagueId, matchId: match.id, updates: { court: val || null } });
    }
  }, [match, leagueId, updateMatch]);

  const handleStatus = useCallback(() => {
    if (isDone) return;
    const nA = nameA ?? "?", nB = nameB ?? "?";
    const msg = isPlaying
      ? `${nA}(${sa}) VS (${sb})${nB}\n경기를 종료하겠습니까?`
      : `${nA} VS ${nB}\n경기를 시작하겠습니까?`;
    if (!window.confirm(msg)) return;
    updateMatch({ leagueId, matchId: match.id, updates: { status: NEXT_STATUS[match.status], score_a: sa, score_b: sb } });
  }, [match, isPlaying, isDone, nameA, nameB, leagueId, sa, sb, updateMatch]);

  const handleAppNotify = useCallback(async () => {
    setMenuAnchor(null);
    await notifyMatch({ leagueId, matchId: match.id });
  }, [leagueId, match.id, notifyMatch]);

  const handleKakaoShare = useCallback(() => {
    setMenuAnchor(null);
    const aDiv = match.participant_a_division ? `(${match.participant_a_division})` : "";
    const bDiv = match.participant_b_division ? `(${match.participant_b_division})` : "";
    const text = `${matchIndex}경기\n${aDiv}${nameA ?? "?"} VS ${bDiv}${nameB ?? "?"}\n곧 경기 시작! 지금 입장해 주세요`;
    const kakao = (window as unknown as { Kakao?: { isInitialized?: () => boolean; Share?: { sendDefault: (o: unknown) => void } } }).Kakao;
    if (kakao?.isInitialized?.() && kakao.Share) {
      kakao.Share.sendDefault({ objectType: "text", text, link: { mobileWebUrl: window.location.href, webUrl: window.location.href } });
    } else {
      navigator.clipboard?.writeText(text).then(() => alert("메시지가 복사되었습니다.\n카카오톡에 붙여넣기 해주세요."));
    }
  }, [match, matchIndex, nameA, nameB]);

  return (
    <Box sx={{
      bgcolor: isPlaying ? "#EFF6FF" : isDone ? "#F9FAFB" : "#fff",
      border: `1.5px solid ${isPlaying ? "#93C5FD" : isDone ? "#D1D5DB" : "#E2E8F0"}`,
      borderRadius: 2, mb: 1.5,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      {/* 헤더: n경기 + ⋮ */}
      <Stack direction="row" alignItems="center" sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", flex: 1 }}>
          {matchIndex}경기
        </Typography>
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
            </Menu>
          </>
        )}
      </Stack>

      {/* 참가자 박스 (직선 테두리) */}
      <Box sx={{ mx: 1.5, border: "1.5px solid #E5E7EB", borderRadius: 0, overflow: "hidden" }}>
        <SlotRow slot="a" name={nameA} seed={seedA} division={match.participant_a_division} score={sa} isWin={winA} {...commonSlotProps} />
        <Box sx={{ borderTop: "1.5px solid #E5E7EB", borderBottom: "1.5px solid #E5E7EB", py: 0.4, textAlign: "center", bgcolor: "#FAFAFA" }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#C4C9D4" }}>vs</Typography>
        </Box>
        <SlotRow slot="b" name={nameB} seed={seedB} division={match.participant_b_division} score={sb} isWin={winB} {...commonSlotProps} />
      </Box>

      {/* 코트 + 상태 버튼 */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
        <TextField
          size="small"
          inputRef={courtRef}
          defaultValue={match.court ?? ""}
          key={match.court ?? ""}
          onBlur={handleCourtBlur}
          placeholder="코트"
          disabled={!canManage}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <MeetingRoomIcon sx={{ fontSize: 14, color: "#9CA3AF" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 90, flexShrink: 0, "& .MuiOutlinedInput-root": { height: 40, borderRadius: 1.5, bgcolor: "#F9FAFB" }, "& .MuiOutlinedInput-input": { fontSize: 12, py: 0 } }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={handleStatus}
          disabled={isDone || !canManage}
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
    </Box>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
export default function LeagueTournamentMatchOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUser = useAppSelector((s) => s.auth.user);

  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotification();

  const [tabKey, setTabKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<{ matchId: string; slot: "a" | "b" } | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");

  const { data: leagueData } = useGetLeagueQuery(id!);
  const { data: matchesData, isLoading } = useGetLeagueMatchesQuery(id!, { pollingInterval: 15000 });
  const { data: groupData } = useGetGroupDetailQuery(
    leagueData?.league?.group_id ?? "",
    { skip: !leagueData?.league?.group_id },
  );
  const isCreator = !!authUser && leagueData?.league?.created_by_id === authUser?.id;
  const canManage = isCreator || groupData?.myRole === "owner" || groupData?.myRole === "admin";

  const { data: participantsData } = useGetLeagueParticipantsQuery(id!, { skip: !canManage });
  const [assignParticipant] = useAssignMatchParticipantMutation();

  // bracket=null인 리그 단계 경기 제외 (단일리그+토너먼트 혼합 포맷 지원)
  const matches = useMemo(() => (matchesData?.matches ?? []).filter((m) => !!m.bracket), [matchesData]);
  const participants = useMemo(() => participantsData?.participants ?? [], [participantsData]);

  // ── 탭 목록 ──────────────────────────────────────────────────────────────
  // 순서: 상위 R1 → 하위 R1 → 상위 R2 → 하위 R2 → ... (라운드별 상위/하위 교차)
  const tabs = useMemo<RoundTab[]>(() => {
    const makeTab = (bracket: string, r: number): RoundTab => {
      const sample = matches.find(
        (m) => (m.bracket ?? "upper") === bracket && m.round_number === r,
      );
      const prefix = bracket === "upper" ? "상위 " : "하위 ";
      return { key: `${bracket}-${r}`, label: sample?.match_label ?? `${prefix}R${r}`, bracket, roundNumber: r };
    };

    const upperRounds = [...new Set(
      matches.filter((m) => (m.bracket ?? "upper") === "upper").map((m) => m.round_number ?? 0),
    )].sort((a, b) => a - b);

    const lowerRounds = [...new Set(
      matches.filter((m) => m.bracket === "lower").map((m) => m.round_number ?? 0),
    )].sort((a, b) => a - b);

    // 순서: 상위 R1 → 상위 R2 → 하위 R1 → 상위 R3 → 하위 R2 → ...
    // 첫 상위 라운드 단독, 이후 상위[i] → 하위[i-1] 쌍으로 배치
    const result: RoundTab[] = [];
    if (upperRounds.length === 0) return lowerRounds.map((r) => makeTab("lower", r));
    result.push(makeTab("upper", upperRounds[0]));
    for (let i = 1; i < upperRounds.length; i++) {
      result.push(makeTab("upper", upperRounds[i]));
      if (i - 1 < lowerRounds.length) result.push(makeTab("lower", lowerRounds[i - 1]));
    }
    for (let i = upperRounds.length - 1; i < lowerRounds.length; i++) {
      result.push(makeTab("lower", lowerRounds[i]));
    }
    return result;
  }, [matches]);

  const activeTab = tabKey ?? tabs[0]?.key ?? "";

  // ── 현재 탭 매치 ──────────────────────────────────────────────────────────
  const currentMatches = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab);
    if (!tab) return [];
    return matches
      .filter((m) => (m.bracket ?? "upper") === tab.bracket && m.round_number === tab.roundNumber)
      .sort((a, b) => a.match_order - b.match_order);
  }, [matches, tabs, activeTab]);

  // ── 시드맵 ────────────────────────────────────────────────────────────────
  const seedMap = useMemo(() => {
    const r1 = matches
      .filter((m) => m.round_number === 1 && (!m.bracket || m.bracket === "upper"))
      .sort((a, b) => a.match_order - b.match_order);
    const n = r1.length * 2;
    if (n < 2) return new Map<string, { a: number; b: number }>();
    const seeds = seededBracket(n);
    const map = new Map<string, { a: number; b: number }>();
    r1.forEach((m, i) => map.set(m.id, { a: seeds[i * 2], b: seeds[i * 2 + 1] }));
    return map;
  }, [matches]);

  // ── 배정된 참가자 ID 집합 ─────────────────────────────────────────────────
  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.participant_a_id) set.add(m.participant_a_id);
      if (m.participant_b_id) set.add(m.participant_b_id);
    }
    return set;
  }, [matches]);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    return participants.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || (p.division ?? "").toLowerCase().includes(q),
    );
  }, [participants, participantSearch]);

  const handleAssign = async (participantId: string) => {
    if (!registerTarget) return;
    const body = registerTarget.slot === "a"
      ? { participant_a_id: participantId }
      : { participant_b_id: participantId };
    await assignParticipant({ leagueId: id!, matchId: registerTarget.matchId, ...body });
    setRegisterTarget(null);
  };

  const currentTab = tabs.find((t) => t.key === activeTab);
  const isCurrentR1 = currentTab?.roundNumber === 1 && currentTab?.bracket === "upper";

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%", bgcolor: "#fff" }}>

      {/* ── 헤더 ── */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", px: 0.5, py: 0.75, gap: 0.25, position: "sticky", top: 0, zIndex: 10 }}>
        <IconButton size="small" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>경기 순서</Typography>
        <Button
          size="small"
          startIcon={<AccountTreeIcon sx={{ fontSize: 14 }} />}
          onClick={() => navigate(`/league/${id}/tournament/bracket`)}
          sx={{ fontSize: 11, fontWeight: 700, textTransform: "none", color: "#2563EB", flexShrink: 0 }}
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
        {canManage && (
          <IconButton size="small" onClick={() => setEditMode((v) => !v)}
            sx={{ color: editMode ? "#10B981" : "#6B7280" }}>
            {editMode ? <CheckIcon sx={{ fontSize: 18 }} /> : <EditIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>

      {/* ── 라운드 탭 ── */}
      {tabs.length > 0 && (
        <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 49, zIndex: 9 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setTabKey(v)}
            variant="scrollable"
            scrollButtons
            allowScrollButtonsMobile
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 700, px: 1.5, py: 0 }, "& .MuiTabScrollButton-root": { width: 28 } }}
          >
            {tabs.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
          </Tabs>
        </Box>
      )}

      {/* ── 매치 목록 ── */}
      <Box sx={{ flex: 1, px: 1, pt: 1.5, pb: 10 }}>
        {currentMatches.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>경기가 없습니다.</Typography>
          </Box>
        ) : currentMatches.map((m, i) => {
          const seed = seedMap.get(m.id);
          return (
            <MatchCard
              key={m.id}
              match={m}
              matchIndex={i + 1}
              canManage={canManage}
              leagueId={id!}
              seedA={seed?.a}
              seedB={seed?.b}
              isR1={isCurrentR1}
              onRegister={(matchId, slot) => {
                setRegisterTarget({ matchId, slot });
                setParticipantSearch("");
              }}
            />
          );
        })}
      </Box>

      {/* ── 참가자 등록 다이얼로그 ── */}
      <Dialog
        open={!!registerTarget}
        onClose={() => setRegisterTarget(null)}
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2, maxHeight: "70vh" } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>
          참가자 등록
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 400, color: "text.secondary", ml: 1 }}>
            {assignedIds.size} / {participants.length}명
          </Typography>
        </DialogTitle>
        <Box sx={{ px: 2, pb: 1 }}>
          <TextField
            size="small" fullWidth placeholder="이름 또는 부수 검색"
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} /></InputAdornment> } }}
            sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
          />
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <List disablePadding>
            {filteredParticipants.map((p) => {
              const isAssigned = assignedIds.has(p.id);
              return (
                <ListItemButton
                  key={p.id}
                  disabled={isAssigned}
                  onClick={() => handleAssign(p.id)}
                  sx={{ px: 2, py: 1.25, borderBottom: "1px solid #F1F5F9" }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: "100%" }}>
                    {p.division && (
                      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#111827", lineHeight: 1, flexShrink: 0 }}>
                        {p.division}
                      </Box>
                    )}
                    <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                      {p.name}
                    </Typography>
                    {isAssigned && (
                      <Typography sx={{ fontSize: 11, color: "#94A3B8" }}>배정됨</Typography>
                    )}
                  </Stack>
                </ListItemButton>
              );
            })}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
