import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, InputAdornment, List, ListItemButton, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
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
const STATUS_LABEL: Record<string, string> = { pending: "시작", playing: "저장", done: "완료" };
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
    <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1, minHeight: 44 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", minWidth: 30, flexShrink: 0 }}>
        {isR1 && seed ? `1-${seed}` : ""}
      </Typography>
      {division ? (
        <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#111827", lineHeight: 1, flexShrink: 0, mr: 0.75 }}>
          {division}
        </Box>
      ) : null}
      {name ? (
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isWin ? "#16A34A" : "#111827" }}>
          {name}
        </Typography>
      ) : isR1 && canManage ? (
        <Button size="small" onClick={() => onRegister(matchId, slot)}
          sx={{ fontSize: 12, fontWeight: 700, px: 2, minWidth: 52, height: 28, borderRadius: "20px", border: "1.5px solid #93C5FD", color: "#2563EB", whiteSpace: "nowrap", flexShrink: 0 }}>
          등록
        </Button>
      ) : (
        <Typography sx={{ fontSize: 13, color: "#CBD5E1", fontStyle: "italic", flex: 1 }}>미정</Typography>
      )}
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
        {canScore && (
          <IconButton size="small" onClick={() => onScore(slot, -1)} sx={{ p: 0.75, color: "#9CA3AF" }}>
            <RemoveIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <Box sx={{ minWidth: 36, height: 32, border: "1.5px solid #E2E8F0", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: isWin ? "#F0FDF4" : "#FAFAFA" }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: isWin ? "#16A34A" : "#111827" }}>{score}</Typography>
        </Box>
        {canScore && (
          <IconButton size="small" onClick={() => onScore(slot, 1)} sx={{ p: 0.75, color: "#2563EB" }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
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
  const courtRef = useRef<HTMLInputElement>(null);

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

  return (
    <Box sx={{
      bgcolor: isPlaying ? "#EFF6FF" : isDone ? "#F9FAFB" : "#fff",
      border: `1.5px solid ${isPlaying ? "#93C5FD" : isDone ? "#D1D5DB" : "#E2E8F0"}`,
      borderRadius: 2, mb: 1.5,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      {/* 경기 번호 헤더 */}
      <Box sx={{ px: 2, py: 0.6, bgcolor: isPlaying ? "#DBEAFE" : isDone ? "#F3F4F6" : "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: isPlaying ? "#2563EB" : "#94A3B8" }}>
          {matchIndex}경기
        </Typography>
      </Box>

      <SlotRow slot="a" name={nameA} seed={seedA} division={match.participant_a_division} score={sa} isWin={winA} {...commonSlotProps} />

      <Box sx={{ mx: 2, height: "1px", bgcolor: "#F1F5F9" }} />

      <SlotRow slot="b" name={nameB} seed={seedB} division={match.participant_b_division} score={sb} isWin={winB} {...commonSlotProps} />

      {/* 코트 + 상태 버튼 */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderTop: "1px solid #F1F5F9" }}>
        <TextField
          size="small"
          inputRef={courtRef}
          defaultValue={match.court ?? ""}
          onBlur={handleCourtBlur}
          placeholder="코트"
          disabled={!canManage}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <MeetingRoomIcon sx={{ fontSize: 13, color: "#94A3B8" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 100, "& .MuiOutlinedInput-root": { height: 32, borderRadius: 3, bgcolor: "#F9FAFB" }, "& .MuiOutlinedInput-input": { fontSize: 12, py: 0 } }}
        />
        <Box sx={{ flex: 1 }} />
        {canManage && (
          <Button
            size="small"
            onClick={handleStatus}
            disabled={isDone}
            variant={isPlaying ? "contained" : "outlined"}
            disableElevation
            sx={{
              fontSize: 13, fontWeight: 700, px: 2.5, height: 32, borderRadius: 2, minWidth: 68,
              ...(isDone
                ? { color: "#10B981", borderColor: "#A7F3D0", bgcolor: "#F0FDF4", "&.Mui-disabled": { color: "#10B981", borderColor: "#A7F3D0", bgcolor: "#F0FDF4" } }
                : isPlaying
                ? { bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }
                : { borderColor: "#D1D5DB", color: "#374151", "&:hover": { bgcolor: "#F9FAFB" } }),
            }}
          >
            {STATUS_LABEL[match.status]}
          </Button>
        )}
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

  const matches = useMemo(() => matchesData?.matches ?? [], [matchesData]);
  const participants = useMemo(() => participantsData?.participants ?? [], [participantsData]);

  // ── 탭 목록 ──────────────────────────────────────────────────────────────
  // 순서: 상위 R1 → 하위 R1 → 상위 R2 → 하위 R2 → ... (라운드별 상위/하위 교차)
  const tabs = useMemo<RoundTab[]>(() => {
    const makeTab = (bracket: string, r: number): RoundTab => {
      const sample = matches.find(
        (m) => (m.bracket ?? "upper") === bracket && m.round_number === r,
      );
      return { key: `${bracket}-${r}`, label: sample?.match_label ?? `R${r}`, bracket, roundNumber: r };
    };

    const upperRounds = [...new Set(
      matches.filter((m) => (m.bracket ?? "upper") === "upper").map((m) => m.round_number ?? 0),
    )].sort((a, b) => a - b);

    const lowerRounds = [...new Set(
      matches.filter((m) => m.bracket === "lower").map((m) => m.round_number ?? 0),
    )].sort((a, b) => a - b);

    const result: RoundTab[] = [];
    const maxLen = Math.max(upperRounds.length, lowerRounds.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < upperRounds.length) result.push(makeTab("upper", upperRounds[i]));
      if (i < lowerRounds.length) result.push(makeTab("lower", lowerRounds[i]));
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
