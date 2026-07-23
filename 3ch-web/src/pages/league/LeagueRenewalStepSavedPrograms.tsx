import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Radio,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import {
  setRenewalCompositionMode,
  setRenewalConfiguration,
  setRenewalRounds,
  setRenewalSelectedProgram,
  setRenewalStep,
  type RenewalRoundConfig,
} from "../../features/league/leagueRenewalCreationSlice";
import {
  useDeleteLeagueProgramTemplateMutation,
  useGetLeagueProgramTemplatesQuery,
} from "../../features/league/leagueApi";
import type { RoundConfig } from "../../features/league/types/tournament.types";

const typeLabel = (program: RoundConfig["program"]) =>
  ({ SINGLES: "단식", DOUBLES: "복식", TEAM: "단체전" })[program];

const formatLabel = (format: RoundConfig["format"]) =>
  ({ LEAGUE: "단일리그", GROUP: "조별리그", TOURNAMENT: "토너먼트" })[format];

const optionLabel = (option: RoundConfig["option"]) =>
  ({ NONE: "", PRELIM: "예선", FINAL: "본선", UPPER: "상위", LOWER: "하위" })[option];

export default function LeagueRenewalStepSavedPrograms() {
  const dispatch = useAppDispatch();
  const { data, isLoading, isError } = useGetLeagueProgramTemplatesQuery();
  const [deleteTemplate] = useDeleteLeagueProgramTemplateMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTemplate = data?.templates.find((template) => template.id === selectedId);

  const handleComplete = () => {
    if (!selectedTemplate) return;
    dispatch(setRenewalCompositionMode("custom"));
    dispatch(setRenewalSelectedProgram(null));
    dispatch(setRenewalConfiguration({ format: "event-program", rule: null }));
    dispatch(setRenewalRounds(selectedTemplate.template_data.rounds as RenewalRoundConfig[]));
    dispatch(setRenewalStep(7));
  };

  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 4 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>
        리그 구성 불러오기
      </Typography>

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress size={34} />
        </Stack>
      )}
      {isError && <Alert severity="error">저장된 리그 구성을 불러오지 못했습니다.</Alert>}
      {!isLoading && !isError && data?.templates.length === 0 && (
        <Box
          sx={{
            py: 7,
            px: 2,
            textAlign: "center",
            border: "1px dashed #D9DDE6",
            borderRadius: 1,
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>저장된 리그 구성이 없습니다.</Typography>
          <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}>
            리그 생성 완료 화면에서 자주 사용하는 구성을 즐겨찾기에 추가할 수 있습니다.
          </Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {data?.templates.map((template) => {
          const selected = selectedId === template.id;
          return (
            <Box
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(template.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setSelectedId(template.id);
              }}
              sx={{
                position: "relative",
                p: 2,
                pr: 5,
                cursor: "pointer",
                border: "1px solid",
                borderColor: selected ? "#2F80ED" : "#D9DDE6",
                borderRadius: 1,
                bgcolor: selected ? "#EFF6FF" : "#fff",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Radio checked={selected} size="small" sx={{ p: 0 }} />
                <Typography sx={{ fontWeight: 900 }}>{template.name}</Typography>
              </Stack>
              <Stack spacing={0.5} sx={{ mt: 1.25, pl: 3.5 }}>
                {template.template_data.rounds.map((round, index) => (
                  <Typography key={`${template.id}-${round.id}`} sx={{ fontSize: 13, color: "#475569" }}>
                    {index + 1}라운드{" "}
                    {[optionLabel(round.option), typeLabel(round.program), formatLabel(round.format)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                ))}
              </Stack>
              <IconButton
                size="small"
                aria-label="즐겨찾기 삭제"
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteTemplate(template.id);
                  if (selectedId === template.id) setSelectedId(null);
                }}
                sx={{ position: "absolute", top: 8, right: 8, color: "#EF4444" }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={() => dispatch(setRenewalStep(2))}
          sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}
        >
          이전
        </Button>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          disabled={!selectedTemplate}
          onClick={handleComplete}
          sx={{
            height: 44,
            borderRadius: 1,
            fontWeight: 900,
            bgcolor: "#2F80ED",
            "&:hover": { bgcolor: "#256FD1" },
            "&.Mui-disabled": { bgcolor: "#CFE1FB", color: "#fff" },
          }}
        >
          완료
        </Button>
      </Stack>
    </Box>
  );
}
