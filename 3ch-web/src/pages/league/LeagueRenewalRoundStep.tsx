import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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
  thirdPlaceMatch: true,
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
  prefix = "상위",
}: {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
      <Typography sx={{ fontWeight: 900 }}>{prefix}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <IconButton
          aria-label="본선 진출 인원 감소"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          sx={{ width: 36, height: 36, border: "1px solid #D9DDE6", fontSize: 22 }}
        >
          −
        </IconButton>
        <TextField
          type="text"
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            if (event.target.value === "") return;
            onChange(Math.min(99, Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1)));
          }}
          inputProps={{
            inputMode: "numeric",
            "aria-label": "본선 진출 인원",
          }}
          size="small"
          sx={{
            width: 48,
            "& .MuiInputBase-root": { height: 36 },
            "& input": {
              p: 0,
              textAlign: "center",
              fontWeight: 900,
              MozAppearance: "textfield",
            },
            "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
              m: 0,
              WebkitAppearance: "none",
            },
          }}
        />
        <IconButton
          aria-label="본선 진출 인원 증가"
          onClick={() => onChange(value + 1)}
          sx={{ width: 36, height: 36, border: "1px solid #D9DDE6", color: "#1976D2", fontSize: 22 }}
        >
          +
        </IconButton>
      </Stack>
      <Typography sx={{ fontWeight: 900 }}>명</Typography>
    </Stack>
  );
}

function CompactNumberStepper({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {label && <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{label}</Typography>}
      <IconButton
        aria-label={`${label ?? suffix} 감소`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        sx={{ width: 40, height: 40, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 22 }}
      >
        −
      </IconButton>
      <TextField
        type="text"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          if (event.target.value === "") return;
          onChange(Math.min(max, Math.max(min, Number(event.target.value.replace(/\D/g, "")) || min)));
        }}
        inputProps={{
          inputMode: "numeric",
          "aria-label": label ?? suffix,
        }}
        size="small"
        sx={{
          width: 52,
          "& .MuiInputBase-root": { height: 40, borderRadius: 1 },
          "& input": {
            p: 0,
            textAlign: "center",
            fontWeight: 900,
            MozAppearance: "textfield",
          },
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
            m: 0,
            WebkitAppearance: "none",
          },
        }}
      />
      <IconButton
        aria-label={`${label ?? suffix} 증가`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        sx={{ width: 40, height: 40, border: "1px solid #90CAF9", color: "#1976D2", fontSize: 22 }}
      >
        +
      </IconButton>
      <Typography sx={{ width: 28, flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
        {suffix}
      </Typography>
    </Stack>
  );
}

export default function LeagueRenewalRoundStep({ kind }: { kind: StepKind }) {
  const dispatch = useAppDispatch();
  const rounds = useAppSelector((state) => state.leagueRenewalCreation.rounds);
  const hasParticipatingClubs = useAppSelector(
    (state) => state.leagueRenewalCreation.invitedGroupIds.length > 0,
  );
  const participantCount = useAppSelector(
    (state) => state.leagueRenewalCreation.basicInfo?.participantCount ?? null,
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
      thirdPlaceMatch: format === "TOURNAMENT" ? rounds[index].thirdPlaceMatch ?? true : undefined,
      finalAdvancementMode: "top-n",
      advanceCount: rounds[index].advanceCount ?? 2,
      sourceRoundId: index > 0 ? rounds[index - 1].id : undefined,
    });
  };

  const canNext = rounds.every((round) => {
    if (kind === "type") {
      if (!round.program) return false;
      if (round.program !== "TEAM") return true;
      const teamPlayerCount = round.teamPlayerCount ?? 3;
      const teamMatchCount = (round.teamSinglesCount ?? 3) + (round.teamDoublesCount ?? 0);
      return (
        (round.inheritPreviousTeamFormation || Boolean(round.teamPlayerCount)) &&
        teamPlayerCount >= 2 &&
        teamPlayerCount <= 10 &&
        (!participantCount || teamPlayerCount <= participantCount) &&
        teamMatchCount >= 1 &&
        teamMatchCount <= 20
      );
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
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={round.tournamentMode ?? "single"}
            onChange={(_, value: TournamentMode | null) => {
              if (!value) return;
              updateRound(index, {
                option: "NONE",
                tournamentMode: value,
              });
            }}
          >
            <ToggleButton value="single">일반</ToggleButton>
            <ToggleButton value="upper-lower">상·하위</ToggleButton>
          </ToggleButtonGroup>
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
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={value}
            onChange={(_, selectedValue: string | null) => {
              if (!selectedValue) return;
              const choice = parseTournamentChoice(selectedValue);
              updateRound(index, {
                ...choice,
                tournamentSeeding:
                  choice.option === "FINAL"
                    ? "seed"
                    : round.tournamentSeeding ?? "seed",
              });
            }}
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              "& .MuiToggleButton-root": {
                width: "100%",
                margin: 0,
                border: "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: 0,
              },
              "& .MuiToggleButton-root:nth-of-type(1)": {
                borderTopLeftRadius: 8,
              },
              "& .MuiToggleButton-root:nth-of-type(2)": {
                borderTopRightRadius: 8,
              },
              "& .MuiToggleButton-root:nth-last-of-type(2)": {
                borderBottomLeftRadius: 8,
              },
              "& .MuiToggleButton-root:last-of-type": {
                borderBottomRightRadius: 8,
              },
            }}
          >
            <ToggleButton value="PRELIM:single">예선(일반)</ToggleButton>
            <ToggleButton value="PRELIM:upper-lower">예선(상·하위)</ToggleButton>
            {index > 0 && <ToggleButton value="FINAL:single">본선(일반)</ToggleButton>}
            {index > 0 && <ToggleButton value="FINAL:upper-lower">본선(상·하위)</ToggleButton>}
          </ToggleButtonGroup>
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
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={round.option ?? "PRELIM"}
          onChange={(_, value: RoundOption | null) => {
            if (!value) return;
            updateRound(index, {
              option: value,
              sourceRoundId: index > 0 ? rounds[index - 1].id : undefined,
              finalAdvancementMode: round.finalAdvancementMode ?? "top-n",
              advanceCount: round.advanceCount ?? 2,
            });
          }}
        >
          <ToggleButton value="PRELIM">예선</ToggleButton>
          <ToggleButton value="FINAL">본선</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    );
  };

  const renderFinalOptions = (round: RenewalRoundConfig, index: number) => {
    if (index === 0 || round.option !== "FINAL") return null;
    const previousFormat = rounds[index - 1]?.format;
    const advancementPrefix = previousFormat === "GROUP" ? "각 조 상위" : "전체 상위";

    if (round.format === "LEAGUE") {
      return (
        <>
          <AdvancementCount
            value={round.advanceCount ?? 2}
            prefix={advancementPrefix}
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
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={mode}
            onChange={(_, value: FinalAdvancementMode | null) => {
              if (!value) return;
              updateRound(index, {
                finalAdvancementMode: value,
                advanceCount: round.advanceCount ?? 2,
                sourceRoundId: rounds[index - 1].id,
              });
            }}
            sx={{ "& .MuiToggleButton-root": { flex: 1 } }}
          >
            <ToggleButton value="top-n">상위 인원</ToggleButton>
            <ToggleButton value="upper-lower-groups">상·하위부</ToggleButton>
            <ToggleButton value="rank-groups">순위대로</ToggleButton>
          </ToggleButtonGroup>
          {mode === "top-n" && (
            <AdvancementCount
              value={round.advanceCount ?? 2}
              prefix={advancementPrefix}
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

    if (round.format === "TOURNAMENT") {
      const mode = round.finalAdvancementMode ?? "top-n";
      return (
        <>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={mode}
            onChange={(_, value: FinalAdvancementMode | null) => {
              if (!value) return;
              updateRound(index, {
                finalAdvancementMode: value,
                sourceRoundId: rounds[index - 1].id,
              });
            }}
            sx={{ mt: 2, "& .MuiToggleButton-root": { flex: 1 } }}
          >
            <ToggleButton value="top-n">상위 인원</ToggleButton>
            <ToggleButton value="all">모두 진출</ToggleButton>
          </ToggleButtonGroup>
          {mode === "top-n" && (
            <AdvancementCount
              value={round.advanceCount ?? 2}
              prefix={advancementPrefix}
              onChange={(advanceCount) => updateRound(index, { advanceCount })}
            />
          )}
          <Typography sx={descriptionSx}>
            {mode === "all"
              ? "예선 참가자 모두가 본선에 진출하며, 전체 인원에 맞춰 토너먼트 시작 단계와 BYE를 자동으로 구성합니다."
              : previousFormat === "GROUP"
              ? "각 조의 상위 순위 참가자가 진출하며, 총 진출 인원에 맞춰 토너먼트 시작 단계와 BYE를 자동으로 구성합니다."
              : "전체 순위의 상위 참가자가 진출하며, 진출 인원에 맞춰 토너먼트 시작 단계와 BYE를 자동으로 구성합니다."}
          </Typography>
        </>
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
              onChange={(event) => {
                const program = event.target.value as NonNullable<RenewalRoundConfig["program"]>;
                updateRound(index, {
                  program,
                  inheritPreviousTeamFormation:
                    program === "TEAM"
                      ? round.inheritPreviousTeamFormation
                      : false,
                  ...(program === "TEAM"
                    ? {
                        teamPlayerCount: round.teamPlayerCount ?? 3,
                        teamSinglesCount: round.teamSinglesCount ?? 3,
                        teamDoublesCount: round.teamDoublesCount ?? 0,
                        teamMatchType: round.teamMatchType ?? "SSS",
                      }
                    : {}),
                });
              }}
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
              {index > 0 && rounds[index - 1]?.program === "TEAM" && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>
                    이전 라운드와 동일한 팀 편성
                  </Typography>
                  <RadioGroup
                    row
                    value={round.inheritPreviousTeamFormation ? "yes" : "no"}
                    onChange={(event) => {
                      const inherited = event.target.value === "yes";
                      const previousRound = rounds[index - 1];
                      updateRound(index, {
                        inheritPreviousTeamFormation: inherited,
                        teamPlayerCount: previousRound.teamPlayerCount,
                        teamAssignments: previousRound.teamAssignments,
                        teamShuffleSeed: previousRound.teamShuffleSeed,
                        unitClubMode: previousRound.unitClubMode,
                      });
                    }}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="예" />
                    <FormControlLabel value="no" control={<Radio />} label="아니오" />
                  </RadioGroup>
                </Box>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>단체전 구성</Typography>
                <Stack spacing={1}>
                  <CompactNumberStepper
                    label="단식"
                    value={round.teamSinglesCount ?? 3}
                    min={0}
                    max={20 - (round.teamDoublesCount ?? 0)}
                    suffix="경기"
                    onChange={(value) =>
                      updateRound(index, {
                        teamSinglesCount:
                          value === 0 && (round.teamDoublesCount ?? 0) === 0 ? 1 : value,
                      })
                    }
                  />
                  <CompactNumberStepper
                    label="복식"
                    value={round.teamDoublesCount ?? 0}
                    min={0}
                    max={20 - (round.teamSinglesCount ?? 3)}
                    suffix="경기"
                    onChange={(value) =>
                      updateRound(index, {
                        teamDoublesCount:
                          value === 0 && (round.teamSinglesCount ?? 3) === 0 ? 1 : value,
                      })
                    }
                  />
                </Stack>
              </Box>
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

          {round.format === "TOURNAMENT" && round.option !== "FINAL" && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>배치 방식</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={round.tournamentSeeding ?? "seed"}
                onChange={(_, value: RenewalRoundConfig["tournamentSeeding"] | null) => {
                  if (!value) return;
                  updateRound(index, { tournamentSeeding: value });
                }}
              >
                <ToggleButton value="seed">시드(순위)</ToggleButton>
                <ToggleButton value="random">랜덤</ToggleButton>
                <ToggleButton value="manual">수동</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

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
                  onChange={(event) => {
                    const tournamentBracketCount = Number(event.target.value);
                    updateRound(index, {
                      tournamentBracketCount,
                      thirdPlaceMatch: tournamentBracketCount === 1,
                    });
                  }}
                  size="small"
                >
                  {Array.from({ length: 8 }, (_, optionIndex) => optionIndex + 1).map((count) => (
                    <MenuItem key={count} value={count}>{count}개</MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

          {round.format === "TOURNAMENT" && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 0.5 }}>3·4위전</Typography>
              <RadioGroup
                row
                value={(round.thirdPlaceMatch ?? (round.tournamentBracketCount ?? 1) === 1) ? "yes" : "no"}
                onChange={(event) =>
                  updateRound(index, { thirdPlaceMatch: event.target.value === "yes" })
                }
              >
                <FormControlLabel value="yes" control={<Radio />} label="진행" />
                <FormControlLabel value="no" control={<Radio />} label="진행 안 함" />
              </RadioGroup>
              <Typography sx={descriptionSx}>
                진행하지 않으면 4강 탈락자 두 명이 공동 3위가 됩니다.
              </Typography>
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
      <Stack spacing={2}>
      {round.format === "TOURNAMENT" && round.tournamentMode === "upper-lower" && (
        <Typography sx={{ fontWeight: 900, color: "#2563EB" }}>상위부 경기 규칙</Typography>
      )}
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
      {round.format === "TOURNAMENT" && (
        <Stack direction="row" spacing={1.5}>
          <TextField select fullWidth size="small" label="규칙 전환 단계" value={round.ruleSwitchSize ?? ""}
            onChange={(event) => updateRound(index, { ruleSwitchSize: event.target.value ? Number(event.target.value) : undefined })}>
            <MenuItem value="">전환 없음</MenuItem>
            <MenuItem value={0}>처음부터</MenuItem>
            {[128, 64, 32, 16, 8, 4, 2].map((size) => <MenuItem key={size} value={size}>{size === 2 ? "결승부터" : `${size}강부터`}</MenuItem>)}
          </TextField>
          <TextField select fullWidth size="small" label="전환 후 규칙" disabled={round.ruleSwitchSize == null} value={round.lateMatchRule ?? "BEST_OF_5"}
            onChange={(event) => updateRound(index, { lateMatchRule: event.target.value as NonNullable<RenewalRoundConfig["lateMatchRule"]> })}>
            <MenuItem value="BEST_OF_3">3전 2선승제</MenuItem><MenuItem value="BEST_OF_5">5전 3선승제</MenuItem><MenuItem value="THREE_SET">3세트제</MenuItem>
          </TextField>
        </Stack>
      )}
      {round.format === "TOURNAMENT" && round.tournamentMode === "upper-lower" && (
        <Stack spacing={2} sx={{ mt: 1, p: 2, border: "1px solid #E2E8F0", borderRadius: 2, bgcolor: "#FAFAFF" }}>
          <Typography sx={{ fontWeight: 900, color: "#7C3AED" }}>하위부 경기 규칙</Typography>
          <FormControl fullWidth>
            <RadioGroup
              value={round.lowerMatchRule ?? round.matchRule ?? "BEST_OF_3"}
              onChange={(event) => updateRound(index, {
                lowerMatchRule: event.target.value as NonNullable<RenewalRoundConfig["lowerMatchRule"]>,
              })}
            >
              <Stack spacing={1.5}>
                <FormControlLabel value="BEST_OF_3" control={<Radio />} label="3전 2선승제" sx={optionCardSx} />
                <FormControlLabel value="BEST_OF_5" control={<Radio />} label="5전 3선승제" sx={optionCardSx} />
                <FormControlLabel value="THREE_SET" control={<Radio />} label="3세트제" sx={optionCardSx} />
              </Stack>
            </RadioGroup>
          </FormControl>
          <Stack direction="row" spacing={1.5}>
            <TextField select fullWidth size="small" label="하위부 규칙 전환 단계" value={round.lowerRuleSwitchSize ?? ""}
              onChange={(event) => updateRound(index, { lowerRuleSwitchSize: event.target.value ? Number(event.target.value) : undefined })}>
              <MenuItem value="">전환 없음</MenuItem>
              <MenuItem value={0}>처음부터</MenuItem>
              {[128, 64, 32, 16, 8, 4, 2].map((size) => <MenuItem key={size} value={size}>{size === 2 ? "결승부터" : `${size}강부터`}</MenuItem>)}
            </TextField>
            <TextField select fullWidth size="small" label="하위부 전환 후 규칙" disabled={round.lowerRuleSwitchSize == null} value={round.lowerLateMatchRule ?? "BEST_OF_5"}
              onChange={(event) => updateRound(index, { lowerLateMatchRule: event.target.value as NonNullable<RenewalRoundConfig["lowerLateMatchRule"]> })}>
              <MenuItem value="BEST_OF_3">3전 2선승제</MenuItem><MenuItem value="BEST_OF_5">5전 3선승제</MenuItem><MenuItem value="THREE_SET">3세트제</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      )}
      </Stack>
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
