import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setRenewalCompositionMode,
  setRenewalStep,
} from "../../features/league/leagueRenewalCreationSlice";

type CompositionChoice = "recommend" | "custom" | "saved";

const choices: Array<{
  value: CompositionChoice;
  title: string;
  description: string;
}> = [
  {
    value: "recommend",
    title: "추천 프로그램",
    description: "AI가 자동으로 만들어주는 프로그램을 선택하여 리그를 생성할 수 있습니다.",
  },
  {
    value: "custom",
    title: "직접 구성하기",
    description: "리그 유형, 방식, 옵션 등을 라운드별로 직접 선택하여 리그를 생성할 수 있습니다.",
  },
  {
    value: "saved",
    title: "저장한 구성 불러오기",
    description: "즐겨찾기에 저장한 리그 구성을 불러와 빠르게 생성할 수 있습니다.",
  },
];

export default function LeagueRenewalStep2Composition() {
  const dispatch = useAppDispatch();
  const basicInfo = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
  const [mode, setMode] = useState<CompositionChoice | "">("");
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);

  const handleNext = async () => {
    if (!mode) return;
    if (
      mode === "recommend" &&
      (!basicInfo?.endTime || !basicInfo.participantCount || !basicInfo.courtCount)
    ) {
      setRequirementDialogOpen(true);
      return;
    }
    if (mode === "saved") {
      dispatch(setRenewalStep(10));
      return;
    }
    dispatch(setRenewalCompositionMode(mode));
    if (mode === "recommend") {
      setAnalysisStage(0);
      setAnalysisDialogOpen(true);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      setAnalysisStage(1);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      setAnalysisStage(2);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    dispatch(setRenewalStep(mode === "recommend" ? 3 : 4));
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 구성</Typography>
      <FormControl fullWidth>
        <RadioGroup
          value={mode}
          onChange={(event) => setMode(event.target.value as CompositionChoice)}
        >
          <Stack spacing={1.5}>
            {choices.map((choice) => (
              <FormControlLabel
                key={choice.value}
                value={choice.value}
                control={<Radio />}
                label={
                  <Box>
                    <Typography fontWeight={900}>{choice.title}</Typography>
                    <Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 14 }}>
                      {choice.description}
                    </Typography>
                  </Box>
                }
                sx={{
                  m: 0,
                  minHeight: 104,
                  px: 2,
                  border: "1px solid",
                  borderColor: mode === choice.value ? "#2F80ED" : "#D9DDE6",
                  borderRadius: 1,
                  bgcolor: mode === choice.value ? "#EFF6FF" : "#fff",
                }}
              />
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={() => dispatch(setRenewalStep(1))}
          sx={{
            height: 44,
            borderRadius: 1,
            fontWeight: 900,
            bgcolor: "#777",
            "&:hover": { bgcolor: "#777" },
          }}
        >
          이전
        </Button>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          disabled={!mode}
          onClick={handleNext}
          sx={{
            height: 44,
            borderRadius: 1,
            fontWeight: 900,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
          }}
        >
          다음
        </Button>
      </Stack>

      <Dialog
        open={requirementDialogOpen}
        onClose={() => setRequirementDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>추천 프로그램</DialogTitle>
        <DialogContent>
          <Typography>
            추천 프로그램 생성을 위해 종료시간, 참가자 수, 코트 수를 모두 선택해주세요.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequirementDialogOpen(false)} sx={{ fontWeight: 700 }}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={analysisDialogOpen}
        fullWidth
        maxWidth="xs"
        disableEscapeKeyDown
        slotProps={{ paper: { sx: { mx: 2.5, borderRadius: 3, overflow: "hidden" } } }}
      >
        <DialogContent sx={{ px: 3, py: 3.5, textAlign: "center" }}>
          <Box sx={{ width: 58, height: 58, mx: "auto", mb: 2, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#EFF6FF", color: "#2F80ED" }}>
            <AutoAwesomeIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
            AI가 리그 운영안을 만들고 있어요
          </Typography>
          <Typography sx={{ mt: 1, minHeight: 42, fontSize: 13, lineHeight: 1.6, color: "#64748B" }}>
            {[
              "참가자 수와 코트 운영 조건을 분석하고 있어요.",
              "경기 수와 라운드 구성을 꼼꼼하게 비교하고 있어요.",
              "대관시간에 맞는 세 가지 추천안을 정리하고 있어요.",
            ][analysisStage]}
          </Typography>
          <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 999, bgcolor: "#DBEAFE", "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: "#2F80ED" } }} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
