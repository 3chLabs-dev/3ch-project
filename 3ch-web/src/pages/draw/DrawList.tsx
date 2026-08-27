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
import { useGetMyFeatureUsageQuery } from "../../features/payment/usageApi";

// Animation delay steps (ms): fast → slow
const ANIM_STEPS = [50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,80,110,150,200,280,400,600];

type Phase = "list" | "create";

type PrizeInput = {
  id: string;
  prize_name: string;
  quantity: number;
  winners: DrawWinner[];
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

function isDrawQuotaError(error: unknown) {
  const candidate = error as { status?: number; data?: { code?: string } };
  return candidate?.status === 402 && candidate.data?.code === "DRAW_CREATE_QUOTA_EXHAUSTED";
}

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
  const hh = String(d.getHours()).padStart(2, "0");;
  const minute = String(d.getMinutes()).padStart(2, "0");;
  return `${y}-${m}-${day}(${wd}) ${hh}:${minute}`;
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

type PendingWinner = { participant_name: string; participant_division: string | null };

export default function DrawList() {
  const { leagueId } = useParams<{ leagueId: string; }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [drawingPrize, setDrawingPrize] = useState<PrizeInput | null>(null);
  const [animPhase, setAnimPhase] = useState<"spinning" | "result">("spinning");
  const [rollingName, setRollingName] = useState("");
  const [pendingWinners, setPendingWinners] = useState<PendingWinner[]>([]);
  const [isSavingWinner, setIsSavingWinner] = useState(false);
  const [autoDrawOpen, setAutoDrawOpen] = useState(false);
  const [autoDrawPhase, setAutoDrawPhase] = useState<"spinning" | "result">("spinning");
  const [autoPrizeIndex, setAutoPrizeIndex] = useState(0);
  const [autoRollingName, setAutoRollingName] = useState("");

  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [dialogConfirmState, setDialogConfirmState] = useState<{
    open: boolean;
    prize: PrizeInput | null;
  }>({
    open: false,
    prize: null,
  });

  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleRedraw() {
    if (!drawingPrize) return;
    clearAnimTimer();
    const pool = getEligiblePool(drawingPrize.id);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected: PendingWinner[] = shuffled.slice(0, drawingPrize.quantity).map((p) => ({
      participant_name: p.name,
      participant_division: p.division ?? null,
    }));
    setPendingWinners(selected);
    runAnimation(pool, selected);
  }

  function handleCloseDialog() {
    clearAnimTimer();
    setDrawingPrize(null);
    setAnimPhase("spinning");
    setRollingName("");
    setPendingWinners([]);
    setIsSavingWinner(false);
  }

  function runAnimation(pool: { name: string }[], selected: PendingWinner[]) {
      setAnimPhase("spinning");
      const names = pool.map((p) => p.name);
      let stepIdx = 0;
  
      function tick() {
        if (stepIdx >= ANIM_STEPS.length) {
          setRollingName(selected[0]?.participant_name ?? "");
          setAnimPhase("result");
          setTimeout(() => {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: 9999 });
          }, 50);
          return;
        }
        setRollingName(names[Math.floor(Math.random() * names.length)]);
        animTimerRef.current = setTimeout(tick, ANIM_STEPS[stepIdx++]);
      }
  
      tick();
    }

  const draftId = searchParams.get("draftId");
  const [phase, setPhase] = useState<Phase>(searchParams.get("create") === "1" || !!draftId ? "create" : "list");

  function clearAnimTimer() {
    if (animTimerRef.current !== null) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }
  
  const [prizes, setPrizes] = useState<PrizeInput[]>([]);
  const [prizeResults, setPrizeResults] = useState<PrizeResult[]>([]);
  const [pendingPrizeName, setPendingPrizeName] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [participantWeights, setParticipantWeights] = useState<Record<string, number>>({});
  const [alertMsg, setAlertMsg] = useState("");
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const {
    data: featureUsageData,
    refetch: refetchFeatureUsage,
  } = useGetMyFeatureUsageQuery();

  const { data: leagueData } = useGetLeagueQuery(leagueId ?? "", { skip: !leagueId });
  const league = leagueData?.league;

  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(
    league?.group_id ?? "",
    { skip: !league?.group_id },
  );
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");

  useEffect(() => {
    if( draftId ){
      if( canManage ) {
        setPhase("create");
      } else {
        navigate(`/draw/${leagueId}/${draftId}`, { replace: true });
      }
    } else {
      setPhase("list");
    }
  }, [draftId, canManage, navigate, leagueId]);

  const { data: participantData, isLoading: loadingParticipants } = useGetLeagueParticipantsQuery(
    leagueId ?? "",
    { skip: !leagueId || phase !== "create", refetchOnMountOrArgChange: true },
  );

  function getEligiblePool(targetPrizeId: string) {
    const participants = participantData?.participants ?? [];
    const otherWinnerNames = new Set<string>();
    (draftData?.prizes ?? []).forEach((p) => {
      if (p.id !== targetPrizeId) {
        p.winners.forEach((w) => otherWinnerNames.add(w.participant_name));
      }
    });
    return participants.filter((p) => !otherWinnerNames.has(p.name));
  }

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

  const { data: draftData, refetch: refetchDetail } = useGetDrawDetailQuery(
    { leagueId: leagueId ?? "", drawId: draftId ?? "" },
    { skip: !draftId || !leagueId },
  );

  // draftId로 진입 시 기존 경품 사전 로드
  useEffect(() => {
    if (draftData && draftId) {
      // create 용 화면 데이터 셋팅
      setPrizes(
        draftData.prizes.map((p) => ({
          id: p.id,
          prize_name: p.prize_name,
          quantity: p.quantity,
          winners: (p.winners ?? []).map(w => ({
          participant_name: w.participant_name,
          participant_division: w.participant_division ?? "",})),
        })),
      );
    }
  }, [draftData, draftId, phase]);

  // 수정 다이얼로그 상태
  const [editDraw, setEditDraw] = useState<DrawListItem | null>(null);
  const editDrawSnapshot = useRef<DrawListItem | null>(null); // 닫힘 애니메이션 중 데이터 유지용
  const [editName, setEditName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmDraw, setDeleteConfirmDraw] = useState<DrawListItem | null>(null);

  const handleAddPrize = () => {
    if (!pendingPrizeName.trim()) {
      setAlertMsg("경품 이름을 입력해주세요.");
      return;
    }
    setPrizes((prev) => [
      ...prev,
      { id: generateLocalId(), prize_name: pendingPrizeName.trim(), quantity: pendingQuantity, winners: [], },
    ]);
    setPendingPrizeName("");
    setPendingQuantity(1);
  };

  const handleRemovePrize = (id: string) => {
    setPrizes((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRunSingleDraw = (selectedPrize: PrizeInput) => {
    if (participantRows.length === 0) {
      setAlertMsg("참가자가 없습니다. 리그 참가자를 먼저 등록해주세요.");
      return;
    }

    const usedNames = new Set<string>();

    // (만약 기존 결과에서 이미 당첨된 사람 제외하고 싶다면)
    prizes.forEach(prize => {
      prize.winners.forEach(w => usedNames.add(w.participant_name));
    });

    const pool = participantRows.filter((p) => !usedNames.has(p.name));
    const winners = weightedRandomPick(pool, selectedPrize.quantity);
    
    const results: PrizeResult[] = prizes.map(prize => {
      if (prize.id === selectedPrize.id) {
        return {
          ...prize,
          winners,
        };
      }

      return prize; // 기존 그대로 유지
    });

    const resultDrawingPrize: PrizeInput ={
      id: selectedPrize.id,
      prize_name: selectedPrize.prize_name,
      quantity: selectedPrize.quantity,
      winners: winners,
    }

    setPrizeResults(results);
    setPendingWinners(winners);
    setDrawingPrize(resultDrawingPrize);
    runAnimation(pool, winners);
  };

  async function handleSaveWinner() {
    if (!drawingPrize || !leagueId || !draftId) return;
    setIsSavingWinner(true);
    try {
      await runDraw({
        leagueId,
        drawId: draftId,
        prizes: prizeResults.map((prize) => ({
          prize_name: prize.prize_name,
          quantity: prize.quantity,
          winners: prize.winners.map((winner) => ({
            participant_name: winner.participant_name,
            participant_division: winner.participant_division !== "-" ? winner.participant_division : undefined,
          })),
        })),
      }).unwrap();
      await refetchDetail();
      handleCloseDialog();
    } catch {
      setAlertMsg("저장 중 오류가 발생했습니다.");
      setIsSavingWinner(false);
    }
  }

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
    clearAnimTimer();
    setAutoDrawOpen(true);
    setAutoDrawPhase("spinning");
    setAutoPrizeIndex(0);

    const rollingNames = participantRows.filter((participant) => participant.weight > 0).map((participant) => participant.name);
    let prizeIndex = 0;
    let stepIndex = 0;

    const finishAutoDraw = () => {
      setAutoDrawPhase("result");
      setTimeout(() => {
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, zIndex: 9999 });
      }, 50);
    };

    const tick = () => {
      const prize = results[prizeIndex];
      if (!prize) {
        finishAutoDraw();
        return;
      }

      if (stepIndex >= ANIM_STEPS.length) {
        setAutoRollingName(prize.winners[0]?.participant_name ?? "당첨자 없음");
        animTimerRef.current = setTimeout(() => {
          prizeIndex += 1;
          stepIndex = 0;
          if (prizeIndex >= results.length) {
            finishAutoDraw();
            return;
          }
          setAutoPrizeIndex(prizeIndex);
          tick();
        }, 600);
        return;
      }

      setAutoRollingName(rollingNames[Math.floor(Math.random() * rollingNames.length)] ?? "당첨자 없음");
      animTimerRef.current = setTimeout(tick, ANIM_STEPS[stepIndex++]);
    };

    tick();
  };

  const handleSaveAsDraft = async () => {
    if (!leagueId) return;
    if (prizes.length === 0) {
      setAlertMsg("경품을 최소 1개 추가해주세요.");
      return;
    }
    setIsSavingDraft(true);
    const usageResult = await refetchFeatureUsage();
    const available = usageResult.data?.usage.draw_create;
    if (available && !available.unlimited && (available.remaining ?? 0) <= 0) {
      setQuotaDialogOpen(true);
      setIsSavingDraft(false);
      return;
    }
    const now = new Date();
    const drawName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 추첨`;
    try {
      await createDraw({
        leagueId,
        idempotencyKey: crypto.randomUUID(),
        name: drawName,
        prizes: prizes.map((p) => ({
          prize_name: p.prize_name,
          quantity: p.quantity,
          winners: [],
        })),
      }).unwrap();
      await refetchFeatureUsage();
      refetchDraws();
    } catch (error) {
      if (isDrawQuotaError(error)) setQuotaDialogOpen(true);
      else setAlertMsg("저장에 실패했습니다.");
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
    setAutoDrawOpen(false);
    setPhase("list");
  };

  // nak 이게 추첨내용 최종 저장하는 로직
  const handleSaveAndReturn = async () => {
    if (!leagueId) return;

    const now = new Date();
    const drawName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} 추첨`;
    let newDrawId: string | undefined;

    try {
      if (!draftId) {
        const usageResult = await refetchFeatureUsage();
        const available = usageResult.data?.usage.draw_create;
        if (available && !available.unlimited && (available.remaining ?? 0) <= 0) {
          setQuotaDialogOpen(true);
          return;
        }
      }
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
          idempotencyKey: crypto.randomUUID(),
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
        newDrawId = res.draw_code ?? res.draw_id;
      }
      await refetchFeatureUsage();
      refetchDraws();
    } catch (error) {
      if (isDrawQuotaError(error)) setQuotaDialogOpen(true);
      else setAlertMsg("추첨 저장에 실패했습니다.");
      return;
    }

    if (leagueId) sessionStorage.removeItem(`draw_prizes_${leagueId}`);
    setPrizes([]);
    setPrizeResults([]);
    setPendingPrizeName("");
    setPendingQuantity(1);
    setParticipantWeights({});
    setAutoDrawOpen(false);
    // (수정)이 부분에서 다시 원래 화면으로 돌아가야 하는거 추가해야함
    if (draftId) {
      navigate(`/draw/${leagueId}/${draftId}`, { replace: true });
    } else if (newDrawId) {
      navigate(`/draw/${leagueId}/${newDrawId}`, { replace: true });
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

  // ─── 추첨하기 화면 ────────────────────────────────────────
  if (phase === "create" && canManage) {
    return (
      <>
      <Stack spacing={2.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton
            onClick={() => {
              clearAnimTimer();
              if (leagueId) sessionStorage.removeItem(`draw_prizes_${leagueId}`);
              setPrizes([]);
              setPrizeResults([]);
              setPendingPrizeName("");
              setPendingQuantity(1);
              setParticipantWeights({});
              setPhase("list");
              navigate(`/draw/${leagueId}`, { replace: true });
            }}
            size="small"
          >
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
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {canManage && draftId && (
                        <Button
                          variant={prize.winners.length > 0 ? "outlined" : "contained"}
                          size="small"
                          disableElevation
                          onClick={() => setDialogConfirmState({open: true, prize: prize,})}
                          sx={{ borderRadius: 1, fontWeight: 700, minWidth: 56, height: 28, fontSize: 12 }}
                        >
                          {prize.winners.length > 0 ? "재추첨" : "추첨"}
                        </Button>
                      )}
                      <IconButton size="small" onClick={() => handleRemovePrize(prize.id)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: "#9CA3AF" }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Divider sx={{ mt: 0.75, mb: 1 }} />
                  {prize.winners.length === 0 ? (
                    <Typography color="text.secondary" fontSize={13} fontWeight={700}>추첨 전</Typography>
                  ) : (
                    <Stack spacing={0.6}>
                      {prize.winners.map((w, wi) => (
                        <Stack key={wi} direction="row" alignItems="center" spacing={1}>
                          <Chip label={`${wi + 1}`} size="small" sx={{ height: 22, fontWeight: 800, minWidth: 28 }} />
                          {w.participant_division !== "-" && (
                            <Chip label={w.participant_division} size="small" sx={{ borderRadius: 9999, fontWeight: 700, bgcolor: "#FAAA47", color: "#000000", height: 36, minWidth: 36 }} />
                          )}
                          <Typography fontWeight={800} fontSize={15}>{w.participant_name}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {draftId && (
          <>
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
              <Box sx={{ bgcolor: "#fff", borderRadius: 1, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.8, bgcolor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <Box sx={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>부수</Typography>
                  </Box>
                  <Box sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>이름</Typography>
                  </Box>
                  <Box sx={{ width: 92, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>가중치</Typography>
                  </Box>
                </Box>

                {participantRows.map((row, idx) => (
                  <Box
                    key={row.id}
                    sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.9, borderTop: idx === 0 ? "none" : "1px solid #F3F4F6", opacity: row.weight === 0 ? 0.35 : 1 }}
                  >
                    <Box sx={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#FAAA47", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>
                        {row.division || "-"}
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: row.weight === 0 ? "line-through" : "none" }}>
                        {row.name}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ width: 92, flexShrink: 0 }}>
                      <Box
                        component="button"
                        type="button"
                        aria-label={`${row.name} 가중치 감소`}
                        onClick={() => handleWeightChange(row.id, -1)}
                        sx={{ width: 24, height: 24, p: 0, border: "1px solid #D1D5DB", borderRadius: 0.6, bgcolor: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 16, fontWeight: 800, lineHeight: 1, cursor: "pointer", userSelect: "none", flexShrink: 0, "&:hover": { bgcolor: "#F3F4F6" } }}
                      >−</Box>
                      <Typography sx={{ width: 20, fontWeight: 900, fontSize: 14, lineHeight: 1, textAlign: "center" }}>{row.weight}</Typography>
                      <Box
                        component="button"
                        type="button"
                        aria-label={`${row.name} 가중치 증가`}
                        onClick={() => handleWeightChange(row.id, 1)}
                        sx={{ width: 24, height: 24, p: 0, border: "1px solid #D1D5DB", borderRadius: 0.6, bgcolor: "#fff", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 16, fontWeight: 800, lineHeight: 1, cursor: "pointer", userSelect: "none", flexShrink: 0, "&:hover": { bgcolor: "#F3F4F6" } }}
                      >+</Box>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
        

        <Divider sx={{ my: 0.5 }} />

        {!draftId && (
          <Stack alignItems="flex-end" spacing={0.25}>
            <Typography sx={{ color: "#6B7280", fontSize: 12 }}>
              추첨 생성 잔여 횟수:{" "}
              <Box component="span" sx={{ color: "#1976D2", fontWeight: 900 }}>
                {featureUsageData?.usage.draw_create.unlimited
                  ? "무제한"
                  : `${featureUsageData?.usage.draw_create.remaining ?? 0}회`}
              </Box>
            </Typography>
            {!featureUsageData?.usage.draw_create.unlimited
              && featureUsageData?.usage.draw_create.expiresAt && (
              <Typography sx={{ color: "#9CA3AF", fontSize: 11 }}>
                {new Date(featureUsageData.usage.draw_create.expiresAt).toLocaleDateString("ko-KR")}까지
              </Typography>
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={1}>
          {!draftId ? (
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
          ) : ( 
                      <Button
            fullWidth
            variant="contained"
            onClick={handleRunDraw}
            disableElevation
            sx={{ borderRadius: 1, py: 1.1, fontWeight: 700 }}
          >
            자동 추첨
          </Button>
  )}
        </Stack>
          <Snackbar open={!!alertMsg || !!confirmState} autoHideDuration={confirmState ? null : 2500} onClose={() => {setAlertMsg(""); setConfirmState(null);}} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, }}>
            <Alert severity="warning"
              onClose={() => {
                setAlertMsg("");
                setConfirmState(null);
              }}
              sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}
              action={
                confirmState ? (
                  <>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        confirmState.onConfirm();
                        setConfirmState(null);
                      }}
                    >
                      확인
                    </Button>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setConfirmState(null)}
                    >
                      취소
                    </Button>
                  </>
                ) : null
              }
            >
              {confirmState?.message || alertMsg}
            </Alert>
          </Snackbar>
      </Stack>
      <Dialog open={quotaDialogOpen} onClose={() => setQuotaDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>추첨 생성 횟수 안내</DialogTitle>
        <DialogContent>
          <Typography fontSize={14}>
            사용할 수 있는 추첨 생성 횟수가 없습니다. 요금제를 변경하거나 다음 이용 기간을 기다려 주세요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setQuotaDialogOpen(false)}>닫기</Button>
          <Button variant="contained" onClick={() => navigate("/mypage/pricing")}>요금제 보기</Button>
        </DialogActions>
      </Dialog>

      {/* 슬롯머신 추첨 다이얼로그 */}
      <Dialog
        open={!!drawingPrize}
        onClose={animPhase === "result" ? handleCloseDialog : undefined}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>
          {drawingPrize?.prize_name}
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          {animPhase === "spinning" ? (
            <Box sx={{ py: 4 }}>
              <Typography
                fontSize={38}
                fontWeight={900}
                sx={{
                  filter: "blur(2px)",
                  color: "primary.main",
                  letterSpacing: 1,
                  userSelect: "none",
                  minHeight: 52,
                }}
              >
                {rollingName}
              </Typography>
              <Typography color="text.secondary" fontSize={13} mt={2}>
                추첨 중...
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
              {pendingWinners.map((w, i) => (
                <Box
                  key={i}
                  sx={{
                    bgcolor: "#EEF2FF",
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  {w.participant_division && (
                    <Typography fontSize={12} color="text.secondary" fontWeight={700}>
                      {w.participant_division}
                    </Typography>
                  )}
                  <Typography fontSize={28} fontWeight={900} color="#2F80ED">
                    {w.participant_name}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        {animPhase === "result" && (
          <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleRedraw}
              disabled={isSavingWinner}
              sx={{ fontWeight: 700, flex: 1 }}
            >
              다시 추첨
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleSaveWinner}
              disabled={isSavingWinner}
              sx={{ fontWeight: 700, flex: 1 }}
            >
              {isSavingWinner ? "저장 중..." : "저장"}
            </Button>
          </DialogActions>
        )}
      </Dialog>
      {/* 자동 추첨 진행 및 결과 다이얼로그 */}
      <Dialog
        open={autoDrawOpen}
        onClose={autoDrawPhase === "result" ? () => setAutoDrawOpen(false) : undefined}
        maxWidth="xs"
        fullWidth
      >
        {autoDrawPhase === "spinning" ? (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>
              {prizeResults[autoPrizeIndex]?.prize_name ?? "자동 추첨"}
            </DialogTitle>
            <DialogContent sx={{ textAlign: "center" }}>
              <Box sx={{ py: 4 }}>
                <Typography
                  fontSize={38}
                  fontWeight={900}
                  sx={{
                    filter: "blur(2px)",
                    color: "primary.main",
                    letterSpacing: 1,
                    userSelect: "none",
                    minHeight: 52,
                  }}
                >
                  {autoRollingName}
                </Typography>
                <Typography color="text.secondary" fontSize={13} mt={2}>
                  추첨 중... ({autoPrizeIndex + 1}/{prizeResults.length})
                </Typography>
              </Box>
            </DialogContent>
          </>
        ) : (
          <>
            <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>자동 추첨 결과</DialogTitle>
            <DialogContent sx={{ pt: "8px !important" }}>
              <Stack spacing={1.5}>
                {prizeResults.map((prize, prizeIndex) => (
                  <Box key={prize.id}>
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                      <Chip label={`${prizeIndex + 1}`} size="small" sx={{ height: 22, minWidth: 28, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }} />
                      <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 900 }}>{prize.prize_name}</Typography>
                      <Chip label={`${prize.quantity}명`} size="small" sx={{ height: 22, fontWeight: 700 }} />
                    </Stack>
                    <Stack spacing={0.7}>
                      {prize.winners.length === 0 ? (
                        <Box sx={{ bgcolor: "#F9FAFB", borderRadius: 2, px: 2, py: 1.5, textAlign: "center" }}>
                          <Typography color="text.secondary" fontSize={13} fontWeight={700}>당첨자 없음 (참가자 부족)</Typography>
                        </Box>
                      ) : (
                        prize.winners.map((winner, winnerIndex) => (
                          <Box key={`${winner.participant_name}-${winnerIndex}`} sx={{ bgcolor: "#EEF2FF", borderRadius: 2, px: 2, py: 1.2, textAlign: "center" }}>
                            {winner.participant_division && winner.participant_division !== "-" && (
                              <Typography fontSize={12} color="text.secondary" fontWeight={700}>{winner.participant_division}</Typography>
                            )}
                            <Typography fontSize={24} fontWeight={900} color="#2F80ED">{winner.participant_name}</Typography>
                          </Box>
                        ))
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2, pt: 1.5, gap: 1 }}>
              <Button variant="outlined" onClick={handleRunDraw} sx={{ fontWeight: 700, flex: 1 }}>
                다시 추첨
              </Button>
              <Button variant="contained" disableElevation onClick={handleSaveAndReturn} sx={{ fontWeight: 700, flex: 1 }}>
                추첨 결과 저장
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      {/* 개별추첨 진행 다이얼로그 */}
      <Dialog
        open={dialogConfirmState.open}
        onClose={() => setDialogConfirmState({ open: false, prize: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>

        </DialogTitle>
        <DialogContent>
            <Typography>
                {dialogConfirmState.prize?.prize_name}({dialogConfirmState.prize?.quantity}명) 추첨을 시작하겠습니까?
            </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
                onClick={() => setDialogConfirmState({ open: false, prize: null })}
                sx={{ borderRadius: 1, px: 3, fontWeight: 700, color: "text.secondary" }}
            >
                취소
            </Button>
            <Button
                onClick={() => { if (!dialogConfirmState.prize) return;
                                  handleRunSingleDraw(dialogConfirmState.prize);
                                  setDialogConfirmState({ open: false, prize: null });
                                }}
            >
                확인
            </Button>
        </DialogActions>
      </Dialog>
      </>
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

      {canManage && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disableElevation
          onClick={() => {
            if (leagueId) sessionStorage.removeItem(`draw_prizes_${leagueId}`);
            setPrizes([]);
            setPrizeResults([]);
            setPendingPrizeName("");
            setPendingQuantity(1);
            setParticipantWeights({});
            setPhase("create");
          }}
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
              {canManage ? "경품 추첨을 생성해 보세요." : "경품 추첨 내역이 없습니다."}
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
              onClick={() => navigate(`/draw/${leagueId}?draftId=${draw.id}`)}
            >
              <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800} noWrap>
                      {draw.prize_names?.length > 0 ? `${draw.prize_names.join(", ")} 경품 추첨` : "경품 추첨"}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.3}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {formatDate(draw.start_date)}
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
