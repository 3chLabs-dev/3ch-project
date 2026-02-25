import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
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
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import confetti from "canvas-confetti";
import { useGetDrawDetailQuery, useDrawPrizeWinnersMutation } from "../../features/draw/drawApi";
import type { DrawPrizeItem } from "../../features/draw/drawApi";
import {
  useGetLeagueQuery,
  useGetLeagueParticipantsQuery,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";

// Animation delay steps (ms): fast → slow
const ANIM_STEPS = [50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,80,110,150,200,280,400,600];

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}(${wd}) ${h}:${min}`;
}

type PendingWinner = { participant_name: string; participant_division: string | null };

export default function DrawDetail() {
  const { leagueId, drawId } = useParams<{ leagueId: string; drawId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useGetDrawDetailQuery(
    { leagueId: leagueId ?? "", drawId: drawId ?? "" },
    { skip: !leagueId || !drawId },
  );

  const { data: leagueData } = useGetLeagueQuery(leagueId ?? "", { skip: !leagueId });
  const league = leagueData?.league;
  const { data: groupData } = useGetGroupDetailQuery(
    league?.group_id ?? "",
    { skip: !league?.group_id },
  );
  const canManage = groupData?.myRole === "owner" || groupData?.myRole === "admin";

  const myName = useAppSelector((s) => s.auth.user?.name ?? null);

  const { data: participantsData } = useGetLeagueParticipantsQuery(leagueId ?? "", {
    skip: !leagueId || !canManage,
  });

  const [drawPrizeWinners] = useDrawPrizeWinnersMutation();

  // Animation state
  const [drawingPrize, setDrawingPrize] = useState<DrawPrizeItem | null>(null);
  const [animPhase, setAnimPhase] = useState<"spinning" | "result">("spinning");
  const [rollingName, setRollingName] = useState("");
  const [pendingWinners, setPendingWinners] = useState<PendingWinner[]>([]);
  const [isSavingWinner, setIsSavingWinner] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current !== null) clearTimeout(animTimerRef.current);
    };
  }, []);

  function clearAnimTimer() {
    if (animTimerRef.current !== null) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }

  function getEligiblePool(targetPrizeId: string) {
    const participants = participantsData?.participants ?? [];
    const otherWinnerNames = new Set<string>();
    (data?.prizes ?? []).forEach((p) => {
      if (p.id !== targetPrizeId) {
        p.winners.forEach((w) => otherWinnerNames.add(w.participant_name));
      }
    });
    return participants.filter((p) => !otherWinnerNames.has(p.name));
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
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }, 50);
        return;
      }
      setRollingName(names[Math.floor(Math.random() * names.length)]);
      animTimerRef.current = setTimeout(tick, ANIM_STEPS[stepIdx++]);
    }

    tick();
  }

  function handleDrawPrize(prize: DrawPrizeItem) {
    const pool = getEligiblePool(prize.id);
    if (pool.length === 0) {
      setAlertMsg("추첨 가능한 참가자가 없습니다.");
      return;
    }
    if (pool.length < prize.quantity) {
      setAlertMsg(`참가자(${pool.length}명)가 당첨자 수(${prize.quantity}명)보다 적습니다.`);
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected: PendingWinner[] = shuffled.slice(0, prize.quantity).map((p) => ({
      participant_name: p.name,
      participant_division: p.division ?? null,
    }));
    setDrawingPrize(prize);
    setPendingWinners(selected);
    runAnimation(pool, selected);
  }

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

  async function handleSaveWinner() {
    if (!drawingPrize || !leagueId || !drawId) return;
    setIsSavingWinner(true);
    try {
      await drawPrizeWinners({
        leagueId,
        drawId,
        prizeId: drawingPrize.id,
        winners: pendingWinners,
      }).unwrap();
      handleCloseDialog();
    } catch {
      setAlertMsg("저장 중 오류가 발생했습니다.");
      setIsSavingWinner(false);
    }
  }

  function handleCloseDialog() {
    clearAnimTimer();
    setDrawingPrize(null);
    setAnimPhase("spinning");
    setRollingName("");
    setPendingWinners([]);
    setIsSavingWinner(false);
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Stack spacing={2} sx={{ pt: 4, textAlign: "center" }}>
        <Typography color="error" fontWeight={700}>추첨 정보를 불러올 수 없습니다.</Typography>
      </Stack>
    );
  }

  const { draw, prizes } = data;
  const isDrawPending = prizes.length > 0 && prizes.every((p) => !p.winners || p.winners.length === 0);

  return (
    <>
      <Stack spacing={2.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate(`/draw/${leagueId}`, { replace: true })} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} fontSize={20} noWrap>{draw.name}</Typography>
            <Stack direction="row" alignItems="center" spacing={1} mt={0.2}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {formatDate(draw.created_at)}
              </Typography>
              {isDrawPending && (
                <Chip
                  label="추첨 대기 중"
                  size="small"
                  sx={{ height: 18, fontWeight: 700, bgcolor: "#FFF7E6", color: "#F59E0B", fontSize: 11 }}
                />
              )}
            </Stack>
          </Box>
        </Stack>

        {canManage && isDrawPending && (
          <Button
            variant="outlined"
            disableElevation
            onClick={() => navigate(`/draw/${leagueId}?draftId=${draw.id}`)}
            sx={{ borderRadius: 1, fontWeight: 700, alignSelf: "flex-start" }}
          >
            일괄 자동 추첨
          </Button>
        )}

        {prizes.length === 0 ? (
          <Card elevation={2} sx={{ borderRadius: 1 }}>
            <CardContent sx={{ py: 3, textAlign: "center", "&:last-child": { pb: 3 } }}>
              <Typography color="text.secondary" fontWeight={700}>경품이 없습니다.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {prizes.map((prize, idx) => (
              <Card key={prize.id} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ py: 1.5, px: 1.8, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Chip
                      label={`${idx + 1}`}
                      size="small"
                      sx={{ height: 22, fontWeight: 800, bgcolor: "#EEF2FF", color: "#2F80ED" }}
                    />
                    <Typography fontWeight={900} fontSize={15} sx={{ flex: 1 }}>
                      {prize.prize_name}
                    </Typography>
                    <Chip
                      label={`${prize.quantity}명`}
                      size="small"
                      sx={{ height: 22, fontWeight: 700 }}
                    />
                    {canManage && (
                      <Button
                        variant={prize.winners.length > 0 ? "outlined" : "contained"}
                        size="small"
                        disableElevation
                        onClick={() => handleDrawPrize(prize)}
                        sx={{ borderRadius: 1, fontWeight: 700, minWidth: 56, height: 28, fontSize: 12 }}
                      >
                        {prize.winners.length > 0 ? "재추첨" : "추첨"}
                      </Button>
                    )}
                  </Stack>

                  <Divider sx={{ mb: 1 }} />

                  {!prize.winners || prize.winners.length === 0 ? (
                    <Typography color="text.secondary" fontSize={13} fontWeight={700}>
                      {isDrawPending ? "추첨 예정" : "당첨자 없음"}
                    </Typography>
                  ) : (
                    <Stack spacing={0.7}>
                      {prize.winners.map((w, wi) => {
                        const isMe = !!myName && w.participant_name === myName;
                        return (
                        <Stack key={w.id} direction="row" alignItems="center" spacing={1}
                          sx={isMe ? { bgcolor: "#EEF2FF", borderRadius: 1, px: 0.8, mx: -0.8 } : undefined}
                        >
                          <Chip
                            label={`${wi + 1}`}
                            size="small"
                            sx={{ height: 22, fontWeight: 800, minWidth: 28, ...(isMe && { bgcolor: "#2F80ED", color: "#fff" }) }}
                          />
                          {w.participant_division && (
                            <Chip
                              label={w.participant_division}
                              size="small"
                              sx={{ height: 22, fontWeight: 700 }}
                            />
                          )}
                          <Typography fontWeight={800} fontSize={15} color={isMe ? "#2F80ED" : undefined}>
                            {w.participant_name}
                          </Typography>
                        </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

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

      <Snackbar
        open={!!alertMsg}
        autoHideDuration={3000}
        onClose={() => setAlertMsg(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setAlertMsg(null)} sx={{ fontWeight: 700 }}>
          {alertMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
