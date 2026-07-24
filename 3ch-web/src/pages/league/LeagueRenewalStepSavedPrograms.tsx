import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Radio,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { generateGroupOptions } from "../../features/league/algorithms/generateGroupOptions";
import { generateProgramBlocks } from "../../features/league/algorithms/generateProgramBlocks";
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

const roundDivisionLabel = (round: RoundConfig) => {
  if (round.format !== "TOURNAMENT") return optionLabel(round.option);
  const mode = round.tournamentMode === "upper-lower" ? "상·하위" : "일반";
  return optionLabel(round.option) ? `${optionLabel(round.option)}(${mode})` : mode;
};

const legacyTeamCounts = {
  SSS: { singles: 3, doubles: 0 },
  SDS: { singles: 2, doubles: 1 },
  DSD: { singles: 1, doubles: 2 },
  DDD: { singles: 0, doubles: 3 },
} as const;

const teamCounts = (round: RoundConfig) => {
  const legacy = legacyTeamCounts[round.teamMatchType] ?? legacyTeamCounts.SSS;
  return {
    singles: round.teamSinglesCount ?? legacy.singles,
    doubles: round.teamDoublesCount ?? legacy.doubles,
  };
};

const matchRuleLabel = (rule: RoundConfig["matchRule"]) =>
  ({
    BEST_OF_3: "3전 2선승제",
    BEST_OF_5: "5전 3선승제",
    THREE_SET: "3세트제",
  })[rule];

const durationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours > 0 ? `${hours}시간 ` : ""}${remainingMinutes}분`;
};

const averageMatchesPerPlayer = (
  blocks: ReturnType<typeof generateProgramBlocks>,
  playerCount: number,
) => {
  const appearances = blocks.reduce((sum, block) => {
    if (block.type === "DOUBLES") return sum + block.matchCount * 4;
    return sum + block.matchCount * 2;
  }, 0);
  return (appearances / Math.max(1, playerCount)).toFixed(1);
};

export default function LeagueRenewalStepSavedPrograms() {
  const dispatch = useAppDispatch();
  const basicInfo = useAppSelector((state) => state.leagueRenewalCreation.basicInfo);
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
        저장한 구성 불러오기
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
          const playerCount = Math.max(2, basicInfo?.participantCount ?? 2);
          const courtCount = Math.max(1, basicInfo?.courtCount ?? 1);
          const defaultGroupSizes = generateGroupOptions(playerCount)[0]?.groups ?? [playerCount];
          const previewBlocks = generateProgramBlocks(
            {
              singlesEnabled: template.template_data.rounds.some((round) => round.program === "SINGLES"),
              doublesEnabled: template.template_data.rounds.some((round) => round.program === "DOUBLES"),
              teamEnabled: template.template_data.rounds.some((round) => round.program === "TEAM"),
              teamMatchRounds: [],
              programOrder: template.template_data.rounds.map((round) => round.program),
              teamPlayerCount:
                template.template_data.rounds.find((round) => round.program === "TEAM")?.teamPlayerCount ?? 4,
              rounds: template.template_data.rounds,
            },
            playerCount,
            courtCount,
            defaultGroupSizes,
          );
          const totalMatchCount = previewBlocks.reduce((sum, block) => sum + block.matchCount, 0);
          const totalMinutes = previewBlocks.reduce((sum, block) => sum + block.expectedMinutes, 0);

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
                cursor: "pointer",
                border: selected ? "2px solid" : "1px solid",
                borderColor: selected ? "#2F80ED" : "#D9DDE6",
                borderRadius: 1.5,
                bgcolor: selected ? "#EFF6FF" : "#fff",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 4 }}>
                <Radio
                  checked={selected}
                  size="small"
                  sx={{ p: 0, color: "#9CA3AF", "&.Mui-checked": { color: "#2F80ED" } }}
                />
                <Typography aria-hidden sx={{ color: "#F59E0B", fontSize: 21, lineHeight: 1 }}>
                  ★
                </Typography>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 900 }}>
                  {template.name}
                </Typography>
              </Stack>
              <Stack spacing={0.25} sx={{ mt: 1.5, pl: 4.5 }}>
                <Typography sx={{ fontSize: 14 }}>- 총 경기수: {totalMatchCount}경기</Typography>
                <Typography sx={{ fontSize: 14 }}>
                  - 1인 평균 경기수: {averageMatchesPerPlayer(previewBlocks, playerCount)}경기
                </Typography>
                <Typography sx={{ fontSize: 14 }}>- 예상 소요시간: {durationLabel(totalMinutes)}</Typography>
              </Stack>
              <Stack spacing={3.5} sx={{ mt: 2.25, pl: 2.5 }}>
                {template.template_data.rounds.map((round, index) => {
                  const counts = round.program === "TEAM" ? teamCounts(round) : null;
                  const block = previewBlocks[index];
                  return (
                    <Box key={`${template.id}-${round.id}`}>
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                        <Typography sx={{ mr: 0.25, fontSize: 14, fontWeight: 900 }}>
                          {index + 1}라운드
                        </Typography>
                        {roundDivisionLabel(round) && (
                          <Chip label={roundDivisionLabel(round)} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                        )}
                        <Chip label={typeLabel(round.program)} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                        <Chip label={formatLabel(round.format)} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                      </Stack>
                      <Stack spacing={0.35} sx={{ mt: 1, pl: 1.5 }}>
                        <Typography sx={{ fontSize: 13, color: "#334155" }}>
                          경기방식: {matchRuleLabel(round.matchRule)}
                        </Typography>
                        {block && (
                          <>
                            <Typography sx={{ fontSize: 13, color: "#334155" }}>
                              경기수: {block.matchCount}경기
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "#334155" }}>
                              예상시간: {durationLabel(block.expectedMinutes)}
                            </Typography>
                          </>
                        )}
                        {round.program === "TEAM" && counts && (
                          <>
                            <Typography sx={{ fontSize: 13, color: "#334155" }}>
                              팀 인원: {round.teamPlayerCount}명
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "#334155" }}>
                              단체전 구성: 단식 {counts.singles}경기, 복식 {counts.doubles}경기
                            </Typography>
                          </>
                        )}
                        {round.format === "TOURNAMENT" && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            대진표: {round.tournamentBracketCount ?? 1}개 · 시드(순위)
                          </Typography>
                        )}
                        {round.option === "FINAL" && round.format === "LEAGUE" && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            본선 진출: 이전 라운드 상위 {round.advanceCount ?? 2}명
                          </Typography>
                        )}
                        {round.option === "FINAL" && round.format === "GROUP" && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            본선 편성: {round.finalAdvancementMode === "upper-lower-groups"
                              ? "상·하위부"
                              : round.finalAdvancementMode === "rank-groups"
                                ? "순위대로"
                                : `상위 ${round.advanceCount ?? 2}명`}
                          </Typography>
                        )}
                        {round.unitClubMode && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            {round.program === "TEAM" ? "팀 구성" : "복식 구성"}:{" "}
                            {round.unitClubMode === "same" ? "같은 클럽만" : "섞어서"}
                          </Typography>
                        )}
                        {round.crossClubGrouping && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            타클럽 편성: 예
                          </Typography>
                        )}
                        {round.crossClubOnlyMatches && (
                          <Typography sx={{ fontSize: 13, color: "#334155" }}>
                            타클럽만 매칭: 예
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
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
