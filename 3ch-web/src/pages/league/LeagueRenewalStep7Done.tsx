import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Snackbar, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { resetRenewalLeagueCreation } from "../../features/league/leagueRenewalCreationSlice";
import {
  useDeleteLeagueProgramTemplateMutation,
  useSaveLeagueProgramTemplateMutation,
} from "../../features/league/leagueApi";
import type { RoundConfig } from "../../features/league/types/tournament.types";
import confettiImg from "../../assets/128_축포.png";

export default function LeagueRenewalStep7Done() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { createdLeagueId: leagueId, selectedProgram, rounds, compositionMode } = useAppSelector(
    (state) => state.leagueRenewalCreation,
  );
  const [saveTemplate, { isLoading: isSavingTemplate }] = useSaveLeagueProgramTemplateMutation();
  const [deleteTemplate, { isLoading: isDeletingTemplate }] = useDeleteLeagueProgramTemplateMutation();
  const [favoriteTemplateId, setFavoriteTemplateId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
      if (++count >= 8 && animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    }, 200);
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  const leavePage = (path: string) => {
    if (animationRef.current) clearInterval(animationRef.current);
    dispatch(resetRenewalLeagueCreation());
    navigate(path);
  };

  const handleAddFavorite = async () => {
    if (isSavingTemplate || isDeletingTemplate) return;
    if (favoriteTemplateId) {
      try {
        await deleteTemplate(favoriteTemplateId).unwrap();
        setFavoriteTemplateId(null);
      } catch {
        setSaveError(true);
      }
      return;
    }
    const completedRounds = rounds.every(
      (round) =>
        round.program &&
        round.format &&
        round.matchRule &&
        (round.program !== "TEAM" || round.teamPlayerCount),
    )
      ? rounds.map((round) => ({
          ...round,
          program: round.program!,
          format: round.format!,
          option: round.option ?? "NONE",
          matchRule: round.matchRule!,
          teamPlayerCount: round.teamPlayerCount ?? 4,
          teamMatchType: round.teamMatchType ?? "SSS",
        })) as RoundConfig[]
      : [];
    const templateRounds = selectedProgram?.rounds?.length ? selectedProgram.rounds : completedRounds;
    if (!templateRounds.length) {
      setSaveError(true);
      return;
    }
    try {
      const reusableRounds = templateRounds.map((round) => {
        const {
          groupSizes: _groupSizes,
          teamGroupSizes: _teamGroupSizes,
          groupShuffleSeed: _groupShuffleSeed,
          teamShuffleSeed: _teamShuffleSeed,
          groupAssignments: _groupAssignments,
          teamAssignments: _teamAssignments,
          doublesAssignments: _doublesAssignments,
          ...configuration
        } = round;
        return configuration;
      }) as RoundConfig[];
      const result = await saveTemplate({
        name: selectedProgram?.title ?? `${templateRounds.length}라운드 구성`,
        template_data: {
          sourceMode: compositionMode ?? "custom",
          sourceTitle: selectedProgram?.title,
          rounds: reusableRounds,
        },
      }).unwrap();
      setFavoriteTemplateId(result.template.id);
    } catch {
      setSaveError(true);
    }
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 32, fontWeight: 900, textAlign: "center", mt: 2, color: "#2F80ED" }}>
        리그 생성 완료
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: "center", mt: 1, color: "#6B7280" }}>
        이제 우리리그에서 리그를 진행할 수 있습니다!
      </Typography>
      <Box sx={{ mt: 3, width: "100%", height: 200, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box component="img" src={confettiImg} alt="축하" sx={{ width: 180, height: 180, objectFit: "contain" }} />
      </Box>
      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={() => leavePage(leagueId ? `/league/${leagueId}` : "/league")}
        sx={{ mt: 3, borderRadius: 1, height: 44, fontWeight: 900, bgcolor: "#2F80ED", "&:hover": { bgcolor: "#256FD1" } }}
      >
        리그 바로가기
      </Button>
      <Button
        fullWidth
        variant="outlined"
        onClick={() => leavePage("/league")}
        sx={{ mt: 1.5, borderRadius: 1, height: 44, fontWeight: 900 }}
      >
        메인으로
      </Button>

      <Box
        role="button"
        tabIndex={0}
        aria-pressed={Boolean(favoriteTemplateId)}
        aria-disabled={isSavingTemplate || isDeletingTemplate}
        onClick={() => void handleAddFavorite()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") void handleAddFavorite();
        }}
        sx={{
          mt: 4,
          mb: 2,
          py: 1,
          textAlign: "center",
          color: "#475569",
          fontSize: 14,
          fontWeight: 800,
          cursor: isSavingTemplate || isDeletingTemplate ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        <Box
          component="span"
          sx={{ mr: 0.5, color: favoriteTemplateId ? "#f59e0b" : "#94A3B8" }}
        >
          {favoriteTemplateId ? "★" : "☆"}
        </Box>
        리그 구성 즐겨찾기 추가
      </Box>

      <Snackbar
        open={saveError}
        onClose={() => setSaveError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setSaveError(false)}>
          리그 구성 즐겨찾기를 저장하지 못했습니다.
        </Alert>
      </Snackbar>
    </Box>
  );
}
