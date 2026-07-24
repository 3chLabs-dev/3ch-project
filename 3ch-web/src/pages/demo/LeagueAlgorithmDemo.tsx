import { generateProgramOptions } from '../../features/league/algorithms/generateProgramOptions';
import { generateProgramBlocks } from '../../features/league/algorithms/generateProgramBlocks';
import { distributeSnake } from '../../features/league/algorithms/distributeSnake';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { generateGroupOptions } from '../../features/league/algorithms/generateGroupOptions';
import { useGetLeagueInvitedGroupsQuery, useGetLeagueParticipantsQuery, useGetLeagueProgramQuery, useGetLeagueQuery, useSaveLeagueProgramMutation, useSyncLeagueProgramMatchesMutation } from '../../features/league/leagueApi';
import type { ProgramBlock, ProgramOption, ProgramType, TeamMatchType, RoundConfig, FormationAssignmentPlayer, FinalAdvancementMode, RoundOption, TournamentMode } from '../../features/league/types/tournament.types';
import { ToggleButton, ToggleButtonGroup, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip, Radio, CircularProgress, Box, Typography, Stack, Divider, Tooltip } from "@mui/material";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
  useDroppable, type DragEndEvent, type DragOverEvent, } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { clearProgramMatchState, generateProgramRoundMatches } from '../../utils/programMatchGenerator';
import { toUTCDate } from '../../utils/dateUtils';

const FORMATION_COLORS = [
  "#E53935", // 빨강
  "#F57C00", // 주황
  "#D4A000", // 노랑
  "#2E7D32", // 초록
  "#1976D2", // 파랑
  "#303F9F", // 남색
  "#7B1FA2", // 보라
  "#212121", // 검정
  "#D81B60", // 분홍
  "#00897B", // 청록
  "#0097A7", // 하늘
  "#6D4C41", // 갈색
];

const LEGACY_TEAM_MATCH_COUNTS = {
  SSS: { singles: 3, doubles: 0 },
  SDS: { singles: 2, doubles: 1 },
  DSD: { singles: 1, doubles: 2 },
  DDD: { singles: 0, doubles: 3 },
} as const;

const getTeamMatchCounts = (round: RoundConfig) => {
  const legacy = LEGACY_TEAM_MATCH_COUNTS[round.teamMatchType] ?? LEGACY_TEAM_MATCH_COUNTS.SSS;
  return {
    singles: round.teamSinglesCount ?? legacy.singles,
    doubles: round.teamDoublesCount ?? legacy.doubles,
  };
};

function MatchCountStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{label}</Typography>
      <Button variant="outlined" onClick={() => onChange(Math.max(0, value - 1))} sx={{ minWidth: 36, width: 36, height: 36, p: 0 }}>-</Button>
      <Box sx={{ width: 42, height: 36, border: "1px solid #D1D5DB", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
        {value}
      </Box>
      <Button variant="outlined" onClick={() => onChange(value + 1)} sx={{ minWidth: 36, width: 36, height: 36, p: 0 }}>+</Button>
      <Typography sx={{ width: 28, fontSize: 13 }}>경기</Typography>
    </Stack>
  );
}

function AdvancementStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const buttonStyle = {
    width: "36px",
    height: "36px",
    border: "1px solid #d1d5db",
  } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <IconButton
        aria-label="본선 진출 인원 감소"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        sx={{ ...buttonStyle, fontSize: 22 }}
      >
        −
      </IconButton>
      <input
        type="number"
        min={1}
        max={99}
        inputMode="numeric"
        aria-label="본선 진출 인원"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          if (event.target.value === "") return;
          onChange(Math.min(99, Math.max(1, Number(event.target.value) || 1)));
        }}
        style={{
          width: "48px",
          height: "36px",
          boxSizing: "border-box",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          background: "#fff",
          fontWeight: 700,
          textAlign: "center",
          fontSize: "14px",
        }}
      />
      <IconButton
        aria-label="본선 진출 인원 증가"
        onClick={() => onChange(value + 1)}
        sx={{ ...buttonStyle, color: "#1976D2", fontSize: 22 }}
      >
        +
      </IconButton>
    </div>
  );
}

function RoundDivisionEditor({
  round,
  roundIndex,
  rounds,
  setRounds,
}: {
  round: RoundConfig;
  roundIndex: number;
  rounds: RoundConfig[];
  setRounds: (rounds: RoundConfig[]) => void;
}) {
  const update = (patch: Partial<RoundConfig>) =>
    setRounds(rounds.map((item) => item.id === round.id ? { ...item, ...patch } : item));
  const multipleRounds = rounds.length > 1;
  const controlStyle = {
    width: "100%",
    height: "40px",
    padding: "0 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  } as const;
  const helperStyle = {
    margin: "8px 0 0",
    color: "#64748B",
    fontSize: "13px",
    lineHeight: 1.55,
  } as const;

  let choices: Array<{ value: string; label: string }> = [];
  let value: string = round.option;
  let disabledLabel: string | null = null;

  if (!multipleRounds && round.format !== "TOURNAMENT") {
    disabledLabel = "해당 없음";
  } else if (!multipleRounds) {
    choices = [
      { value: "NONE:single", label: "일반" },
      { value: "NONE:upper-lower", label: "상·하위" },
    ];
    value = `NONE:${round.tournamentMode ?? "single"}`;
  } else if (roundIndex === 0 && round.format !== "TOURNAMENT") {
    disabledLabel = "예선";
  } else if (round.format === "TOURNAMENT") {
    choices = [
      { value: "PRELIM:single", label: "예선(일반)" },
      ...(roundIndex > 0 ? [{ value: "FINAL:single", label: "본선(일반)" }] : []),
      { value: "PRELIM:upper-lower", label: "예선(상·하위)" },
      ...(roundIndex > 0 ? [{ value: "FINAL:upper-lower", label: "본선(상·하위)" }] : []),
    ];
    value = `${round.option}:${round.tournamentMode ?? "single"}`;
  } else {
    choices = [
      { value: "PRELIM", label: "예선" },
      { value: "FINAL", label: "본선" },
    ];
  }

  const handleChoice = (choice: string) => {
    if (choice.includes(":")) {
      const [option, tournamentMode] = choice.split(":");
      update({
        option: option as RoundOption,
        tournamentMode: tournamentMode as TournamentMode,
        sourceRoundId: roundIndex > 0 ? rounds[roundIndex - 1].id : undefined,
      });
      return;
    }
    update({
      option: choice as RoundOption,
      sourceRoundId: roundIndex > 0 ? rounds[roundIndex - 1].id : undefined,
      finalAdvancementMode: round.finalAdvancementMode ?? "top-n",
      advanceCount: round.advanceCount ?? 2,
    });
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ fontWeight: 700, marginBottom: "8px" }}>라운드 구분</div>
      {disabledLabel ? (
        <input disabled value={disabledLabel} style={{ ...controlStyle, color: "#9ca3af" }} />
      ) : (
        <select value={value} onChange={(event) => handleChoice(event.target.value)} style={controlStyle}>
          {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      )}

      {round.format === "TOURNAMENT" && !disabledLabel && (
        <p style={helperStyle}>
          {round.tournamentMode === "upper-lower"
            ? "첫 경기에서 이기면 상위부로, 지면 하위부로 진출하는 토너먼트입니다."
            : "경기에서 이긴 참가자가 다음 단계로 진출하는 일반적인 토너먼트입니다."}
        </p>
      )}

      {roundIndex > 0 && round.option === "FINAL" && round.format === "LEAGUE" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
            <strong>상위</strong>
            <AdvancementStepper
              value={round.advanceCount ?? 2}
              onChange={(advanceCount) => update({ advanceCount, finalAdvancementMode: "top-n" })}
            />
            <strong>명</strong>
          </div>
          <p style={helperStyle}>
            예선 순위 결과에 따라 상위 순위권 참가자만 본선 라운드를 진행합니다.
          </p>
        </>
      )}

      {roundIndex > 0 && round.option === "FINAL" && round.format === "GROUP" && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px" }}>본선 편성</div>
          <select
            value={round.finalAdvancementMode ?? "top-n"}
            onChange={(event) => update({ finalAdvancementMode: event.target.value as FinalAdvancementMode })}
            style={controlStyle}
          >
            <option value="top-n">상위 인원</option>
            <option value="upper-lower-groups">상·하위부</option>
            <option value="rank-groups">순위대로</option>
          </select>
          {(round.finalAdvancementMode ?? "top-n") === "top-n" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
              <strong>상위</strong>
              <AdvancementStepper
                value={round.advanceCount ?? 2}
                onChange={(advanceCount) => update({ advanceCount })}
              />
              <strong>명</strong>
            </div>
          )}
          <p style={helperStyle}>
            {(round.finalAdvancementMode ?? "top-n") === "upper-lower-groups"
              ? "예선 순위 결과에 따라 상위부와 하위부로 나누어 본선 라운드를 진행합니다."
              : (round.finalAdvancementMode ?? "top-n") === "rank-groups"
                ? "예선 순위 결과에 따라 같은 순위끼리 각 순위조에 배정하여 본선 라운드를 진행합니다."
                : "예선 순위 결과에 따라 상위 순위권 참가자만 본선 라운드를 진행합니다."}
          </p>
        </div>
      )}

      {round.format === "TOURNAMENT" && round.option === "FINAL" && roundIndex > 0 &&
        rounds[roundIndex - 1]?.format === "GROUP" && rounds[roundIndex - 1]?.option === "PRELIM" && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>대진표 개수</div>
            <select
              value={round.tournamentBracketCount ?? 1}
              onChange={(event) => update({ tournamentBracketCount: Number(event.target.value) })}
              style={controlStyle}
            >
              {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}개</option>
              ))}
            </select>
          </div>
        )}
    </div>
  );
}

const formationPlayerId = (player: FormationAssignmentPlayer) =>
  `formation-${player.sourceGroupId ?? "unknown"}-${player.name}-${player.level}`;

const formationLevelSum = (players: FormationAssignmentPlayer[]): number =>
  players.reduce(
    (sum, player) => sum + (player.roster?.length
      ? formationLevelSum(player.roster)
      : Number.isFinite(player.level) ? player.level : 0),
    0,
  );

const formationClubIds = (player: FormationAssignmentPlayer): string[] => {
  const players = player.roster?.length ? player.roster : [player];
  return [...new Set(players.map((member) => member.sourceGroupId).filter((id): id is string => Boolean(id)))];
};

const distributeFormationClubAware = (
  players: FormationAssignmentPlayer[],
  groupSizes: number[],
) => {
  const groups = groupSizes.map((_, index) => ({ name: `${index + 1}조`, players: [] as FormationAssignmentPlayer[] }));
  const ordered = [...players].sort((a, b) => a.level - b.level);
  ordered.forEach((player) => {
    const clubIds = formationClubIds(player);
    const candidates = groups
      .map((group, index) => ({ group, index }))
      .filter(({ group, index }) => group.players.length < groupSizes[index]);
    candidates.sort((a, b) => {
      const duplicateA = a.group.players.reduce((sum, member) => sum + formationClubIds(member).filter((id) => clubIds.includes(id)).length, 0);
      const duplicateB = b.group.players.reduce((sum, member) => sum + formationClubIds(member).filter((id) => clubIds.includes(id)).length, 0);
      return duplicateA - duplicateB
        || a.group.players.length - b.group.players.length
        || formationLevelSum(a.group.players) - formationLevelSum(b.group.players);
    });
    candidates[0]?.group.players.push(player);
  });
  return groups;
};

const buildFormationUnits = (
  players: FormationAssignmentPlayer[],
  unitSize: number,
  mode: "same" | "mixed",
) => {
  if (unitSize <= 0) return [];
  if (mode === "same") {
    const byClub = new Map<string, FormationAssignmentPlayer[]>();
    players.forEach((player) => {
      const key = player.sourceGroupId ?? "unknown";
      byClub.set(key, [...(byClub.get(key) ?? []), player]);
    });
    return [...byClub.values()].flatMap((clubPlayers) => {
      const unitCount = Math.ceil(clubPlayers.length / unitSize);
      return distributeSnake(clubPlayers, Array.from({ length: unitCount }, (_, index) =>
        Math.min(unitSize, Math.max(0, clubPlayers.length - index * unitSize))));
    });
  }
  const unitCount = Math.ceil(players.length / unitSize);
  return distributeFormationClubAware(players, Array.from({ length: unitCount }, (_, index) =>
    Math.min(unitSize, Math.max(0, players.length - index * unitSize))));
};

function ClubPolicyControls({ round, enabled, onChange }: { round: RoundConfig; enabled: boolean; onChange: (patch: Partial<RoundConfig>) => void }) {
  if (!enabled) return null;
  const unitRound = round.program === "DOUBLES" || round.program === "TEAM";
  const canRestrictMatches = round.program === "SINGLES" || round.unitClubMode === "same";
  const yesNo = (value: boolean | undefined, change: (next: boolean) => void) => (
    <ToggleButtonGroup exclusive fullWidth value={value ? "yes" : "no"} onChange={(_, next) => next && change(next === "yes")}>
      <ToggleButton value="yes">예</ToggleButton><ToggleButton value="no">아니오</ToggleButton>
    </ToggleButtonGroup>
  );
  return <>
    {unitRound && <div style={{ marginTop: 16 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>{round.program === "TEAM" ? "팀 구성" : "복식 구성"}</div><ToggleButtonGroup exclusive fullWidth value={round.unitClubMode ?? "mixed"} onChange={(_, value) => value && onChange({ unitClubMode: value, teamAssignments: undefined, doublesAssignments: undefined, groupAssignments: undefined })}><ToggleButton value="same">같은 클럽만</ToggleButton><ToggleButton value="mixed">섞어서</ToggleButton></ToggleButtonGroup></div>}
    {round.format !== "LEAGUE" && <div style={{ marginTop: 16 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>타클럽 편성</div>{yesNo(round.crossClubGrouping, (next) => onChange({ crossClubGrouping: next, groupAssignments: undefined, ...(!next ? { crossClubOnlyMatches: false } : {}) }))}</div>}
    {round.format !== "TOURNAMENT" && canRestrictMatches && (round.format === "LEAGUE" || round.crossClubGrouping) && <div style={{ marginTop: 16 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>타클럽만 매칭</div>{yesNo(round.crossClubOnlyMatches, (next) => onChange({ crossClubOnlyMatches: next }))}</div>}
  </>;
}

function SortableFormationPlayer({ player }: { player: FormationAssignmentPlayer }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: formationPlayerId(player),
  });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      sx={{
        display: "flex", alignItems: "center", gap: 0.75, py: 0.65, px: 0.5,
        borderRadius: 1, cursor: "grab", touchAction: "none",
        bgcolor: isDragging ? "#EFF6FF" : "transparent", opacity: isDragging ? 0.55 : 1,
      }}
    >
      <DragHandleIcon sx={{ color: "#9CA3AF", fontSize: 17, flexShrink: 0 }} />
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
        {player.level}부
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{player.name}</Typography>
    </Box>
  );
}

function FormationEditCard({
  players, index, label,
}: {
  players: FormationAssignmentPlayer[];
  index: number;
  label: string;
}) {
  const id = `formation-group-${index}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const accent = FORMATION_COLORS[index % FORMATION_COLORS.length];

  return (
    <Box sx={{ border: `1px solid ${isOver ? accent : "#E5E7EB"}`, borderTop: `3px solid ${accent}`, borderRadius: 1.5, bgcolor: isOver ? "#F8FAFF" : "#FFF", overflow: "hidden" }}>
      <Box sx={{ px: 1.25, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#F8FAFC" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900 }}>{label}</Typography>
        <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 700 }}>{players.length}명</Typography>
      </Box>
      <Box ref={setNodeRef} sx={{ px: 0.75, py: 0.5, minHeight: 54 }}>
        <SortableContext items={players.map(formationPlayerId)} strategy={verticalListSortingStrategy}>
          {players.map((player) => <SortableFormationPlayer key={formationPlayerId(player)} player={player} />)}
        </SortableContext>
      </Box>
      <Divider />
      <Box sx={{ px: 1.25, py: 0.8 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 700 }}>
          합 <Box component="span" sx={{ color: accent, fontWeight: 900 }}>{formationLevelSum(players)}부</Box>
        </Typography>
      </Box>
    </Box>
  );
}

const formatTime = (totalMinutes: number) => {
  const minutesInDay = 24 * 60;
  const normalizedMinutes =
    ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

const getRoundFormatLabel = (
  format?: RoundConfig["format"]
) => {
  switch (format) {
    case "LEAGUE":
      return "단일리그";
    case "GROUP":
      return "조별리그";
    case "TOURNAMENT":
      return "토너먼트";
    default:
      return "-";
  }
};


interface RoundConfigEditorProps {
  rounds: RoundConfig[];
  setRounds: (rounds: RoundConfig[]) => void;
  clubPoliciesEnabled: boolean;
}

function RoundConfigEditor({
  rounds,
  setRounds,
  clubPoliciesEnabled,
}: RoundConfigEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = rounds.findIndex(
        (r) => r.id === active.id
      );
      const newIndex = rounds.findIndex(
        (r) => r.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      setRounds(
        arrayMove(rounds, oldIndex, newIndex).map(
          (round, index) => ({
            ...round,
            id: index + 1,
            sourceRoundId: index > 0 ? index : undefined,
          })
        )
      );
    },
    [rounds, setRounds]
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rounds.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {rounds.map((round, roundIndex) => (
            <div
              key={round.id}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    minWidth: "70px",
                  }}
                >
                  {round.id}라운드
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <DragHandleIcon
                    sx={{
                      color: "rgb(209, 213, 219)",
                    }}
                  />
                </div>

                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={() => {
                    setRounds(
                      rounds
                        .filter((x) => x.id !== round.id)
                        .map((x, index, remaining) => ({
                          ...x,
                          id: index + 1,
                          option: remaining.length === 1 ? "NONE" : index === 0 ? "PRELIM" : x.option,
                          sourceRoundId: index > 0 ? index : undefined,
                        }))
                    );
                  }}
                >
                  삭제
                </Button>
              </div>

              <ToggleButtonGroup
                exclusive
                value={round.program}
                onChange={(_, value) => {
                  if (!value) return;

                  setRounds(
                    rounds.map((x) =>
                      x.id === round.id
                        ? {
                            ...x,
                            program: value,
                          }
                        : x
                    )
                  );
                }}
                fullWidth
              >
                <ToggleButton value="SINGLES">
                  단식
                </ToggleButton>

                <ToggleButton value="DOUBLES">
                  복식
                </ToggleButton>

                <ToggleButton value="TEAM">
                  단체전
                </ToggleButton>
              </ToggleButtonGroup>

              <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    진행방식
                  </div>

                  <ToggleButtonGroup
                    exclusive
                    value={round.format}
                    fullWidth
                    onChange={(_, value) => {
                      if (!value) return;

                      setRounds(
                        rounds.map((x) =>
                          x.id === round.id
                              ? {
                                  ...x,
                                  format: value,
                                  option: rounds.length === 1 ? "NONE" : "PRELIM",
                                  tournamentMode: value === "TOURNAMENT" ? "single" : undefined,
                                  finalAdvancementMode: "top-n",
                                  advanceCount: x.advanceCount ?? 2,
                                  sourceRoundId: roundIndex > 0 ? rounds[roundIndex - 1].id : undefined,
                                  tournamentSeeding:
                                    value === "TOURNAMENT"
                                      ? x.tournamentSeeding ?? "seed"
                                      : x.tournamentSeeding,
                                  tournamentBracketCount:
                                    value === "TOURNAMENT"
                                      ? x.tournamentBracketCount ?? 1
                                      : 1,
                                }
                            : x
                        )
                      );
                    }}
                  >
                    <ToggleButton value="LEAGUE">
                      단일리그
                    </ToggleButton>

                    <ToggleButton value="GROUP">
                      조별리그
                    </ToggleButton>

                    <ToggleButton value="TOURNAMENT">
                      토너먼트
                    </ToggleButton>
	                  </ToggleButtonGroup>

                    {round.format === "TOURNAMENT" && (
                      <div style={{ marginTop: "16px" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: "8px",
                          }}
                        >
                          배치 방식
                        </div>

                        <ToggleButtonGroup
                          exclusive
                          value={round.tournamentSeeding ?? "seed"}
                          fullWidth
                          onChange={(_, value) => {
                            if (!value) return;

                            setRounds(
                              rounds.map((x) =>
                                x.id === round.id
                                  ? {
                                      ...x,
                                      tournamentSeeding: value,
                                    }
                                  : x
                              )
                            );
                          }}
                        >
                          <ToggleButton value="seed">
                            시드(순위)
                          </ToggleButton>

                          <ToggleButton value="random">
                            랜덤
                          </ToggleButton>

                          <ToggleButton value="manual">
                            수동
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </div>
                    )}

                    <RoundDivisionEditor
                      round={round}
                      roundIndex={roundIndex}
                      rounds={rounds}
                      setRounds={setRounds}
                    />
              </div>

              {round.program === "TEAM" && (
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    팀 인원
                  </div>

                  <ToggleButtonGroup
                    exclusive
                    value={round.teamPlayerCount}
                    fullWidth
                    onChange={(_, value) => {
                      if (!value) return;

                      setRounds(
                        rounds.map((x) =>
                          x.id === round.id
                            ? {
                                ...x,
                                teamPlayerCount: value,
                              }
                            : x
                        )
                      );
                    }}
                  >
                    <ToggleButton value={2}>
                      2명
                    </ToggleButton>

                    <ToggleButton value={3}>
                      3명
                    </ToggleButton>

                    <ToggleButton value={4}>
                      4명
                    </ToggleButton>

                    <ToggleButton value={5}>
                      5명
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <div style={{ marginTop: "16px" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      단체전 구성
                    </div>
                    <Stack spacing={1}>
                      <MatchCountStepper
                        label="단식"
                        value={getTeamMatchCounts(round).singles}
                        onChange={(value) => setRounds(rounds.map((x) => x.id === round.id ? { ...x, teamSinglesCount: value } : x))}
                      />
                      <MatchCountStepper
                        label="복식"
                        value={getTeamMatchCounts(round).doubles}
                        onChange={(value) => setRounds(rounds.map((x) => x.id === round.id ? { ...x, teamDoublesCount: value } : x))}
                      />
                    </Stack>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "16px" }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  경기방식
                </div>

                <ToggleButtonGroup
                  exclusive
                  value={round.matchRule}
                  fullWidth
                  onChange={(_, value) => {
                    if (!value) return;

                    setRounds(
                      rounds.map((x) =>
                        x.id === round.id
                          ? {
                              ...x,
                              matchRule: value,
                            }
                          : x
                      )
                    );
                  }}
                >
                  <ToggleButton value="BEST_OF_3">
                    3전 2선승제
                  </ToggleButton>

                  <ToggleButton value="BEST_OF_5">
                    5전 3선승제
                  </ToggleButton>

                  <ToggleButton value="THREE_SET">
                    3세트제
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
              <ClubPolicyControls round={round} enabled={clubPoliciesEnabled} onChange={(patch) => setRounds(rounds.map((item) => item.id === round.id ? { ...item, ...patch } : item))} />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="contained"
        fullWidth
        onClick={() => {
          setRounds([
            ...rounds.map((item, index) => ({
              ...item,
              option: index === 0 ? "PRELIM" as const : item.option,
            })),
            {
              id: rounds.length + 1,
              expanded: true,
              program: "SINGLES",
              format: "GROUP",
              option: "PRELIM",
              matchRule: "BEST_OF_3",
              teamPlayerCount: 4,
              teamMatchType: "SSS",
              tournamentMode: "single",
              finalAdvancementMode: "top-n",
              advanceCount: 2,
              sourceRoundId: rounds.length,
            },
          ]);
        }}
      >
        + 라운드 추가
      </Button>
    </>
  );
}
interface LeagueAlgorithmDemoProps {
  initialPlayerCount?: number;
  initialCourtCount?: number;
  initialStartTime?: string;
  initialEndTime?: string;
  embedded?: boolean;
  hideSetupInputs?: boolean;
  hideFormationActions?: boolean;
  hideHeader?: boolean;
  hideModeTabs?: boolean;
  hideRecommendationTitle?: boolean;
  compactCompleteButton?: boolean;
  hasParticipatingClubs?: boolean;
  onComplete?: (program: ProgramOption) => void;
  onBack?: () => void;
}

const LeagueAlgorithmDemo = ({
  initialPlayerCount = 24,
  initialCourtCount = 4,
  initialStartTime = "09:00",
  initialEndTime = "15:00",
  embedded: _embedded = false,
  hideSetupInputs = false,
  hideFormationActions = false,
  hideHeader = false,
  hideModeTabs = false,
  hideRecommendationTitle = false,
  compactCompleteButton = false,
  hasParticipatingClubs = false,
  onComplete,
  onBack,
}: LeagueAlgorithmDemoProps) => {
  const navigate = useNavigate();
  const { id: leagueId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";
  const shouldHideSetupInputs = hideSetupInputs || isEditMode;
  const restoredRef = useRef(false);
  const skipNextResetRef = useRef(false);
  const { data: participantData } = useGetLeagueParticipantsQuery(leagueId ?? "", {
    skip: !leagueId,
  });
  const { data: savedProgramData } = useGetLeagueProgramQuery(leagueId ?? "", {
    skip: !leagueId || !isEditMode,
  });
  const { data: leagueData } = useGetLeagueQuery(leagueId ?? "", {
    skip: !leagueId || !isEditMode,
  });
  const [saveLeagueProgram] = useSaveLeagueProgramMutation();
  const [syncLeagueProgramMatches] = useSyncLeagueProgramMatchesMutation();
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [courtCount, setCourtCount] = useState(initialCourtCount);
  const [startHour, setStartHour] = useState(Number(initialStartTime.split(":" )[0]) || 9);
  const [startMinute, setStartMinute] = useState(Number(initialStartTime.split(":" )[1]) || 0);
  const [endHour, setEndHour] = useState(Number(initialEndTime.split(":" )[0]) || 15);
  const [endMinute, setEndMinute] = useState(Number(initialEndTime.split(":" )[1]) || 0);
  const [teamPlayerCount] = useState(4);
  const [singlesEnabled] = useState(true);
  const [doublesEnabled] = useState(true);
  const [teamEnabled] = useState(true);
  const [teamMatchRounds] = useState<TeamMatchType[]>
  ([
    "SINGLES",
    "SINGLES",
    "SINGLES",
  ]);
  const [programOrder] = useState<ProgramType[]>
  ([
  "SINGLES",
  "TEAM",
  ]);

  const [rounds, setRounds] = useState<RoundConfig[]>([
    {
      id: 1,
      expanded: true,
      program: "SINGLES",
      format: "GROUP",
      option: "NONE",
      matchRule: "BEST_OF_5",
      teamPlayerCount: 4,
      teamMatchType: "SSS",
      tournamentSeeding: "seed",
      tournamentBracketCount: 1,
    },
    {
      id: 2,
      expanded: true,
      program: "TEAM",
      format: "GROUP",
      option: "NONE",
      matchRule: "BEST_OF_5",
      teamPlayerCount: 4,
      teamMatchType: "SSS",
      tournamentSeeding: "seed",
      tournamentBracketCount: 1,
    },
  ]);

  const [programMode, setProgramMode] = useState<
    "recommend" | "custom"
  >("recommend");
  const [isProgramGenerated, setIsProgramGenerated] = useState(false);
  const [isCustomProgramCompleted, setIsCustomProgramCompleted] = useState(false);
  const [isGeneratingProgram, setIsGeneratingProgram] = useState(false);
  const [isCompletingCustomProgram, setIsCompletingCustomProgram] = useState(false);
  const [selectedProgramOptionIndex, setSelectedProgramOptionIndex] = useState<number | null>(null);
  const [customProgramOptions, setCustomProgramOptions] = useState<Record<number, ProgramOption>>({});
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
  const [editingRounds, setEditingRounds] = useState<RoundConfig[]>([]);
  const [groupStructureDialog, setGroupStructureDialog] = useState<{
    optionIndex: number;
    blockIndex: number;
    mode: "team" | "group";
  } | null>(null);

  useEffect(() => {
    if (shouldHideSetupInputs) {
      setIsProgramGenerated(true);
    }
  }, [shouldHideSetupInputs]);
  const [pendingGroupSizes, setPendingGroupSizes] = useState<number[]>([]);
  const [groupResultDialog, setGroupResultDialog] = useState<{
    optionIndex: number;
    blockIndex: number;
    mode: "team" | "doubles" | "group";
  } | null>(null);
  const [isFormationEditing, setIsFormationEditing] = useState(false);
  const [formationDraft, setFormationDraft] = useState<FormationAssignmentPlayer[][]>([]);

  type StoredProgramEditState = {
    playerCount: number;
    courtCount: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    programMode: "recommend" | "custom";
    isProgramGenerated: boolean;
    isCustomProgramCompleted: boolean;
    selectedProgramOptionIndex: number | null;
    rounds: RoundConfig[];
    recommendationOptions: ProgramOption[];
    customProgramOptions: Record<number, ProgramOption>;
  };

  type StoredProgramWithEditState = ProgramOption & {
    editState?: StoredProgramEditState;
    compositionMode?: "recommend" | "custom";
  };

  const mockPlayers = [
  { name: '가가가', level: 3 },
  { name: '나나나', level: 3 },
  { name: '다다다', level: 3 },
  { name: '라라라', level: 4 },
  { name: '마마마', level: 4 },
  { name: '바바바', level: 4 },
  { name: '사사사', level: 4 },
  { name: '아아아', level: 4 },
  { name: '자자자', level: 5 },
  { name: '차차차', level: 5 },
  { name: '카카카', level: 5 },
  { name: '타타타', level: 5 },
  { name: '파파파', level: 6 },
  { name: '하하하', level: 6 },
  { name: '고고고', level: 6 },
  { name: '노노노', level: 6 },
  { name: '도도도', level: 7 },
  { name: '로로로', level: 7 },
  { name: '모모모', level: 8 },
  { name: '보보보', level: 8 },
  { name: '소소소', level: 8 },
  { name: '오오오', level: 9 },
  { name: '조조조', level: 9 },
  { name: '초초초', level: 9 },
];

  const leaguePlayers = useMemo(() => {
    return (participantData?.participants ?? []).map((participant) => {
      const parsedLevel = Number.parseInt(participant.division ?? "", 10);
      return {
        name: participant.name,
        level: Number.isNaN(parsedLevel) ? 999 : parsedLevel,
        sourceGroupId: participant.source_group_id ?? null,
      };
    });
  }, [participantData]);

  const groupPlayers = useMemo(
    () => (leaguePlayers.length > 0 ? leaguePlayers : mockPlayers),
    [leaguePlayers]
  );
  const effectiveFormationPlayerCount = leaguePlayers.length > 0
    ? leaguePlayers.length
    : playerCount;

  useEffect(() => {
    if (isEditMode && restoredRef.current) {
      return;
    }
    if (leaguePlayers.length > 0) {
      setPlayerCount(leaguePlayers.length);
    }
  }, [isEditMode, leaguePlayers.length]);

  const rentalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const rentalStartMinutes = startHour * 60 + startMinute;
  const rentalHours = rentalMinutes / 60;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = rounds.findIndex(
        (r) => r.id === active.id
      );

      const newIndex = rounds.findIndex(
        (r) => r.id === over.id
      );

      if (
        oldIndex === -1 ||
        newIndex === -1
      ) {
        return;
      }

      setRounds(
        arrayMove(
          rounds,
          oldIndex,
          newIndex
        ).map((round, index) => ({
          ...round,
          id: index + 1,
          sourceRoundId: index > 0 ? index : undefined,
        }))
      );
    },
    [rounds]
  );


  const programOptions = useMemo(
    () =>
      generateProgramOptions({
        playerCount,
        courtCount,
        rentalMinutes: rentalHours * 60,
        rentalStartMinutes,
        preferences: {
          singlesEnabled,
          doublesEnabled,
          teamEnabled,
          teamMatchRounds,
          programOrder,
          teamPlayerCount,
          rounds,
        },
      }),
    [
      playerCount,
      courtCount,
      rentalHours,
      rentalStartMinutes,
      singlesEnabled,
      doublesEnabled,
      teamEnabled,
      teamMatchRounds,
      programOrder,
      teamPlayerCount,
      rounds,
    ]
  );
  useEffect(() => {
    if (isEditMode && restoredRef.current) {
      return;
    }
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    setCustomProgramOptions({});
    setSelectedProgramOptionIndex(null);
  }, [
    isEditMode,
    playerCount,
    courtCount,
    rentalMinutes,
    rentalStartMinutes,
    rounds,
  ]);

  const buildProgramOptionFromRounds = (
    baseOption: ProgramOption,
    nextRounds: RoundConfig[]
  ): ProgramOption => {
    let elapsedMinutes = 0;
    const blocks = generateProgramBlocks(
      {
        singlesEnabled,
        doublesEnabled,
        teamEnabled,
        teamMatchRounds,
        programOrder,
        teamPlayerCount,
        rounds: nextRounds,
      },
      effectiveFormationPlayerCount,
      courtCount,
      baseOption.groupSizes
    ).map((block) => {
      const startMinutes = rentalStartMinutes + elapsedMinutes;
      const endMinutes = startMinutes + block.expectedMinutes;

      elapsedMinutes += block.expectedMinutes;

      return {
        ...block,
        startMinutes,
        endMinutes,
      };
    });
    const totalBlockMatchCount = blocks.reduce(
      (sum, block) => sum + block.matchCount,
      0
    );
    const totalProgramMinutes = blocks.reduce(
      (sum, block) => sum + block.expectedMinutes,
      0
    );

    return {
      ...baseOption,
      matchRule: blocks[0]?.matchRule ?? baseOption.matchRule,
      matchCount: totalBlockMatchCount,
      expectedMinutes: totalProgramMinutes,
      blocks,
      totalBlockMatchCount,
      totalProgramMinutes,
      isOverTime: totalProgramMinutes > rentalMinutes,
      rounds: nextRounds,
    };
  };

  const getCustomModeRounds = (
    baseOption: ProgramOption
  ) =>
    rounds.map((round, roundIndex) => ({
      ...round,
      id: roundIndex + 1,
      groupSizes:
        round.groupSizes ??
        baseOption.groupSizes,
    }));

  const displayedProgramOptions = programOptions.map(
    (option, index) => {
      const customOption =
        customProgramOptions[index];

      if (customOption) {
        return customOption;
      }

      if (
        programMode === "custom" &&
        isCustomProgramCompleted
      ) {
        return buildProgramOptionFromRounds(
          option,
          getCustomModeRounds(option)
        );
      }

      return option;
    }
  );

  const getProgramOptionIndexByTitle = useCallback(
    (title?: string) => {
      const fixedTitleIndex = ["정규 경기", "밸런스형", "빠른 진행"].findIndex(
        (fixedTitle) => title?.includes(fixedTitle)
      );

      if (fixedTitleIndex >= 0) {
        return fixedTitleIndex;
      }

      const generatedIndex = programOptions.findIndex(
        (option) => option.title === title
      );

      return generatedIndex >= 0 ? generatedIndex : 0;
    },
    [programOptions]
  );

  useEffect(() => {
    if (!isEditMode || !leagueId || restoredRef.current || !leagueData?.league) {
      return;
    }

    const savedProgram = savedProgramData?.program?.program_data as StoredProgramWithEditState | undefined;
    if (!savedProgram) {
      return;
    }

    try {
      const storedProgram = savedProgram;
      const editState = storedProgram.editState;
      const restoredProgramMode =
        storedProgram.compositionMode ??
        editState?.programMode ??
        (storedProgram.title?.includes("직접 구성") ? "custom" : "recommend");
      const currentLeague = leagueData.league;
      const currentStart = toUTCDate(currentLeague.start_date);
      const currentEnd = currentLeague.end_date ? toUTCDate(currentLeague.end_date) : null;

      if (editState) {
        skipNextResetRef.current = true;
        const restoredSelectedIndex =
          editState.selectedProgramOptionIndex ??
          getProgramOptionIndexByTitle(storedProgram.title);
        setPlayerCount(currentLeague.participant_count ?? leaguePlayers.length ?? editState.playerCount);
        setCourtCount(currentLeague.court_count ?? editState.courtCount);
        setStartHour(currentStart.getHours());
        setStartMinute(currentStart.getMinutes());
        setEndHour(currentEnd?.getHours() ?? editState.endHour);
        setEndMinute(currentEnd?.getMinutes() ?? editState.endMinute);
        setProgramMode(restoredProgramMode);
        setIsProgramGenerated(editState.isProgramGenerated);
        setIsCustomProgramCompleted(editState.isCustomProgramCompleted);
        setRounds(editState.rounds);
        setCustomProgramOptions({
          ...Object.fromEntries(
            editState.recommendationOptions.map((option, index) => [index, option])
          ),
          ...editState.customProgramOptions,
          [restoredSelectedIndex]: {
            ...storedProgram,
            title: programOptions[restoredSelectedIndex]?.title ?? storedProgram.title,
          },
        });
        setSelectedProgramOptionIndex(restoredSelectedIndex);
      } else {
        const restoredRounds = storedProgram.rounds ?? rounds;
        const restoredSelectedIndex = getProgramOptionIndexByTitle(storedProgram.title);
        skipNextResetRef.current = true;
        setIsProgramGenerated(true);
        setProgramMode(restoredProgramMode);
        setIsCustomProgramCompleted(restoredProgramMode === "custom");
        setRounds(restoredRounds);
        setPlayerCount(currentLeague.participant_count ?? leaguePlayers.length ?? playerCount);
        setCourtCount(currentLeague.court_count ?? courtCount);
        setStartHour(currentStart.getHours());
        setStartMinute(currentStart.getMinutes());
        if (currentEnd) {
          setEndHour(currentEnd.getHours());
          setEndMinute(currentEnd.getMinutes());
        }
        setCustomProgramOptions({
          [restoredSelectedIndex]: {
            ...storedProgram,
            title: programOptions[restoredSelectedIndex]?.title ?? storedProgram.title,
          },
        });
        setSelectedProgramOptionIndex(restoredSelectedIndex);
      }

      restoredRef.current = true;
    } catch {
      restoredRef.current = true;
    }
  }, [courtCount, getProgramOptionIndexByTitle, isEditMode, leagueData, leagueId, leaguePlayers.length, playerCount, programOptions, rounds, savedProgramData]);

  const openProgramEditDialog = (index: number) => {
    const option = displayedProgramOptions[index];

    setEditingOptionIndex(index);
    setEditingRounds(
      (option.rounds ?? rounds).map((round, roundIndex) => ({
        ...round,
        id: roundIndex + 1,
      }))
    );
  };

  const closeProgramEditDialog = () => {
    setEditingOptionIndex(null);
    setEditingRounds([]);
  };

  const completeProgramEdit = () => {
    if (editingOptionIndex === null) {
      return;
    }

    const baseOption = displayedProgramOptions[editingOptionIndex];
    const updatedOption = buildProgramOptionFromRounds(
      baseOption,
      editingRounds
    );

    setCustomProgramOptions({
      ...customProgramOptions,
      [editingOptionIndex]: updatedOption,
    });
    closeProgramEditDialog();
  };

  const completeProgramCreation = async () => {
    if (selectedProgramOptionIndex === null) {
      return;
    }

    const selectedOption: StoredProgramWithEditState = {
      ...displayedProgramOptions[selectedProgramOptionIndex],
      compositionMode: programMode,
      editState: {
        playerCount,
        courtCount,
        startHour,
        startMinute,
        endHour,
        endMinute,
        programMode,
        isProgramGenerated,
        isCustomProgramCompleted,
        selectedProgramOptionIndex,
        rounds,
        recommendationOptions: displayedProgramOptions.slice(0, 3),
        customProgramOptions,
      },
    };

    if (onComplete) {
      onComplete(selectedOption);
      return;
    }

    if (leagueId) {
      const previousProgram = savedProgramData?.program?.program_data as ProgramOption | undefined;
      if (isEditMode && previousProgram) {
        selectedOption.blocks.forEach((block, blockIndex) => {
          const previousBlock = previousProgram.blocks?.[blockIndex];
          if (
            block.type !== "TEAM"
            && previousBlock?.type !== "TEAM"
            && block.type !== "DOUBLES"
            && previousBlock?.type !== "DOUBLES"
          ) return;

          const previousFormation = JSON.stringify({
            type: previousBlock?.type,
            format: previousBlock?.format,
            groupSizes: previousBlock?.groupSizes ?? [],
            teamGroupSizes: previousBlock?.teamGroupSizes ?? [],
            groupAssignments: previousBlock?.groupAssignments ?? [],
            teamAssignments: previousBlock?.teamAssignments ?? [],
            doublesAssignments: previousBlock?.doublesAssignments ?? [],
          });
          const nextFormation = JSON.stringify({
            type: block.type,
            format: block.format,
            groupSizes: block.groupSizes ?? [],
            teamGroupSizes: block.teamGroupSizes ?? [],
            groupAssignments: block.groupAssignments ?? [],
            teamAssignments: block.teamAssignments ?? [],
            doublesAssignments: block.doublesAssignments ?? [],
          });

          if (previousFormation !== nextFormation) {
            clearProgramMatchState(leagueId, blockIndex + 1);
          }
        });
      }
      localStorage.setItem(
        `league-program-${leagueId}`,
        JSON.stringify(selectedOption)
      );
      localStorage.setItem(`league-program-active-round-${leagueId}`, "1");
      await saveLeagueProgram({ leagueId, program: selectedOption }).unwrap();
      const programMatches = selectedOption.blocks.flatMap((block, blockIndex) =>
        generateProgramRoundMatches(leagueId, selectedOption, participantData?.participants ?? [], blockIndex + 1).map((match) => ({
          ...match,
          program_round: blockIndex + 1,
          program_block_type: block.type,
        }))
      );
      try {
        await syncLeagueProgramMatches({ leagueId, matches: programMatches }).unwrap();
      } catch (error) {
        console.error("Failed to sync program matches", error);
      }
      navigate(isEditMode ? `/league/${leagueId}` : `/league/${leagueId}/program`);
      return;
    }

    console.log("selected program option", selectedOption);
  };

  const sameGroupSizes = (
    left: number[] = [],
    right: number[] = []
  ) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

  const rotateBySeed = <T,>(items: T[], seed: number) => {
    if (items.length < 2) return items;
    const offset = seed % items.length || 1;
    const rotated = [...items.slice(offset), ...items.slice(0, offset)];
    return Math.floor(seed / items.length) % 2 === 1
      ? rotated.reverse()
      : rotated;
  };

  const reshuffleWithinLevel = <T extends { level?: number }>(
    items: T[],
    seed?: number,
  ) => {
    if (seed == null) return items;
    const buckets = new Map<number, T[]>();
    items.forEach((item) => {
      const level = item.level ?? 999;
      buckets.set(level, [...(buckets.get(level) ?? []), item]);
    });
    return [...buckets.keys()]
      .sort((a, b) => a - b)
      .flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
  };

  const formatFormationName = (name: string, level?: number) =>
    level == null ? name : name.replace(new RegExp(`\\s*\\(${level}\\)$`), "");

  const getRoundGroupSizes = (
    option: ProgramOption,
    blockIndex: number
  ) =>
    option.blocks[blockIndex]?.groupSizes ??
    option.rounds?.[blockIndex]?.groupSizes ??
    option.groupSizes;

  const splitIntoTwoGroups = (count: number) => {
    if (count <= 0) return [];
    if (count <= 2) return [count];
    return [Math.ceil(count / 2), Math.floor(count / 2)];
  };

  const getTeamCount = (option: ProgramOption, blockIndex: number) => {
    const round = option.rounds?.[blockIndex];
    const teamSize = Math.max(1, round?.teamPlayerCount ?? teamPlayerCount);
    return Math.ceil(effectiveFormationPlayerCount / teamSize);
  };

  const getRoundTeamGroupSizes = (
    option: ProgramOption,
    blockIndex: number
  ) =>
    option.blocks[blockIndex]?.teamGroupSizes ??
    option.rounds?.[blockIndex]?.teamGroupSizes ??
    splitIntoTwoGroups(getTeamCount(option, blockIndex));

  const getStructureSizes = (
    option: ProgramOption,
    blockIndex: number,
    mode: "team" | "doubles" | "group"
  ) => {
    const block = option.blocks[blockIndex];

    if (mode === "team") {
      return getRoundGroupSizes(option, blockIndex);
    }
    if (mode === "doubles") {
      return Array.from({ length: Math.floor(effectiveFormationPlayerCount / 2) }, () => 2);
    }

    if (block?.type === "TEAM") return getRoundTeamGroupSizes(option, blockIndex);
    if (block?.type === "DOUBLES") {
      const pairCount = Math.floor(effectiveFormationPlayerCount / 2);
      const configured = getRoundGroupSizes(option, blockIndex);
      return configured.reduce((sum, size) => sum + size, 0) === pairCount
        ? configured
        : splitIntoTwoGroups(pairCount);
    }
    return getRoundGroupSizes(option, blockIndex);
  };

  const updateProgramRoundGroupSizes = (
    optionIndex: number,
    blockIndex: number,
    groupSizes: number[],
    mode: "team" | "group"
  ) => {
    const baseOption = displayedProgramOptions[optionIndex];
    const nextRounds = (baseOption.rounds ?? rounds).map(
      (round, roundIndex) => ({
        ...round,
        id: roundIndex + 1,
        groupSizes: mode === "team" && roundIndex === blockIndex
          ? groupSizes
          : round.groupSizes ?? baseOption.groupSizes,
        teamGroupSizes: mode === "group" && roundIndex === blockIndex
          ? groupSizes
          : round.teamGroupSizes,
        teamAssignments: mode === "team" && roundIndex === blockIndex
          ? undefined
          : round.teamAssignments,
        groupAssignments: roundIndex === blockIndex
          ? undefined
          : round.groupAssignments,
      })
    );
    const updatedOption = buildProgramOptionFromRounds(
      baseOption,
      nextRounds
    );

    setCustomProgramOptions({
      ...customProgramOptions,
      [optionIndex]: updatedOption,
    });
  };

  const updateProgramRoundShuffleSeed = (
    optionIndex: number,
    blockIndex: number,
    mode: "team" | "doubles" | "group"
  ) => {
    const baseOption = customProgramOptions[optionIndex] ?? displayedProgramOptions[optionIndex];
    const defaultSeed = (blockIndex + 1) * 1000;
    const nextTeamShuffleSeed =
      ((baseOption.rounds?.[blockIndex]?.teamShuffleSeed ??
        baseOption.blocks[blockIndex]?.teamShuffleSeed ??
        defaultSeed + 101) + 1);
    const nextGroupShuffleSeed =
      ((baseOption.rounds?.[blockIndex]?.groupShuffleSeed ??
        baseOption.blocks[blockIndex]?.groupShuffleSeed ??
        defaultSeed + 503) + 1);
    const nextRounds = (baseOption.rounds ?? rounds).map((round, roundIndex) => ({
      ...round,
      id: roundIndex + 1,
      groupSizes: round.groupSizes ?? baseOption.groupSizes,
      groupShuffleSeed: mode === "group" && roundIndex === blockIndex
        ? nextGroupShuffleSeed
        : round.groupShuffleSeed,
      teamShuffleSeed: (mode === "team" || mode === "doubles") && roundIndex === blockIndex
        ? nextTeamShuffleSeed
        : round.teamShuffleSeed,
      groupAssignments: mode === "group" && roundIndex === blockIndex
        ? undefined
        : mode === "team" && roundIndex === blockIndex
          ? undefined
          : round.groupAssignments,
      teamAssignments: mode === "team" && roundIndex === blockIndex
        ? undefined
        : round.teamAssignments,
      doublesAssignments: mode === "doubles" && roundIndex === blockIndex
        ? undefined
        : round.doublesAssignments,
    }));
    const updatedOption = buildProgramOptionFromRounds(baseOption, nextRounds);
    const nextBlocks = updatedOption.blocks.map((block, roundIndex) => {
      if (roundIndex !== blockIndex) {
        return block;
      }

      return {
        ...block,
        groupShuffleSeed: mode === "group"
          ? nextGroupShuffleSeed
          : block.groupShuffleSeed,
        teamShuffleSeed: mode === "team" || mode === "doubles"
          ? nextTeamShuffleSeed
          : block.teamShuffleSeed,
        groupAssignments: mode === "group" || mode === "team" ? undefined : block.groupAssignments,
        teamAssignments: mode === "team" ? undefined : block.teamAssignments,
        doublesAssignments: mode === "doubles" ? undefined : block.doublesAssignments,
      };
    });

    setCustomProgramOptions((previous) => ({
      ...previous,
      [optionIndex]: {
        ...updatedOption,
        blocks: nextBlocks,
      },
    }));
    setIsFormationEditing(false);
    setFormationDraft([]);
  };

  const saveManualFormation = () => {
    if (!groupResultDialog) return;
    const { optionIndex, blockIndex, mode } = groupResultDialog;
    if (mode === "doubles" && formationDraft.some((group) => group.length !== 2)) return;
    const baseOption = customProgramOptions[optionIndex] ?? displayedProgramOptions[optionIndex];
    const nextRounds = (baseOption.rounds ?? rounds).map((round, roundIndex) => {
      if (roundIndex !== blockIndex) return { ...round, id: roundIndex + 1 };
      if (mode === "team") {
        return {
          ...round,
          id: roundIndex + 1,
          groupSizes: formationDraft.map((group) => group.length),
          teamAssignments: formationDraft,
          groupAssignments: undefined,
        };
      }
      if (mode === "doubles") {
        return { ...round, id: roundIndex + 1, doublesAssignments: formationDraft };
      }
      return {
        ...round,
        id: roundIndex + 1,
        groupAssignments: formationDraft,
        ...(round.program === "TEAM"
          ? { teamGroupSizes: formationDraft.map((group) => group.length) }
          : { groupSizes: formationDraft.map((group) => group.length) }),
      };
    });
    const updatedOption = buildProgramOptionFromRounds(baseOption, nextRounds);
    setCustomProgramOptions((previous) => ({ ...previous, [optionIndex]: updatedOption }));
    setIsFormationEditing(false);
  };

  const openGroupStructureDialog = (
    optionIndex: number,
    blockIndex: number,
    mode: "team" | "group"
  ) => {
    const option = displayedProgramOptions[optionIndex];

    setPendingGroupSizes(
      getStructureSizes(option, blockIndex, mode)
    );
    setGroupStructureDialog({
      optionIndex,
      blockIndex,
      mode,
    });
  };

  const closeGroupStructureDialog = () => {
    setGroupStructureDialog(null);
    setPendingGroupSizes([]);
  };

  const completeGroupStructureDialog = () => {
    if (!groupStructureDialog) {
      return;
    }

    updateProgramRoundGroupSizes(
      groupStructureDialog.optionIndex,
      groupStructureDialog.blockIndex,
      pendingGroupSizes,
      groupStructureDialog.mode
    );
    closeGroupStructureDialog();
  };

  const getStars = (score: number) => {
    if (score >= 90) return "★★★★★";
    if (score >= 80) return "★★★★☆";
    if (score >= 70) return "★★★☆☆";
    if (score >= 60) return "★★☆☆☆";

  return "★☆☆☆☆";
};

  const groupStructureOption =
    groupStructureDialog !== null
      ? displayedProgramOptions[groupStructureDialog.optionIndex]
      : undefined;
  const groupStructureSizes =
    pendingGroupSizes.length > 0
      ? pendingGroupSizes
      : groupStructureDialog !== null && groupStructureOption
        ? getStructureSizes(
          groupStructureOption,
          groupStructureDialog.blockIndex,
          groupStructureDialog.mode
        )
        : [];
  const groupStructureOptionCount =
    groupStructureDialog?.mode === "group" &&
    groupStructureOption?.blocks[groupStructureDialog.blockIndex]?.type === "TEAM"
      ? getTeamCount(groupStructureOption, groupStructureDialog.blockIndex)
      : groupStructureDialog?.mode === "group" &&
          groupStructureOption?.blocks[groupStructureDialog.blockIndex]?.type === "DOUBLES"
        ? Math.floor(effectiveFormationPlayerCount / 2)
      : effectiveFormationPlayerCount;
  const groupStructureOptions = useMemo(
    () => generateGroupOptions(groupStructureOptionCount),
    [groupStructureOptionCount],
  );
  const isGroupStructureTeam = groupStructureDialog?.mode === "team";
  const groupResultOption =
    groupResultDialog !== null
      ? displayedProgramOptions[groupResultDialog.optionIndex]
      : undefined;
  const groupResultSizes =
    groupResultDialog !== null && groupResultOption
      ? getStructureSizes(
          groupResultOption,
          groupResultDialog.blockIndex,
          groupResultDialog.mode
        )
      : [];
  const isGroupResultTeam = groupResultDialog?.mode === "team";
  const groupResultRound = groupResultOption && groupResultDialog
    ? groupResultOption.rounds?.[groupResultDialog.blockIndex]
    : undefined;
  const groupResultBlock = groupResultOption && groupResultDialog
    ? groupResultOption.blocks[groupResultDialog.blockIndex]
    : undefined;
  const defaultFormationSeed = groupResultDialog ? (groupResultDialog.blockIndex + 1) * 1000 : 0;
  const teamShuffleSeed = groupResultRound?.teamShuffleSeed ?? groupResultBlock?.teamShuffleSeed ?? defaultFormationSeed + 101;
  const groupShuffleSeed = groupResultRound?.groupShuffleSeed ?? groupResultBlock?.groupShuffleSeed ?? defaultFormationSeed + 503;
  const teamFormationPlayers = reshuffleWithinLevel(
    groupPlayers.slice(0, effectiveFormationPlayerCount),
    teamShuffleSeed,
  );
  const savedTeamAssignments = groupResultRound?.teamAssignments ?? groupResultBlock?.teamAssignments;
  const teamResultGroups =
    groupResultOption && groupResultDialog
      ? savedTeamAssignments?.length
        ? savedTeamAssignments.map((players, index) => ({ name: `${String.fromCharCode(65 + index)}팀`, players }))
        : buildFormationUnits(
            teamFormationPlayers,
            Math.max(1, groupResultRound?.teamPlayerCount ?? 4),
            groupResultRound?.unitClubMode ?? groupResultBlock?.unitClubMode ?? "mixed",
          ).map((group, index) => ({ ...group, name: `${String.fromCharCode(65 + index)}팀` }))
      : [];
  const savedDoublesAssignments = groupResultRound?.doublesAssignments ?? groupResultBlock?.doublesAssignments;
  const doublesResultGroups = groupResultOption && groupResultDialog
    ? savedDoublesAssignments?.length
      ? savedDoublesAssignments.map((players, index) => ({ name: `${index + 1}복식`, players }))
      : buildFormationUnits(
          teamFormationPlayers,
          2,
          groupResultRound?.unitClubMode ?? groupResultBlock?.unitClubMode ?? "mixed",
        ).filter((group) => group.players.length === 2)
    : [];
  const teamUnits = teamResultGroups.map((team, teamIndex) => {
    const leader = team.players[0];
    return {
      name: `팀 ${leader?.name ?? teamIndex + 1}`,
      level: leader?.level ?? teamIndex + 1,
      roster: team.players,
      sourceGroupId: formationClubIds({ name: "", level: 0, roster: team.players }).length === 1
        ? formationClubIds({ name: "", level: 0, roster: team.players })[0]
        : null,
    };
  });
  const { data: invitedGroupsData } = useGetLeagueInvitedGroupsQuery(leagueId ?? "", { skip: !leagueId });
  const clubPoliciesEnabled = hasParticipatingClubs || Boolean(invitedGroupsData?.groups?.length);
  const doublesUnits = doublesResultGroups.map((pair, pairIndex) => ({
    name: pair.players.map((player) => formatFormationName(player.name, player.level)).join(" · "),
    level: pairIndex + 1,
    roster: pair.players,
    sourceGroupId: formationClubIds({ name: "", level: 0, roster: pair.players }).length === 1
      ? formationClubIds({ name: "", level: 0, roster: pair.players })[0]
      : null,
  }));
  const savedFormationAssignments = groupResultDialog?.mode === "team"
    ? groupResultRound?.teamAssignments ?? groupResultBlock?.teamAssignments
    : groupResultDialog?.mode === "doubles"
      ? savedDoublesAssignments
      : groupResultRound?.groupAssignments ?? groupResultBlock?.groupAssignments;
  const calculatedDialogGroupResult =
    groupResultSizes.length > 0
      ? groupResultDialog?.mode === "team"
        ? teamResultGroups
        : groupResultDialog?.mode === "doubles"
          ? doublesResultGroups
        : groupResultDialog?.mode === "group" && groupResultOption?.blocks[groupResultDialog.blockIndex]?.type === "TEAM"
          ? (groupResultRound?.crossClubGrouping ?? groupResultBlock?.crossClubGrouping
              ? distributeFormationClubAware(reshuffleWithinLevel(teamUnits, groupShuffleSeed), groupResultSizes)
              : distributeSnake(reshuffleWithinLevel(teamUnits, groupShuffleSeed), groupResultSizes))
          : groupResultDialog?.mode === "group" && groupResultOption?.blocks[groupResultDialog.blockIndex]?.type === "DOUBLES"
            ? (groupResultRound?.crossClubGrouping ?? groupResultBlock?.crossClubGrouping
                ? distributeFormationClubAware(reshuffleWithinLevel(doublesUnits, groupShuffleSeed), groupResultSizes)
                : distributeSnake(reshuffleWithinLevel(doublesUnits, groupShuffleSeed), groupResultSizes))
          : (groupResultRound?.crossClubGrouping ?? groupResultBlock?.crossClubGrouping
              ? distributeFormationClubAware(reshuffleWithinLevel(groupPlayers.slice(0, effectiveFormationPlayerCount), groupShuffleSeed), groupResultSizes)
              : distributeSnake(reshuffleWithinLevel(groupPlayers.slice(0, effectiveFormationPlayerCount), groupShuffleSeed), groupResultSizes))
      : [];
  const dialogGroupResult = savedFormationAssignments?.length
    ? savedFormationAssignments.map((players, index) => ({
        name: groupResultDialog?.mode === "team"
          ? `${String.fromCharCode(65 + index)}팀`
          : groupResultDialog?.mode === "doubles" ? `${index + 1}복식` : `${index + 1}조`,
        players,
      }))
    : calculatedDialogGroupResult;
  const isDoublesGroupResult = groupResultDialog?.mode === "group" && groupResultBlock?.type === "DOUBLES";

  const beginFormationEditing = () => {
    setFormationDraft(dialogGroupResult.map((group) => group.players.map((player) => ({ ...player }))));
    setIsFormationEditing(true);
  };

  const findFormationContainer = (groups: FormationAssignmentPlayer[][], id: string) => {
    if (id.startsWith("formation-group-")) return Number(id.replace("formation-group-", ""));
    return groups.findIndex((group) => group.some((player) => formationPlayerId(player) === id));
  };

  const handleFormationDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setFormationDraft((previous) => {
      const from = findFormationContainer(previous, activeId);
      const to = findFormationContainer(previous, overId);
      if (from < 0 || to < 0 || from === to) return previous;
      const next = previous.map((group) => [...group]);
      const itemIndex = next[from].findIndex((player) => formationPlayerId(player) === activeId);
      if (itemIndex < 0) return previous;
      const [item] = next[from].splice(itemIndex, 1);
      const overIndex = next[to].findIndex((player) => formationPlayerId(player) === overId);
      next[to].splice(overIndex < 0 ? next[to].length : overIndex, 0, item);
      return next;
    });
  };

  const handleFormationDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setFormationDraft((previous) => {
      const container = findFormationContainer(previous, activeId);
      const overContainer = findFormationContainer(previous, overId);
      if (container < 0 || container !== overContainer) return previous;
      const oldIndex = previous[container].findIndex((player) => formationPlayerId(player) === activeId);
      const newIndex = previous[container].findIndex((player) => formationPlayerId(player) === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return previous;
      const next = previous.map((group) => [...group]);
      next[container] = arrayMove(next[container], oldIndex, newIndex);
      return next;
    });
  };

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '430px',
        margin: '0 auto',
        backgroundColor: "#ffffff",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {!hideHeader && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <IconButton
          size="small"
          onClick={() => {
            if (onBack) {
              onBack();
            } else if (isEditMode && leagueId) {
              navigate(`/league/${leagueId}`);
            } else if (leagueId) {
              navigate(`/league/${leagueId}/program`);
            } else {
              navigate(-1);
            }
          }}
          sx={{
            mr: 0.5,
            color: "#111827",
          }}
          aria-label="프로그램 목록으로 돌아가기"
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <div
          style={{
            fontSize: "17px",
            fontWeight: 900,
            lineHeight: 1.35,
          }}
        >
          {isEditMode ? "프로그램 수정" : "이벤트 프로그램 생성"}
        </div>
      </div>
      )}

      <div style={{ marginTop: '24px', display: shouldHideSetupInputs ? "none" : undefined }}>
        <div style={{
          fontWeight: 700,
          marginBottom: '8px',
        }}>
        참가자 수
      </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={playerCount}
          onChange={(e) =>
            setPlayerCount(
              Number(
                e.target.value.replace(
                  /[^0-9]/g,
                  ""
                )
              )
            )
          }
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '8px',
            fontSize: '16px',
          }}
        />
      </div>

      <div style={{ marginTop: '24px', display: shouldHideSetupInputs ? "none" : undefined }}>
        <div style={{
          fontWeight: 700,
          marginBottom: '8px',
        }}>
        탁구대 수
      </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={courtCount}
          onChange={(e) =>
            setCourtCount(
              Number(
                e.target.value.replace(
                  /[^0-9]/g,
                  ""
                )
              )
            )
          }
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '8px',
            fontSize: '16px',
          }}
        />
      </div>

      <div style={{ marginTop: "24px", display: shouldHideSetupInputs ? "none" : undefined }}>
        <div
          style={{
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          대관 시간
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <select
            value={startHour}
            onChange={(e) =>
              setStartHour(Number(e.target.value))
            }
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
            }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}
              </option>
            ))}
          </select>

          <span>:</span>

          <select
            value={startMinute}
            onChange={(e) =>
              setStartMinute(Number(e.target.value))
            }
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
            }}
          >
            {[0, 10, 20, 30, 40, 50].map((m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>

          <span>~</span>

          <select
            value={endHour}
            onChange={(e) =>
              setEndHour(Number(e.target.value))
            }
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
            }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}
              </option>
            ))}
          </select>

          <span>:</span>

          <select
            value={endMinute}
            onChange={(e) =>
              setEndMinute(Number(e.target.value))
            }
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "16px",
            }}
          >
            {[0, 10, 20, 30, 40, 50].map((m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={isGeneratingProgram}
        onClick={() => {
          setIsGeneratingProgram(true);
          setIsProgramGenerated(false);
          setIsCustomProgramCompleted(false);
          setCustomProgramOptions({});
          window.setTimeout(() => {
            setIsProgramGenerated(true);
            setIsGeneratingProgram(false);
          }, 600);
        }}
        style={{ marginTop: "30px", display: shouldHideSetupInputs ? "none" : undefined }}
      >
        프로그램 생성하기
      </Button>

      {isGeneratingProgram && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "40px",
            marginBottom: "20px",
          }}
        >
          <CircularProgress size={42} thickness={4} />
        </div>
      )}

      {isProgramGenerated && !isGeneratingProgram && !hideModeTabs && (
      <div style={{ marginTop: shouldHideSetupInputs ? "24px" : "60px" }}>
        <ToggleButtonGroup
          exclusive
          value={programMode}
          onChange={(_, value) => {
            if (value) setProgramMode(value);
          }}
          fullWidth
        >
          <ToggleButton value="recommend">
            추천 프로그램
          </ToggleButton>

          <ToggleButton value="custom">
            직접 구성하기
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      )}

      {isProgramGenerated && programMode === "custom" && (
      <div style={{ marginTop: "24px" }}>
        <div
          style={{
            fontWeight: 700,
            marginBottom: "12px",
          }}
        >
          라운드 구성
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rounds.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >

        {rounds.map((round, roundIndex) => (
          <div
            key={round.id}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
              style={{
                fontWeight: 700,
                minWidth: "70px",
                cursor: "pointer",
              }}
              onClick={() => {
                setRounds(
                  rounds.map((x) =>
                    x.id === round.id
                      ? {
                          ...x,
                          expanded: !x.expanded,
                        }
                      : x
                  )
                );
              }}
            >
              {round.id}라운드
            </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <DragHandleIcon
                  sx={{
                    color: "rgb(209, 213, 219)",
                  }}
                />
              </div>

              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={() => {
                  setRounds(
                    rounds
                      .filter((x) => x.id !== round.id)
                      .map((item, index, remaining) => ({
                        ...item,
                        id: index + 1,
                        option: remaining.length === 1 ? "NONE" : index === 0 ? "PRELIM" : item.option,
                        sourceRoundId: index > 0 ? index : undefined,
                      }))
                  );
                }}
              >
                삭제
              </Button>
            </div>
           
            <ToggleButtonGroup
              exclusive
              value={round.program}
              onChange={(_, value) => {
                if (!value) return;

                setRounds(
                  rounds.map((x) =>
                    x.id === round.id
                      ? {
                          ...x,
                          program: value,
                        }
                      : x
                  )
                );
              }}
              fullWidth
            >
              <ToggleButton value="SINGLES">
                단식
              </ToggleButton>

              <ToggleButton value="DOUBLES">
                복식
              </ToggleButton>

              <ToggleButton value="TEAM">
                단체전
              </ToggleButton>
            </ToggleButtonGroup>

            <div style={{ marginTop: "16px" }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  진행방식
                </div>

                <ToggleButtonGroup
                  exclusive
                  value={round.format}
                  fullWidth
                  onChange={(_, value) => {
                    if (!value) return;

                    setRounds(
                      rounds.map((x) =>
                        x.id === round.id
	                          ? {
	                              ...x,
	                              format: value,
                                option: rounds.length === 1 ? "NONE" : "PRELIM",
                                tournamentMode: value === "TOURNAMENT" ? "single" : undefined,
                                finalAdvancementMode: "top-n",
                                advanceCount: x.advanceCount ?? 2,
                                sourceRoundId: roundIndex > 0 ? rounds[roundIndex - 1].id : undefined,
                                tournamentSeeding:
                                  value === "TOURNAMENT"
                                    ? x.tournamentSeeding ?? "seed"
                                    : x.tournamentSeeding,
                                tournamentBracketCount:
                                  value === "TOURNAMENT"
                                    ? x.tournamentBracketCount ?? 1
                                    : 1,
	                            }
                          : x
                      )
                    );
                  }}
                >
                  <ToggleButton value="LEAGUE">
                    단일리그
                  </ToggleButton>

                  <ToggleButton value="GROUP">
                    조별리그
                  </ToggleButton>

                  <ToggleButton value="TOURNAMENT">
                    토너먼트
                  </ToggleButton>
	                </ToggleButtonGroup>

                  {round.format === "TOURNAMENT" && (
                    <div style={{ marginTop: "16px" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: "8px",
                        }}
                      >
                        배치 방식
                      </div>

                      <ToggleButtonGroup
                        exclusive
                        value={round.tournamentSeeding ?? "seed"}
                        fullWidth
                        onChange={(_, value) => {
                          if (!value) return;

                          setRounds(
                            rounds.map((x) =>
                              x.id === round.id
                                ? {
                                    ...x,
                                    tournamentSeeding: value,
                                  }
                                : x
                            )
                          );
                        }}
                      >
                        <ToggleButton value="seed">
                          시드(순위)
                        </ToggleButton>

                        <ToggleButton value="random">
                          랜덤
                        </ToggleButton>

                        <ToggleButton value="manual">
                          수동
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </div>
                  )}

                  <RoundDivisionEditor
                    round={round}
                    roundIndex={roundIndex}
                    rounds={rounds}
                    setRounds={setRounds}
                  />
                  <div style={{ marginTop: "16px" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      경기방식
                    </div>

                    <ToggleButtonGroup
                      exclusive
                      value={round.matchRule}
                      fullWidth
                      onChange={(_, value) => {
                        if (!value) return;

                        setRounds(
                          rounds.map((x) =>
                            x.id === round.id
                              ? {
                                  ...x,
                                  matchRule: value,
                                }
                              : x
                          )
                        );
                      }}
                    >
                      <ToggleButton value="BEST_OF_3">
                        3전 2선승제
                      </ToggleButton>

                      <ToggleButton value="BEST_OF_5">
                        5전 3선승제
                      </ToggleButton>

                      <ToggleButton value="THREE_SET">
                        3세트제
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </div>
                  <ClubPolicyControls round={round} enabled={clubPoliciesEnabled} onChange={(patch) => setRounds(rounds.map((item) => item.id === round.id ? { ...item, ...patch } : item))} />
                </div>

            {round.program === "TEAM" && (
              <div style={{ marginTop: "16px" }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  팀 인원
                </div>

                <ToggleButtonGroup
                  exclusive
                  value={round.teamPlayerCount}
                  fullWidth
                  onChange={(_, value) => {
                    if (!value) return;

                    setRounds(
                      rounds.map((x) =>
                        x.id === round.id
                          ? {
                              ...x,
                              teamPlayerCount: value,
                            }
                          : x
                      )
                    );
                  }}
                >
                  <ToggleButton value={2}>
                    2명
                  </ToggleButton>

                  <ToggleButton value={3}>
                    3명
                  </ToggleButton>

                  <ToggleButton value={4}>
                    4명
                  </ToggleButton>

                  <ToggleButton value={5}>
                    5명
                  </ToggleButton>
                </ToggleButtonGroup>

                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                    >
                      단체전 구성
                    </div>
                    <Stack spacing={1}>
                      <MatchCountStepper
                        label="단식"
                        value={getTeamMatchCounts(round).singles}
                        onChange={(value) => setRounds(rounds.map((x) => x.id === round.id ? { ...x, teamSinglesCount: value } : x))}
                      />
                      <MatchCountStepper
                        label="복식"
                        value={getTeamMatchCounts(round).doubles}
                        onChange={(value) => setRounds(rounds.map((x) => x.id === round.id ? { ...x, teamDoublesCount: value } : x))}
                      />
                    </Stack>
                  </div>
              </div>
            )}
          </div>
        ))}
        </SortableContext>
      </DndContext>

        <Button
          variant="outlined"
          fullWidth
          onClick={() => {
            setRounds([
              ...rounds.map((item, index) => ({
                ...item,
                option: index === 0 ? "PRELIM" as const : item.option,
              })),
              {
                id: rounds.length + 1,
                expanded: true,
                program: "SINGLES",
                format: "GROUP",
                option: "PRELIM",
                matchRule: "BEST_OF_3",
                teamPlayerCount: 4,
                teamMatchType: "SSS",
                tournamentSeeding: "seed",
                tournamentBracketCount: 1,
                tournamentMode: "single",
                finalAdvancementMode: "top-n",
                advanceCount: 2,
                sourceRoundId: rounds.length,
              },
            ]);
          }}
        >
          + 라운드 추가
        </Button>

        <Button
          variant="contained"
          fullWidth
          disabled={isCompletingCustomProgram}
          onClick={() => {
            setIsCompletingCustomProgram(true);
            setIsCustomProgramCompleted(false);
            // 직접 구성 완료 시 복원된 과거 추천안보다 현재 라운드 설정을 우선한다.
            setCustomProgramOptions({});
            window.setTimeout(() => {
              setIsCustomProgramCompleted(true);
              setIsCompletingCustomProgram(false);
            }, 600);
          }}
          style={{ marginTop: "12px" }}
        >
          완료
        </Button>
        {isCompletingCustomProgram && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "32px",
              marginBottom: "12px",
            }}
          >
            <CircularProgress size={42} thickness={4} />
          </div>
        )}
      </div>
      )}

      {isProgramGenerated && !isGeneratingProgram && !isCompletingCustomProgram && (
        programMode === "recommend" ||
        (programMode === "custom" && isCustomProgramCompleted)
      ) && (
      <>
{!hideRecommendationTitle && (
  <h2 style={{ marginTop: '40px' }}>
    프로그램 추천안
  </h2>
)}

{displayedProgramOptions.length === 0 && (
  <div
    style={{
      marginTop: '16px',
      padding: '20px',
      borderRadius: '12px',
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      fontWeight: 600,
    }}
  >
    현재 조건으로는 추천 가능한
    프로그램이 없습니다.
    <br />
    대관시간을 늘리거나
    프로그램 수를 줄여보세요.
  </div>
)}

{displayedProgramOptions.slice(0, 3).map((option, index) => (
  <div
    key={index}
    onClick={() => setSelectedProgramOptionIndex(index)}
    style={{
      border:
        selectedProgramOptionIndex === index
          ? '2px solid rgb(47, 128, 237)'
          : '1px solid #ddd',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '12px',
      backgroundColor:
        selectedProgramOptionIndex === index
          ? 'rgb(239, 246, 255)'
          : '#ffffff',
      cursor: 'pointer',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
        }}
      >
        <Radio
          checked={selectedProgramOptionIndex === index}
          onChange={() => setSelectedProgramOptionIndex(index)}
          onClick={(event) => event.stopPropagation()}
          inputProps={{
            "aria-label": `${option.title} 선택`,
          }}
          sx={{
            p: 0,
            color: '#9ca3af',
            '&.Mui-checked': {
              color: 'rgb(47, 128, 237)',
            },
          }}
        />

        <h3 style={{ margin: 0 }}>
          {option.title}
        </h3>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#f59e0b',
          }}
        >
          {getStars(option.recommendationScore)}
        </div>

        <IconButton
          size="small"
          aria-label="추천 프로그램 수정"
          onClick={(event) => {
            event.stopPropagation();
            openProgramEditDialog(index);
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  <div style={{ paddingLeft: '16px'}}>
    <div>
      - 총 경기수: {option.totalBlockMatchCount}경기
    </div>

    <div>
      - 1인 평균 경기수: {(
        option.blocks.reduce(
          (sum, block) => {
            if (block.type === "SINGLES") {
              return sum + block.matchCount * 2;
            }

            if (block.type === "DOUBLES") {
              return sum + block.matchCount * 4;
            }

            if (block.type === "TEAM") {
              return sum + block.matchCount * 2;
            }

            return sum;
          },
          0
        ) / playerCount
      ).toFixed(1)}경기
    </div>

    <div>
      - 예상 소요시간:{" "}
      {Math.floor(option.totalProgramMinutes / 60) > 0 &&
        `${Math.floor(option.totalProgramMinutes / 60)}시간 `}
      {option.totalProgramMinutes % 60}분
    </div>

    {option.isOverTime && (
      <div
        style={{
          color: "red",
          fontWeight: 700,
        }}
      >
        ⚠️ 대관시간 초과
      </div>
    )}

    <div
      style={{
        marginTop: '12px',
        paddingLeft: '12px',
      }}
    >
      {option.blocks?.map(
        (
          block: ProgramBlock,
          blockIndex: number
        ) => {
          const elapsedMinutes = option.blocks
            .slice(0, blockIndex)
            .reduce(
              (sum, previousBlock) =>
                sum + previousBlock.expectedMinutes,
              0
            );
          const blockStartMinutes =
            block.startMinutes ??
            rentalStartMinutes + elapsedMinutes;
          const blockEndMinutes =
            block.endMinutes ??
            blockStartMinutes + block.expectedMinutes;

          return (
          <div
            key={blockIndex}
            style={{
              marginBottom:
                blockIndex === option.blocks.length - 1
                  ? 0
                  : "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  lineHeight: "24px",
                }}
              >
                {blockIndex + 1}라운드
              </span>

              {option.rounds?.[blockIndex]?.option &&
                option.rounds[blockIndex].option !== "NONE" && (
                  <Chip
                    label={
                      block.format === "TOURNAMENT"
                        ? `${option.rounds[blockIndex].option === "PRELIM" ? "예선" : "본선"}(${block.tournamentMode === "upper-lower" ? "상·하위" : "일반"})`
                        : option.rounds[blockIndex].option === "PRELIM"
                        ? "예선"
                        : option.rounds[blockIndex].option === "FINAL"
                          ? "본선"
                          : option.rounds[blockIndex].option === "UPPER"
                            ? "상위"
                            : "하위"
                    }
                    size="small"
                  />
                )}

              <Chip
                label={
                  block.type === "SINGLES"
                    ? "단식"
                    : block.type === "DOUBLES"
                      ? "복식"
                      : "단체전"
                }
                size="small"
              />

              <Chip
                label={getRoundFormatLabel(block.format)}
                size="small"
              />
            </div>

            <div style={{ paddingLeft: '12px' }}>
              경기방식: {block.matchRule}
            </div>
            
          {block.description && (
            <div style={{ paddingLeft: '12px' }}>
              구성: {block.description}
            </div>
          )}

            <div style={{ paddingLeft: '12px' }}>
              경기수: {block.matchCount}경기
            </div>

            {option.rounds?.[blockIndex]?.option === "FINAL" && block.format === "LEAGUE" && (
              <div style={{ paddingLeft: "12px" }}>
                본선 진출: 이전 라운드 상위 {block.advanceCount ?? 2}명
              </div>
            )}

            {option.rounds?.[blockIndex]?.option === "FINAL" && block.format === "GROUP" && (
              <div style={{ paddingLeft: "12px" }}>
                본선 편성: {block.finalAdvancementMode === "upper-lower-groups"
                  ? "상·하위부"
                  : block.finalAdvancementMode === "rank-groups"
                    ? "순위대로"
                    : `상위 ${block.advanceCount ?? 2}명`}
              </div>
            )}

            <div style={{ paddingLeft: '12px' }}>
              예상시간:{" "}
              {Math.floor(block.expectedMinutes / 60) > 0 &&
                `${Math.floor(block.expectedMinutes / 60)}시간 `}
              {block.expectedMinutes % 60}분
            </div>

            <div style={{ paddingLeft: '12px' }}>
              진행시간: {formatTime(blockStartMinutes)} ~{" "}
              {formatTime(blockEndMinutes)}
            </div>

            {!hideFormationActions && block.type === "TEAM" && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "8px",
                  paddingLeft: "12px",
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    openGroupStructureDialog(index, blockIndex, "team")
                  }}
                >
                  팀 편성 구조
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  sx={{
                    color: "#FFFFFF",
                    backgroundColor: "#1976D2",
                    borderColor: "#1976D2",
                    "&:hover": {
                      backgroundColor: "#1565C0",
                      borderColor: "#1976D2",
                    },
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setGroupResultDialog({
                      optionIndex: index,
                      blockIndex,
                      mode: "team",
                    })
                  }}
                >
                  팀 편성 결과
                </Button>
              </div>
            )}

            {!hideFormationActions && block.type === "DOUBLES" && (
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", paddingLeft: "12px" }}>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ color: "#FFFFFF", backgroundColor: "#1976D2", borderColor: "#1976D2", "&:hover": { backgroundColor: "#1565C0", borderColor: "#1976D2" } }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setGroupResultDialog({ optionIndex: index, blockIndex, mode: "doubles" });
                  }}
                >
                  복식 편성 결과
                </Button>
              </div>
            )}

            {!hideFormationActions && block.format === "GROUP" && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "8px",
                  paddingLeft: "12px",
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    openGroupStructureDialog(index, blockIndex, "group")
                  }}
                >
                  조 편성 구조
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  sx={{
                    color: "#FFFFFF",
                    backgroundColor: "#1976D2",
                    borderColor: "#1976D2",
                    "&:hover": {
                      backgroundColor: "#1565C0",
                      borderColor: "#1976D2",
                    },
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setGroupResultDialog({
                      optionIndex: index,
                      blockIndex,
                      mode: "group",
                    })
                  }}
                >
                  조 편성 결과
                </Button>
              </div>
            )}
          </div>
          );
        }
      )}
    </div>
  </div>
    </div>
))}

      </>
      )}
      <Dialog
        open={editingOptionIndex !== null}
        onClose={closeProgramEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          프로그램 추천안 수정
        </DialogTitle>

        <DialogContent dividers>
          <RoundConfigEditor
            rounds={editingRounds}
            setRounds={setEditingRounds}
            clubPoliciesEnabled={clubPoliciesEnabled}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={closeProgramEditDialog}>
            취소
          </Button>

          <Button
            variant="contained"
            onClick={completeProgramEdit}
          >
            완료
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={groupStructureDialog !== null}
        onClose={closeGroupStructureDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isGroupStructureTeam ? "팀 편성 구조" : "조 편성 구조"}
        </DialogTitle>

        <DialogContent dividers>
          {groupStructureOptions.map((option) => {
            const selected = sameGroupSizes(
              groupStructureSizes,
              option.groups
            );

            return (
              <div
                key={`${option.tierSize}-${option.groupCount}`}
                onClick={() => {
                  setPendingGroupSizes(option.groups);
                }}
                style={{
                  border: selected
                    ? '2px solid #3b82f6'
                    : '1px solid #d1d5db',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                  backgroundColor: selected
                    ? '#eff6ff'
                    : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {option.recommended && (
                  <div
                    style={{
                      color: '#2563eb',
                      fontWeight: 700,
                      marginBottom: '12px',
                    }}
                  >
                    추천
                  </div>
                )}

                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  {option.groupCount}개 {isGroupStructureTeam ? "팀" : "조"}
                </div>

                <div
                  style={{
                    marginTop: '8px',
                    color: '#6b7280',
                  }}
                >
                  {option.groups.map((g) => `${g}인`).join(' / ')}
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#9ca3af',
                  }}
                >
                  score: {option.score}
                </div>
              </div>
            );
          })}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeGroupStructureDialog}>
            취소
          </Button>

          <Button
            variant="contained"
            onClick={completeGroupStructureDialog}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={groupResultDialog !== null}
        onClose={() => {
          setGroupResultDialog(null);
          setIsFormationEditing(false);
          setFormationDraft([]);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>
          {isGroupResultTeam ? "팀 편성 결과" : groupResultDialog?.mode === "doubles" ? "복식 편성 결과" : "조 편성 결과"}
          {isEditMode && !isFormationEditing && (
            <Tooltip title="수동 편성">
              <IconButton size="small" onClick={beginFormationEditing} aria-label="수동 편성">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>

        <DialogContent dividers>
          {isFormationEditing ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleFormationDragOver} onDragEnd={handleFormationDragEnd}>
              <Typography sx={{ mb: 1.5, fontSize: 12, color: "text.secondary" }}>
                참가자를 길게 눌러 원하는 곳으로 이동해 주세요.
              </Typography>
              {groupResultDialog?.mode === "doubles" && (
                <Typography sx={{ mb: 1.5, fontSize: 12, color: formationDraft.every((group) => group.length === 2) ? "text.secondary" : "error.main" }}>
                  각 복식 조합은 정확히 2명으로 구성해 주세요.
                </Typography>
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.25 }}>
                {formationDraft.map((players, index) => (
                  <FormationEditCard
                    key={index}
                    players={players}
                    index={index}
                    label={isGroupResultTeam ? `${String.fromCharCode(65 + index)}팀` : groupResultDialog?.mode === "doubles" ? `${index + 1}복식` : `${index + 1}조`}
                  />
                ))}
              </Box>
            </DndContext>
          ) : (
            <Box
              key={`${groupResultDialog?.optionIndex ?? "x"}-${groupResultDialog?.blockIndex ?? "x"}-${groupResultDialog?.mode ?? "x"}-${teamShuffleSeed}-${groupShuffleSeed}`}
              sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.25 }}
            >
              {dialogGroupResult.map((group, groupIndex) => {
                const accent = FORMATION_COLORS[groupIndex % FORMATION_COLORS.length];
                return (
                  <Box key={group.name} sx={{ border: "1px solid #E5E7EB", borderTop: `3px solid ${accent}`, borderRadius: 1.5, overflow: "hidden", bgcolor: "#FFF" }}>
                    <Box sx={{ px: 1.5, py: 1.1, bgcolor: "#F8FAFC", display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 900 }}>{isGroupResultTeam ? `${String.fromCharCode(65 + groupIndex)}팀` : groupResultDialog?.mode === "doubles" ? group.players.map((player) => formatFormationName(player.name, player.level)).join(" · ") : group.name}</Typography>
                      <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 700 }}>
                        {group.players.length}{isDoublesGroupResult ? "팀" : "명"}
                      </Typography>
                    </Box>
                    <Stack spacing={0.65} sx={{ px: 1.5, py: 1.25 }}>
                      {group.players.map((player) => {
                        const assignedPlayer = player as FormationAssignmentPlayer;
                        const roster = assignedPlayer.roster;
                        return (
                          <Box key={player.name}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                              {isDoublesGroupResult && roster
                                ? formatFormationName(player.name, player.level)
                                : `${player.level}부 - ${formatFormationName(player.name, player.level)}`}
                            </Typography>
                            {roster && <Box sx={{ pl: isDoublesGroupResult ? 0 : 1.25, mt: 0.4 }}>{roster.map((member) => <Typography key={member.name} sx={{ fontSize: 12, color: "text.secondary" }}>{member.level}부 - {formatFormationName(member.name, member.level)}</Typography>)}</Box>}
                          </Box>
                        );
                      })}
                    </Stack>
                    <Divider />
                    <Box sx={{ px: 1.5, py: 0.9 }}>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 700 }}>
                        합 <Box component="span" sx={{ color: accent, fontWeight: 900 }}>{formationLevelSum(group.players)}부</Box>
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          {isFormationEditing ? (
            <>
              <Button onClick={() => { setIsFormationEditing(false); setFormationDraft([]); }}>취소</Button>
              <Button
                variant="contained"
                onClick={saveManualFormation}
                disabled={groupResultDialog?.mode === "doubles" && formationDraft.some((group) => group.length !== 2)}
              >
                완료
              </Button>
            </>
          ) : groupResultDialog && (
            <Button
              variant="outlined"
              onClick={() => {
                updateProgramRoundShuffleSeed(
                  groupResultDialog.optionIndex,
                  groupResultDialog.blockIndex,
                  groupResultDialog.mode
                );
              }}
            >
              재편성
            </Button>
          )}
          {!isFormationEditing && <Button onClick={() => setGroupResultDialog(null)}>
            닫기
          </Button>}
        </DialogActions>
      </Dialog>

      {isProgramGenerated && (
        programMode === "recommend" ||
        (programMode === "custom" && isCustomProgramCompleted)
      ) && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(56px + env(safe-area-inset-bottom) + 16px)",
            transform: "translateX(-50%)",
            width: compactCompleteButton
              ? "min(360px, calc(100% - 48px))"
              : "min(430px, calc(100% - 32px))",
            zIndex: 1200,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            disabled={selectedProgramOptionIndex === null}
            onClick={completeProgramCreation}
            style={{
              height: "48px",
              borderRadius: "12px",
              fontWeight: 800,
            }}
          >
            완료
          </Button>
        </div>
      )}
    </div>
  );
};

export default LeagueAlgorithmDemo;
