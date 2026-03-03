import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CachedIcon from "@mui/icons-material/Cached";
import confetti from "canvas-confetti";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
} from "../../features/league/leagueApi";
import {
  useGetDrawsQuery,
  useCreateDrawMutation,
  useDeleteDrawMutation,
  useUpdateDrawMutation,
  useRunDrawMutation,
  useGetDrawDetailQuery,
} from "../../features/draw/drawApi";
import type { DrawListItem } from "../../features/draw/drawApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";

type Phase = "list" | "create" | "animating" | "done";

type PrizeInput = {
  id: string;
  prize_name: string;
  quantity: number;
};

type DrawWinner = {
  participant_name: string;
  participant_division: string;
};

type PrizeResult = PrizeInput & {
  winners: DrawWinner[];
};

type ParticipantRow = {
  id: string;
  name: string;
  division: string;
  weight: number;
};

function weightedRandomPick(pool: ParticipantRow[], count: number): DrawWinner[] {
  const result: DrawWinner[] = [];
  const remaining = pool.filter((p) => p.weight > 0);
  const pickCount = Math.min(count, remaining.length);
  for (let i = 0; i < pickCount; i++) {
    const totalWeight = remaining.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let idx = remaining.length - 1;
    for (let k = 0; k < remaining.length; k++) {
      rand -= remaining[k].weight;
      if (rand <= 0) { idx = k; break; }
    }
    result.push({ participant_name: remaining[idx].name, participant_division: remaining[idx].division });
    remaining.splice(idx, 1);
  }
  return result;
}


function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ width: 56, flexShrink: 0, fontSize: 13 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

function generateLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}-${m}-${day}(${wd})`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

export default function DrawList() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const draftId = searchParams.get("draftId");
  const [phase, setPhase] = useState<Phase>(searchParams.get("create") === "1" || !!draftId ? "create" : "list");
  const [prizes, setPrizes] = useState<PrizeInput[]>(() => {
    // draftId가 있으면 API에서 로드하므로 sessionStorage 무시
    if (draftId || !leagueId) return [];
    try {
      const saved = sessionStorage.getItem(`draw_prizes_${leagueId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch { /* */ }
    return [];
  });
  const [prizeResults, setPrizeResults] = useState<PrizeResult[]>([]);
  const [pendingPrizeName, setPendingPrizeName] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [participantWeights, setParticipantWeights] = useState<Record<string, number>>({});
  const [alertMsg, setAlertMsg] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [prizesInitialized, setPrizesInitialized] = useState(false);

  const { data: leagueData } = useGetLeagueQuery(leagueId ?? "", { skip: !leagueId });
  const league = leagueData?.league;

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(
    league?.group_id ?? "",
    { skip: !league?.group_id },
  );
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");

  const { data: participantData, isLoading: loadingParticipants } = useGetLeagueParticipantsQuery(
    leagueId ?? "",
    { skip: !leagueId || phase !== "create", refetchOnMountOrArgChange: true },
  );

  const participantRows = useMemo<ParticipantRow[]>(() => {
    const loaded = participantData?.participants ?? [];
    return loaded.map((p) => ({
      id: p.id,
      name: p.name,
      division: p.division ?? "-",
      weight: participantWeights[p.id] ?? 1,
    }));
  }, [participantData, participantWeights]);

  const { data: drawsData, isLoading: loadingDraws, refetch: refetchDraws } = useGetDrawsQuery(
    leagueId ?? "",
    { skip: !leagueId },
  );
  const draws = drawsData?.draws ?? [];

  const [createDraw] = useCreateDrawMutation();
  const [deleteDraw] = useDeleteDrawMutation();
  const [updateDraw] = useUpdateDrawMutation();
  const [runDraw] = useRunDrawMutation();

  const { data: draftData } = useGetDrawDetailQuery(
    { leagueId: leagueId ?? "", drawId: draftId ?? "" },
    { skip: !draftId || !leagueId },
  );

  // draftId로 진입 시 기존 경품 사전 로드
  useEffect(() => {
    if (draftData && draftId && !prizesInitialized && phase === "create") {
      setPrizes(
        draftData.prizes.map((p) => ({
          id: generateLocalId(),
          prize_name: p.prize_name,
          quantity: p.quantity,
        })),
      );
      setPrizesInitialized(true);
    }
  }, [draftData, draftId, prizesInitialized, phase]);

  // prizes 변경 시 sessionStorage 자동 저장 (draftId 없을 때만)
  useEffect(() => {
    if (draftId || !leagueId) return;
    sessionStorage.setItem(`draw_prizes_${leagueId}`, JSON.stringify(prizes));
  }, [prizes, draftId, leagueId]);

  // 수정 다이얼로그 상태
  const [editDraw, setEditDraw] = useState<DrawListItem | null>(null);
  const editDrawSnapshot = useRef<DrawListItem | null>(null); // 닫힘 애니메이션 중 데이터 유지용
  const [editName, setEditName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmDraw, setDeleteConfirmDraw] = useState<DrawListItem | null>(null);

  // 완료 화면 폭죽 애니메이션
  useEffect(() => {
    if (phase !== "done") return;
    const fire = (originX: number, angle: number) =>
      confetti({
        particleCount: 6,
        angle,
        spread: 50,
        origin: { x: originX, y: 0.65 },
        colors: ["#2F80ED", "#56CCF2", "#F2994A", "#27AE60", "#EB5757"],
        zIndex: 9999,
      });
    let count = 0;
    animationRef.current = setInterval(() => {
      fire(0.1, 60);
      fire(0.9, 120);
      if (++count >= 8) { clearInterval(animationRef.current!); animationRef.current = null; }
    }, 200);
    return () => { if (animationRef.current) clearInterval(animationRef.current); };
  }, [phase]);

  const handleAddPrize = () => {
    if (!pendingPrizeName.trim()) {
      setAlertMsg("경품 이름을 입력해주세요.");
      return;
    }
    setPrizes((prev) => [
      ...prev,
      { id: generateLocalId(), prize_name: pendingPrizeName.trim(), quantity: pendingQuantity },
    ]);
    setPendingPrizeName("");
    setPendingQuantity(1);
  };

  const handleRemovePrize = (id: string) => {
    setPrizes((prev) => prev.filter((p) => p.id !== id));
  };

  const handleWeightChange = (participantId: string, delta: number) => {
    setParticipantWeights((prev) => ({
      ...prev,
      [participantId]: Math.max(0, (prev[participantId] ?? 1) + delta),
    }));
  };

  const handleRunDraw = () => {
    if (prizes.length === 0) {
      setAlertMsg("경품을 최소 1개 추가해주세요.");
      return;
    }
    if (participantRows.length === 0) {
      setAlertMsg("참가자가 없습니다.");
      return;
    }
    // 결과를 동기적으로 미리 계산해 state에 저장 후 애니메이션 시작
    const usedNames = new Set<string>();
    const results: PrizeResult[] = [];
    for (const prize of prizes) {
      const pool = participantRows.filter((p) => !usedNames.has(p.name));
      const winners = weightedRandomPick(pool, prize.quantity);
      winners.forEach((w) => usedNames.add(w.participant_name));
      results.push({ ...prize, winners });
    }
    setPrizeResults(results);
    setPhase("animating");
    setTimeout(() => {
      setPhase("done");
    }, 1600);
  };

  const handleSaveAsDraft = async () => {
    if (!leagueId) return;
    if (prizes.length === 0) {
      setAlertMsg("경품을 최소 1개 추가해주세요.");
      return;
    }
    setIsSavingDraft(true);
    const now = new Date();
    const drawName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 추첨`;
    try {
      await createDraw({
        leagueId,
        name: drawName,
        prizes: prizes.map((p) => ({
          prize_name: p.prize_name,
          quantity: p.quantity,
          winners: [],
        })),
      }).unwrap();
      refetchDraws();
    } catch {
      setAlertMsg("저장에 실패했습니다.");
      setIsSavingDraft(false);
      return;
    }
    setIsSavingDraft(false);
    if (leagueId) sessionStorage.removeItem(`draw_prizes_${leagueId}`);
    setPrizes([]);
    setPrizeResults([]);
    setPendingPrizeName("");
    setPendingQuantity(1);
    setParticipantWeights({});
    setPrizesInitialized(false);
    setPhase("list");
  };

  const handleSaveAndReturn = async () => {
    if (!leagueId) return;
    if (animationRef.current) { clearInterval(animationRef.current); animationRef.current = null; }

    const now = new Date();
    const drawName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 추첨`;

    try {
      if (draftId) {
        await runDraw({
          leagueId,
          drawId: draftId,
          prizes: prizeResults.map((p) => ({
            prize_name: p.prize_name,
            quantity: p.quantity,
            winners: p.winners.map((w) => ({
              participant_name: w.participant_name,
              participant_division: w.participant_division !== "-" ? w.participant_division : undefined,
            })),
          })),
        }).unwrap();
      } else {
        const res = await createDraw({
          leagueId,
          name: drawName,
          prizes: prizeResults.map((p) => ({
            prize_name: p.prize_name,
            quantity: p.quantity,
            winners: p.winners.map((w) => ({
              participant_name: w.participant_name,
              participant_division: w.participant_division !== "-" ? w.participant_division : undefined,
            })),
          })),
        }).unwrap();
        void res.draw_id;
      }
      refetchDraws();
    } catch {
      setAlertMsg("추첨 저장에 실패했습니다.");
      return;
    }

    if (leagueId) sessionStorage.removeItem(`draw_prizes_${leagueId}`);
    setPrizes([]);
    setPrizeResults([]);
    setPendingPrizeName("");
    setPendingQuantity(1);
    setParticipantWeights({});
    setPrizesInitialized(false);
    if (draftId) {
      navigate(`/draw/${leagueId}`, { replace: true });
    } else {
      setPhase("list");
    }
  };

  const handleDeleteDraw = async (drawId: string) => {
    if (!leagueId) return;
    try {
      await deleteDraw({ leagueId, drawId }).unwrap();
    } catch {
      setAlertMsg("추첨 삭제에 실패했습니다.");
    }
  };

  const handleBackToList = () => {
    if (animationRef.current) { clearInterval(animationRef.current); animationRef.current = null; }
    // prizes는 sessionStorage에 저장된 상태이므로 지우지 않음 (복귀 시 복원)
    setPrizeResults([]);
    setPendingPrizeName("");
    setPendingQuantity(1);
    setParticipantWeights({});
    setPrizesInitialized(false);
    setPhase("list");
  };

  const handleOpenEdit = (e: React.MouseEvent, draw: DrawListItem) => {
    e.stopPropagation();
    editDrawSnapshot.current = draw;
    setEditDraw(draw);
    setEditName(draw.name);
  };

  const handleSaveEdit = async () => {
    if (!leagueId || !editDraw) return;
    if (!editName.trim()) {
      setAlertMsg("추첨 이름을 입력해주세요.");
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateDraw({
        leagueId,
        drawId: editDraw.id,
        name: editName.trim(),
      }).unwrap();
      setEditDraw(null);
      refetchDraws();
    } catch {
      setAlertMsg("수정에 실패했습니다.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteFromEdit = () => {
    if (!editDraw) return;
    setDeleteConfirmDraw(editDraw);
    setEditDraw(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmDraw) return;
    setDeleteConfirmDraw(null);
    await handleDeleteDraw(deleteConfirmDraw.id);
  };

  const fromCreate = searchParams.get("create") === "1";

  // ─── 추첨하기 화면 ────────────────────────────────────────
  if (phase === "create") {
    return (
      <Stack spacing={2.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={draftId || fromCreate ? () => navigate(-1) : handleBackToList} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography fontWeight={900} fontSize={20}>{draftId ? "추첨 진행하기" : "경품 추첨"}</Typography>
        </Stack>

        <Typography fontWeight={800} fontSize={14}>경품</Typography>
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ p: 1.5, display: "grid", gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="상품명"
                value={pendingPrizeName}
                onChange={(e) => setPendingPrizeName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPrize(); }}
                sx={{ flex: 1 }}
              />
              <Select
                size="small"
                value={String(pendingQuantity)}
                onChange={(e: SelectChangeEvent<string>) => setPendingQuantity(Number(e.target.value))}
                sx={{ width: 84 }}
              >
                {[1, 2, 3, 4, 5, 10].map((q) => (
                  <MenuItem key={q} value={String(q)}>{q}명</MenuItem>
                ))}
              </Select>
              <Button
                size="small"
                variant="outlined"
                onClick={handleAddPrize}
                sx={{ minWidth: 50, fontWeight: 700 }}
              >
                추가
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {prizes.length > 0 && (
          <Stack spacing={1}>
            {prizes.map((prize, idx) => (
              <Card key={prize.id} elevation={1} sx={{ borderRadius: 1 }}>
                <CardContent sx={{ py: 1.2, px: 1.5, "&:last-child": { pb: 1.2 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={`${idx + 1}`}
                        size="small"
                        sx={{ height: 22, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }}
                      />
                      <Typography fontWeight={800} fontSize={15}>{prize.prize_name}</Typography>
                      <Chip label={`${prize.quantity}명`} size="small" sx={{ height: 22, fontWeight: 700 }} />
                    </Stack>
                    <IconButton size="small" onClick={() => handleRemovePrize(prize.id)}>
                      <DeleteOutlineIcon fontSize="small" sx={{ color: "#9CA3AF" }} />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 0.5 }} />

        <Typography fontWeight={800} fontSize={14}>참가자</Typography>
        {loadingParticipants ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : participantRows.length === 0 ? (
          <Typography sx={{ color: "#6B7280", textAlign: "center", py: 3, fontWeight: 700 }}>
            참가자가 없습니다.
          </Typography>
        ) : (
          <>
            <Stack direction="row" sx={{ px: 0.5 }}>
              <Typography variant="caption" sx={{ width: 52, color: "text.secondary", fontWeight: 700 }}>부수</Typography>
              <Typography variant="caption" sx={{ flex: 1, color: "text.secondary", fontWeight: 700 }}>이름</Typography>
              <Typography variant="caption" sx={{ width: 72, color: "text.secondary", fontWeight: 700, textAlign: "center" }}>가중치</Typography>
            </Stack>
            <Divider />
            <Stack spacing={0.8}>
              {participantRows.map((row) => (
                <Stack key={row.id} direction="row" alignItems="center" sx={{ px: 0.5, opacity: row.weight === 0 ? 0.35 : 1 }}>
                  <Box sx={{ width: 52 }}>
                    <Chip label={row.division} size="small" sx={{ fontSize:10, display: "inline-flex", borderRadius: 9999, height: 36, minWidth: 36, fontWeight: 800, bgcolor: "#FAAA47", color: "#000000"}} />
                  </Box>
                  <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 15, textDecoration: row.weight === 0 ? "line-through" : "none" }}>{row.name}</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: 72, justifyContent: "center" }}>
                    <Box
                      onClick={() => handleWeightChange(row.id, -1)}
                      sx={{ width: 22, height: 22, border: "1px solid #BDBDBD", borderRadius: 0.5, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900, cursor: "pointer", userSelect: "none", "&:hover": { bgcolor: "#F3F4F6" } }}
                    >-</Box>
                    <Typography sx={{ fontWeight: 900, minWidth: 16, textAlign: "center" }}>{row.weight}</Typography>
                    <Box
                      onClick={() => handleWeightChange(row.id, 1)}
                      sx={{ width: 22, height: 22, border: "1px solid #BDBDBD", borderRadius: 0.5, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900, cursor: "pointer", userSelect: "none", "&:hover": { bgcolor: "#F3F4F6" } }}
                    >+</Box>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 0.5 }} />

        <Stack direction="row" spacing={1}>
          {!draftId && (
            <Button
              fullWidth
              variant="outlined"
              onClick={handleSaveAsDraft}
              disabled={prizes.length === 0 || isSavingDraft}
              disableElevation
              sx={{ borderRadius: 1, py: 1.1, fontWeight: 700 }}
            >
              {isSavingDraft ? "저장 중..." : "경품 저장"}
            </Button>
          )}
          <Button
            fullWidth
            variant="contained"
            onClick={handleRunDraw}
            disableElevation
            sx={{ borderRadius: 1, py: 1.1, fontWeight: 700 }}
          >
            자동 추첨
          </Button>
        </Stack>

        <Snackbar open={!!alertMsg} autoHideDuration={2500} onClose={() => setAlertMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
          <Alert severity="warning" onClose={() => setAlertMsg("")} sx={{ fontWeight: 700 }}>{alertMsg}</Alert>
        </Snackbar>
      </Stack>
    );
  }

  // ─── 추첨 진행 중 ─────────────────────────────────────────
  if (phase === "animating") {
    return (
      <Stack spacing={3} alignItems="center" sx={{ pt: 8 }}>
        <CachedIcon sx={{ fontSize: 52 }} />
        <Typography color="text.secondary" fontWeight={700}>추첨 진행 중...</Typography>
        <Box sx={{ width: "100%", maxWidth: 260 }}>
          <LinearProgress />
        </Box>
      </Stack>
    );
  }

  // ─── 추첨 완료 화면 ───────────────────────────────────────
  if (phase === "done") {
    return (
      <Stack spacing={2.2}>
        <Typography fontWeight={900} fontSize={20} sx={{ flex: 1 }}>추첨 결과</Typography>

        {prizeResults.map((prize, idx) => (
          <Card key={prize.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ py: 1.5, px: 1.8, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Chip label={`${idx + 1}`} size="small" sx={{ height: 22, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }} />
                <Typography fontWeight={900} fontSize={15} sx={{ flex: 1 }}>{prize.prize_name}</Typography>
                <Chip label={`${prize.quantity}명`} size="small" sx={{ height: 22, fontWeight: 700 }} />
              </Stack>
              <Divider sx={{ mb: 1 }} />
              {prize.winners.length === 0 ? (
                <Typography color="text.secondary" fontSize={13} fontWeight={700}>당첨자 없음 (참가자 부족)</Typography>
              ) : (
                <Stack spacing={0.6}>
                  {prize.winners.map((w, wi) => (
                    <Stack key={wi} direction="row" alignItems="center" spacing={1}>
                      <Chip label={`${wi + 1}`} size="small" sx={{ height: 22, fontWeight: 800, minWidth: 28 }} />
                      {w.participant_division !== "-" && (
                        <Chip label={w.participant_division} size="small" sx={{ height: 22, fontWeight: 700 }} />
                      )}
                      <Typography fontWeight={800} fontSize={15}>{w.participant_name}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          fullWidth
          variant="contained"
          onClick={handleSaveAndReturn}
          disableElevation
          sx={{ mt: 1, borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
        >
          저장하고 목록으로
        </Button>
      </Stack>
    );
  }

  // ─── 추첨 목록 화면 ───────────────────────────────────────
  return (
    <Stack spacing={2.2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography fontWeight={900} fontSize={20} sx={{ flex: 1 }}>경품 추첨</Typography>
      </Stack>

      {league && (
        <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mt: -1 }}>
          {league.name}
        </Typography>
      )}

      {canManage && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disableElevation
          onClick={() => setPhase("create")}
          sx={{ borderRadius: 1, fontWeight: 700, alignSelf: "flex-start" }}
        >
          추첨 생성
        </Button>
      )}

      {loadingDraws ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={36} />
        </Box>
      ) : draws.length === 0 ? (
        <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <CardContent sx={{ py: 3, textAlign: "center", "&:last-child": { pb: 3 } }}>
            <Typography color="text.secondary" fontWeight={700}>
              {canManage ? "추첨 만들기 버튼으로 첫 추첨을 생성하세요." : "아직 추첨이 없습니다."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {draws.map((draw) => (
            <Card
              key={draw.id}
              elevation={2}
              sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", cursor: "pointer" }}
              onClick={() => navigate(`/draw/${leagueId}/${draw.id}`)}
            >
              <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800} noWrap>{draw.name}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.3}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {formatDate(draw.created_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">·</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        경품 {draw.prize_count}개 · 당첨 {draw.total_quantity}명
                      </Typography>
                      {draw.prize_count > 0 && draw.winner_count === 0 && (
                        <Chip
                          label="추첨 대기"
                          size="small"
                          sx={{ height: 18, fontWeight: 700, bgcolor: "#FFF7E6", color: "#F59E0B", fontSize: 11 }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {canManage && (
                      <>
                        <IconButton onClick={(e) => handleOpenEdit(e, draw)} sx={{ color: "#9CA3AF", p: 1 }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton onClick={(e) => { e.stopPropagation(); setDeleteConfirmDraw(draw); }} sx={{ color: "#9CA3AF", p: 1 }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    <ChevronRightIcon sx={{ color: "#9CA3AF", ml: 0.5 }} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Snackbar open={!!alertMsg} autoHideDuration={2500} onClose={() => setAlertMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" onClose={() => setAlertMsg("")} sx={{ fontWeight: 700 }}>{alertMsg}</Alert>
      </Snackbar>

      {/* ─── 삭제 확인 다이얼로그 ─── */}
      <Dialog open={!!deleteConfirmDraw} onClose={() => setDeleteConfirmDraw(null)}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17 }}>추첨 삭제</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700}>
            <b>{deleteConfirmDraw?.name}</b> 추첨을 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            삭제된 추첨은 복구할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteConfirmDraw(null)} sx={{ fontWeight: 700 }}>취소</Button>
          <Button variant="contained" color="error" disableElevation onClick={handleConfirmDelete} sx={{ fontWeight: 700 }}>삭제</Button>
        </DialogActions>
      </Dialog>

      {/* ─── 수정 다이얼로그 ─── */}
      <Dialog open={!!editDraw} onClose={() => setEditDraw(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16, pb: 0, pt: 2, px: 2.5 }}>추첨 수정</DialogTitle>
        <DialogContent sx={{ px: 2.5, pb: 1, pt: "12px !important" }}>
          <Stack spacing={1.2}>
            {/* 추첨코드 */}
            <Row label="추첨코드">
              <Typography variant="body2" fontWeight={800} sx={{ fontFamily: "monospace" }}>
                {editDrawSnapshot.current?.id.replace(/-/g, "").slice(0, 12).toUpperCase() ?? "-"}
              </Typography>
            </Row>

            {/* 추첨명 */}
            <Row label="추첨명">
              <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)} sx={{ flex: 1 }} inputProps={{ style: { fontSize: 13, padding: "5px 8px" } }} />
            </Row>

            <Divider sx={{ my: 0.5 }} />

            {/* 생성자 */}
            <Row label="생성자">
              <Typography variant="body2" fontWeight={700}>
                {editDrawSnapshot.current?.creator_name ?? <span style={{ color: "#9CA3AF" }}>정보 없음</span>}
              </Typography>
            </Row>

            {/* 생성일시 */}
            <Row label="생성일시">
              <Typography variant="body2">
                {editDrawSnapshot.current ? formatDateTime(editDrawSnapshot.current.created_at) : "정보 없음"}
              </Typography>
            </Row>

            <Divider sx={{ my: 0.5 }} />

            <Box>
              <Button size="small" sx={{ color: "error.main", p: 0, fontWeight: 700, minWidth: 0, fontSize: 13 }} onClick={handleDeleteFromEdit}>
                추첨 삭제
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => setEditDraw(null)} sx={{ fontWeight: 700, fontSize: 13 }}>취소</Button>
          <Button variant="contained" disableElevation disabled={isSavingEdit} onClick={handleSaveEdit} sx={{ fontWeight: 700, fontSize: 13 }}>수정</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
