import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  setRenewalRounds,
  setRenewalStep,
  type RenewalRoundConfig,
} from "../../features/league/leagueRenewalCreationSlice";
import type {
  FinalAdvancementMode,
  RoundFormat,
  RoundOption,
  TournamentMode,
} from "../../features/league/types/tournament.types";

type StepKind = "type" | "format" | "rule";

const labels = { type: "유형", format: "방식", rule: "규칙" } as const;
const previousSteps = { type: 2, format: 4, rule: 5 } as const;
const nextSteps = { type: 5, format: 6, rule: 7 } as const;
const optionCardSx = {
  m: 0,
  px: 2,
  minHeight: 66,
  border: "1px solid #D9DDE6",
  borderRadius: 1,
  bgcolor: "#fff",
  boxShadow: "0 2px 2px rgba(0,0,0,0.18)",
  "& .MuiFormControlLabel-label": { fontSize: 20, fontWeight: 800 },
};

const descriptionSx = {
  mt: 1,
  color: "#64748B",
  fontSize: 13,
  lineHeight: 1.55,
};

const newRound = (id: number): RenewalRoundConfig => ({
  id,
  expanded: true,
  program: null,
  format: null,
  option: null,
  matchRule: null,
  teamPlayerCount: null,
  teamMatchType: null,
  tournamentSeeding: "seed",
  tournamentBracketCount: 1,
  tournamentMode: "single",
  finalAdvancementMode: "top-n",
  advanceCount: 2,
  sourceRoundId: id > 1 ? id - 1 : undefined,
});

const parseTournamentChoice = (
  value: string,
): { option: RoundOption; tournamentMode: TournamentMode } => {
  const [option, mode] = value.split(":");
  return {
    option: option as RoundOption,
    tournamentMode: mode as TournamentMode,
  };
};

function AdvancementCount({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
      <Typography sx={{ fontWeight: 900 }}>상위</Typography>
      <TextField
        type="number"
        value={value}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
        inputProps={{ min: 1, inputMode: "numeric" }}
        size="small"
        sx={{ width: 92 }}
      />
      <Typography sx={{ fontWeight: 900 }}>명</Typography>
    </Stack>
  );
}

export default function LeagueRenewalRoundStep({ kind }: { kind: StepKind }) {
  const dispatch = useAppDispatch();
  const rounds = useAppSelector((state) => state.leagueRenewalCreation.rounds);
  const hasParticipatingClubs = useAppSelector(
    (state) => state.leagueRenewalCreation.invitedGroupIds.length > 0,
  );

  const setRounds = (nextRounds: RenewalRoundConfig[]) =>
    dispatch(setRenewalRounds(nextRounds));
  const updateRound = (index: number, patch: Partial<RenewalRoundConfig>) =>
    setRounds(
      rounds.map((round, roundIndex) =>
        roundIndex === index ? { ...round, ...patch } : round,
      ),
    );

  const removeRound = (index: number) => {
    const nextRounds = rounds
      .filter((_, roundIndex) => roundIndex !== index)
      .map((round, roundIndex, remaining) => ({
        ...round,
        id: roundIndex + 1,
        option:
          remaining.length === 1
            ? ("NONE" as const)
            : roundIndex === 0
              ? ("PRELIM" as const)
              : round.option,
        sourceRoundId: roundIndex > 0 ? roundIndex : undefined,
      }));
    setRounds(nextRounds);
  };

  const addRound = () => {
    const nextRounds = rounds.map((round, index) => ({
      ...round,
      option: index === 0 ? ("PRELIM" as const) : round.option,
    }));
    setRounds([...nextRounds, newRound(rounds.length + 1)]);
  };

  const updateFormat = (index: number, format: RoundFormat) => {
    const multipleRounds = rounds.length > 1;
    updateRound(index, {
      format,
      option: multipleRounds ? (index === 0 ? "PRELIM" : "PRELIM") : "NONE",
      tournamentMode: format === "TOURNAMENT" ? "single" : undefined,
      tournamentSeeding: "seed",
      tournamentBracketCount:
        format === "TOURNAMENT" ? rounds[index].tournamentBracketCount ?? 1 : 1,
      finalAdvancementMode: "top-n",
      advanceCount: rounds[index].advanceCount ?? 2,
      sourceRoundId: index > 0 ? rounds[index - 1].id : undefined,
    });
  };

  const canNext = rounds.every((round) => {
    if (kind === "type") {
      return Boolean(round.program) && (round.program !== "TEAM" || Boolean(round.teamPlayerCount));
    }
    if (kind === "format") return Boolean(round.format);
    return Boolean(round.matchRule);
  });

  const renderRoundDivision = (round: RenewalRoundConfig, index: number) => {
    if (!round.format) return null;
    const multipleRounds = rounds.length > 1;

    if (!multipleRounds && round.format !== "TOURNAMENT") {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography>
          <TextField fullWidth disabled value="해당 없음" size="small" />
        </Box>
      );
    }

    if (!multipleRounds && round.format === "TOURNAMENT") {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography>
          <TextField
            select
            fullWidth
            size="small"
            value={round.tournamentMode ?? "single"}
            onChange={(event) =>
              updateRound(index, {
                option: "NONE",
                tournamentMode: event.target.value as TournamentMode,
              })
            }
          >
            <MenuItem value="single">일반</MenuItem>
            <MenuItem value="upper-lower">상·하위</MenuItem>
          </TextField>
          <Typography sx={descriptionSx}>
            {round.tournamentMode === "upper-lower"
              ? "첫 경기에서 이기면 상위부로, 지면 하위부로 진출하는 토너먼트입니다."
              : "경기에서 이긴 참가자가 다음 단계로 진출하는 일반적인 토너먼트입니다."}
          </Typography>
        </Box>
      );
    }

    if (index === 0 && round.format !== "TOURNAMENT") {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography>
          <TextField fullWidth disabled value="예선" size="small" />
        </Box>
      );
    }

    if (round.format === "TOURNAMENT") {
      const value = `${round.option ?? "PRELIM"}:${round.tournamentMode ?? "single"}`;
      return (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography>
          <TextField
            select
            fullWidth
            value={value}
            onChange={(event) => updateRound(index, parseTournamentChoice(event.target.value))}
            size="small"
          >
            <MenuItem value="PRELIM:single">예선(일반)</MenuItem>
            {index > 0 && <MenuItem value="FINAL:single">본선(일반)</MenuItem>}
            <MenuItem value="PRELIM:upper-lower">예선(상·하위)</MenuItem>
            {index > 0 && <MenuItem value="FINAL:upper-lower">본선(상·하위)</MenuItem>}
          </TextField>
          <Typography sx={descriptionSx}>
            {round.tournamentMode === "upper-lower"
              ? "첫 경기에서 이기면 상위부로, 지면 하위부로 진출하는 토너먼트입니다."
              : "경기에서 이긴 참가자가 다음 단계로 진출하는 일반적인 토너먼트입니다."}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>라운드 구분</Typography>
        <TextField
          select
          fullWidth
          value={round.option ?? "PRELIM"}
          onChange={(event) =>
            updateRound(index, {
              option: event.target.value as RoundOption,
              sourceRoundId: index > 0 ? rounds[index - 1].id : undefined,
              finalAdvancementMode: round.finalAdvancementMode ?? "top-n",
              advanceCount: round.advanceCount ?? 2,
            })
          }
          size="small"
        >
          <MenuItem value="PRELIM">예선</MenuItem>
          <MenuItem value="FINAL">본선</MenuItem>
        </TextField>
      </Box>
    );
  };

  const renderFinalOptions = (round: RenewalRoundConfig, index: number) => {
    if (index === 0 || round.option !== "FINAL") return null;

    if (round.format === "LEAGUE") {
      return (
        <>
          <AdvancementCount
            value={round.advanceCount ?? 2}
            onChange={(advanceCount) =>
              updateRound(index, {
                advanceCount,
                finalAdvancementMode: "top-n",
                sourceRoundId: rounds[index - 1].id,
              })
            }
          />
          <Typography sx={descriptionSx}>
            예선 순위 결과에 따라 상위 순위권 참가자만 본선 라운드를 진행합니다.
          </Typography>
        </>
      );
    }

    if (round.format === "GROUP") {
      const mode = round.finalAdvancementMode ?? "top-n";
      return (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>본선 편성</Typography>
          <TextField
            select
            fullWidth
            size="small"
            value={mode}
            onChange={(event) =>
              updateRound(index, {
                finalAdvancementMode: event.target.value as FinalAdvancementMode,
                advanceCount: round.advanceCount ?? 2,
                sourceRoundId: rounds[index - 1].id,
              })
            }
          >
            <MenuItem value="top-n">상위 인원</MenuItem>
            <MenuItem value="upper-lower-groups">상·하위부</MenuItem>
            <MenuItem value="rank-groups">순위대로</MenuItem>
          </TextField>
          {mode === "top-n" && (
            <AdvancementCount
              value={round.advanceCount ?? 2}
              onChange={(advanceCount) => updateRound(index, { advanceCount })}
            />
          )}
          <Typography sx={descriptionSx}>
            {mode === "upper-lower-groups"
              ? "예선 순위 결과에 따라 상위부와 하위부로 나누어 본선 라운드를 진행합니다."
              : mode === "rank-groups"
                ? "예선 순위 결과에 따라 같은 순위끼리 각 순위조에 배정하여 본선 라운드를 진행합니다."
                : "예선 순위 결과에 따라 상위 순위권 참가자만 본선 라운드를 진행합니다."}
          </Typography>
        </Box>
      );
    }

    return null;
  };

  const renderOptions = (round: RenewalRoundConfig, index: number) => {
    if (kind === "type") {
      return (
        <>
          <FormControl fullWidth>
            <RadioGroup
              value={round.program ?? ""}
              onChange={(event) =>
                updateRound(index, {
                  program: event.target.value as NonNullable<RenewalRoundConfig["program"]>,
                })
              }
            >
              <Stack spacing={1.5}>
                <FormControlLabel value="SINGLES" control={<Radio />} label="단식" sx={optionCardSx} />
                <FormControlLabel value="DOUBLES" control={<Radio />} label="복식" sx={optionCardSx} />
                <FormControlLabel value="TEAM" control={<Radio />} label="단체전" sx={optionCardSx} />
              </Stack>
            </RadioGroup>
          </FormControl>
          {round.program === "TEAM" && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>팀 인원 수</Typography>
              <TextField
                select
                fullWidth
                value={round.teamPlayerCount ?? ""}
                onChange={(event) => updateRound(index, { teamPlayerCount: Number(event.target.value) })}
                size="small"
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (value) =>
                    value === "" ? (
                      <Box component="span" sx={{ color: "#B0B7C3" }}>선택</Box>
                    ) : `${value}명`,
                }}
              >
                <MenuItem value="" disabled>선택</MenuItem>
                {[2, 3, 4, 5].map((count) => (
                  <MenuItem key={count} value={count}>{count}명</MenuItem>
                ))}
              </TextField>
            </Box>
          )}
          {hasParticipatingClubs && (round.program === "DOUBLES" || round.program === "TEAM") && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>
                {round.program === "TEAM" ? "팀 구성" : "복식 구성"}
              </Typography>
              <RadioGroup
                row
                value={round.unitClubMode ?? "mixed"}
                onChange={(event) =>
                  updateRound(index, {
                    unitClubMode: event.target.value as "same" | "mixed",
                    teamAssignments: undefined,
                    doublesAssignments: undefined,
                    groupAssignments: undefined,
                  })
                }
              >
                <FormControlLabel value="same" control={<Radio />} label="같은 클럽만" />
                <FormControlLabel value="mixed" control={<Radio />} label="섞어서" />
              </RadioGroup>
            </Box>
          )}
        </>
      );
    }

    if (kind === "format") {
      return (
        <>
          <FormControl fullWidth>
            <RadioGroup
              value={round.format ?? ""}
              onChange={(event) => updateFormat(index, event.target.value as RoundFormat)}
            >
              <Stack spacing={1.5}>
                <FormControlLabel value="LEAGUE" control={<Radio />} label="단일리그" sx={optionCardSx} />
                <FormControlLabel value="GROUP" control={<Radio />} label="조별리그" sx={optionCardSx} />
                <FormControlLabel value="TOURNAMENT" control={<Radio />} label="토너먼트" sx={optionCardSx} />
              </Stack>
            </RadioGroup>
          </FormControl>

          {renderRoundDivision(round, index)}
          {renderFinalOptions(round, index)}

          {round.format === "TOURNAMENT" &&
            round.option === "FINAL" &&
            index > 0 &&
            rounds[index - 1]?.format === "GROUP" &&
            rounds[index - 1]?.option === "PRELIM" && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>대진표 개수</Typography>
                <TextField
                  select
                  fullWidth
                  value={round.tournamentBracketCount ?? 1}
                  onChange={(event) =>
                    updateRound(index, { tournamentBracketCount: Number(event.target.value) })
                  }
                  size="small"
                >
                  {Array.from({ length: 8 }, (_, optionIndex) => optionIndex + 1).map((count) => (
                    <MenuItem key={count} value={count}>{count}개</MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

          {hasParticipatingClubs && round.format !== "LEAGUE" && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>타클럽 편성</Typography>
              <RadioGroup
                row
                value={round.crossClubGrouping ? "yes" : "no"}
                onChange={(event) =>
                  updateRound(index, {
                    crossClubGrouping: event.target.value === "yes",
                    crossClubOnlyMatches:
                      event.target.value === "yes" ? round.crossClubOnlyMatches : false,
                  })
                }
              >
                <FormControlLabel value="yes" control={<Radio />} label="예" />
                <FormControlLabel value="no" control={<Radio />} label="아니오" />
              </RadioGroup>
            </Box>
          )}
          {hasParticipatingClubs &&
            round.format !== "TOURNAMENT" &&
            (round.program === "SINGLES" || round.unitClubMode === "same") &&
            (round.format === "LEAGUE" || round.crossClubGrouping) && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>타클럽만 매칭</Typography>
                <RadioGroup
                  row
                  value={round.crossClubOnlyMatches ? "yes" : "no"}
                  onChange={(event) =>
                    updateRound(index, { crossClubOnlyMatches: event.target.value === "yes" })
                  }
                >
                  <FormControlLabel value="yes" control={<Radio />} label="예" />
                  <FormControlLabel value="no" control={<Radio />} label="아니오" />
                </RadioGroup>
              </Box>
            )}
        </>
      );
    }

    return (
      <FormControl fullWidth>
        <RadioGroup
          value={round.matchRule ?? ""}
          onChange={(event) =>
            updateRound(index, {
              matchRule: event.target.value as NonNullable<RenewalRoundConfig["matchRule"]>,
            })
          }
        >
          <Stack spacing={1.5}>
            <FormControlLabel value="BEST_OF_3" control={<Radio />} label="3전 2선승제" sx={optionCardSx} />
            <FormControlLabel value="BEST_OF_5" control={<Radio />} label="5전 3선승제" sx={optionCardSx} />
            <FormControlLabel value="THREE_SET" control={<Radio />} label="3세트제" sx={optionCardSx} />
          </Stack>
        </RadioGroup>
      </FormControl>
    );
  };

  return (
    <Box sx={{ px: 2.5, pt: 2 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900, mb: 2 }}>리그 {labels[kind]}</Typography>
      <Stack spacing={3}>
        {rounds.map((round, index) => (
          <Box key={round.id}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 900 }}>{index + 1}라운드</Typography>
              {kind === "type" && rounds.length > 1 && (
                <Button size="small" color="error" variant="outlined" onClick={() => removeRound(index)}>
                  삭제
                </Button>
              )}
            </Stack>
            {renderOptions(round, index)}
          </Box>
        ))}
      </Stack>
      {kind === "type" && (
        <Button
          fullWidth
          variant="outlined"
          onClick={addRound}
          sx={{ mt: 2.5, height: 40, borderRadius: 1, fontWeight: 800 }}
        >
          + 라운드 추가
        </Button>
      )}
      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={() => dispatch(setRenewalStep(previousSteps[kind]))}
          sx={{ height: 44, borderRadius: 1, fontWeight: 900, bgcolor: "#777", "&:hover": { bgcolor: "#777" } }}
        >
          이전
        </Button>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          disabled={!canNext}
          onClick={() => dispatch(setRenewalStep(nextSteps[kind]))}
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
    </Box>
  );
}
