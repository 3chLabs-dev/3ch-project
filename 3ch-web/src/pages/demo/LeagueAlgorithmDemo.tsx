import { generateProgramOptions } from '../../features/league/algorithms/generateProgramOptions';
import { generateProgramBlocks } from '../../features/league/algorithms/generateProgramBlocks';
import { distributeSnake } from '../../features/league/algorithms/distributeSnake';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { generateGroupOptions } from '../../features/league/algorithms/generateGroupOptions';
import { useGetLeagueParticipantsQuery, useGetLeagueProgramQuery, useSaveLeagueProgramMutation, useSyncLeagueProgramMatchesMutation } from '../../features/league/leagueApi';
import type { ProgramBlock, ProgramOption, ProgramType, TeamMatchType, RoundConfig } from '../../features/league/types/tournament.types';
import { ToggleButton, ToggleButtonGroup, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip, Checkbox, CircularProgress } from "@mui/material";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, } from "@dnd-kit/sortable";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { generateProgramRoundMatches } from '../../utils/programMatchGenerator';

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
}

function RoundConfigEditor({
  rounds,
  setRounds,
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
          {rounds.map((round) => (
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
                        .map((x, index) => ({
                          ...x,
                          id: index + 1,
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
                                  tournamentSeeding:
                                    value === "TOURNAMENT"
                                      ? x.tournamentSeeding ?? "seed"
                                      : x.tournamentSeeding,
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

	                  <div style={{ marginTop: "16px" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      옵션
                    </div>

                    <ToggleButtonGroup
                      exclusive
                      value={round.option}
                      fullWidth
                      onChange={(_, value) => {
                        if (!value) return;

                        setRounds(
                          rounds.map((x) =>
                            x.id === round.id
                              ? {
                                  ...x,
                                  option: value,
                                }
                              : x
                          )
                        );
                      }}
                    >
                      <ToggleButton value="NONE">
                        없음
                      </ToggleButton>

                      <ToggleButton value="PRELIM">
                        예선
                      </ToggleButton>

                      <ToggleButton value="FINAL">
                        본선
                      </ToggleButton>

                      <ToggleButton value="UPPER">
                        상위
                      </ToggleButton>

                      <ToggleButton value="LOWER">
                        하위
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </div>
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

                    <ToggleButtonGroup
                      exclusive
                      value={round.teamMatchType}
                      fullWidth
                      onChange={(_, value) => {
                        if (!value) return;

                        setRounds(
                          rounds.map((x) =>
                            x.id === round.id
                              ? {
                                  ...x,
                                  teamMatchType: value,
                                }
                              : x
                          )
                        );
                      }}
                    >
                      <ToggleButton value="SSS">
                        단단단
                      </ToggleButton>

                      <ToggleButton value="SDS">
                        단복단
                      </ToggleButton>

                      <ToggleButton value="DSD">
                        복단복
                      </ToggleButton>

                      <ToggleButton value="DDD">
                        복복복
                      </ToggleButton>
                    </ToggleButtonGroup>
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
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="contained"
        fullWidth
        onClick={() => {
          setRounds([
            ...rounds,
            {
              id: rounds.length + 1,
              expanded: true,
              program: "SINGLES",
              format: "GROUP",
              option: "NONE",
              matchRule: "BEST_OF_3",
              teamPlayerCount: 4,
              teamMatchType: "SSS",
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
}

const LeagueAlgorithmDemo = ({
  initialPlayerCount = 24,
}: LeagueAlgorithmDemoProps) => {
  const navigate = useNavigate();
  const { id: leagueId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";
  const restoredRef = useRef(false);
  const skipNextResetRef = useRef(false);
  const { data: participantData } = useGetLeagueParticipantsQuery(leagueId ?? "", {
    skip: !leagueId,
  });
  const { data: savedProgramData } = useGetLeagueProgramQuery(leagueId ?? "", {
    skip: !leagueId || !isEditMode,
  });
  const [saveLeagueProgram] = useSaveLeagueProgramMutation();
  const [syncLeagueProgramMatches] = useSyncLeagueProgramMatchesMutation();
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [courtCount, setCourtCount] = useState(4);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(15);
  const [endMinute, setEndMinute] = useState(0);
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
  const [pendingGroupSizes, setPendingGroupSizes] = useState<number[]>([]);
  const [groupResultDialog, setGroupResultDialog] = useState<{
    optionIndex: number;
    blockIndex: number;
    mode: "team" | "group";
  } | null>(null);

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
        name: participant.division
          ? `${participant.name} (${participant.division})`
          : participant.name,
        level: Number.isNaN(parsedLevel) ? 999 : parsedLevel,
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
        )
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
        (fixedTitle) => fixedTitle === title
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
    if (!isEditMode || !leagueId || restoredRef.current) {
      return;
    }

    const savedProgram = savedProgramData?.program?.program_data as StoredProgramWithEditState | undefined;
    if (!savedProgram) {
      return;
    }

    try {
      const storedProgram = savedProgram;
      const editState = storedProgram.editState;

      if (editState) {
        skipNextResetRef.current = true;
        const restoredSelectedIndex =
          editState.selectedProgramOptionIndex ??
          getProgramOptionIndexByTitle(storedProgram.title);
        setPlayerCount(editState.playerCount);
        setCourtCount(editState.courtCount);
        setStartHour(editState.startHour);
        setStartMinute(editState.startMinute);
        setEndHour(editState.endHour);
        setEndMinute(editState.endMinute);
        setProgramMode(editState.programMode);
        setIsProgramGenerated(editState.isProgramGenerated);
        setIsCustomProgramCompleted(editState.isCustomProgramCompleted);
        setRounds(editState.rounds);
        setCustomProgramOptions({
          ...Object.fromEntries(
            editState.recommendationOptions.map((option, index) => [index, option])
          ),
          ...editState.customProgramOptions,
          [restoredSelectedIndex]: storedProgram,
        });
        setSelectedProgramOptionIndex(restoredSelectedIndex);
      } else {
        const restoredRounds = storedProgram.rounds ?? rounds;
        const restoredSelectedIndex = getProgramOptionIndexByTitle(storedProgram.title);
        skipNextResetRef.current = true;
        setIsProgramGenerated(true);
        setProgramMode("recommend");
        setRounds(restoredRounds);
        setCustomProgramOptions({ [restoredSelectedIndex]: storedProgram });
        setSelectedProgramOptionIndex(restoredSelectedIndex);
      }

      restoredRef.current = true;
    } catch {
      restoredRef.current = true;
    }
  }, [getProgramOptionIndexByTitle, isEditMode, leagueId, rounds, savedProgramData]);

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

    if (leagueId) {
      localStorage.setItem(
        `league-program-${leagueId}`,
        JSON.stringify(selectedOption)
      );
      localStorage.setItem(`league-program-active-round-${leagueId}`, "1");
      await saveLeagueProgram({ leagueId, program: selectedOption }).unwrap();
      const programMatches = selectedOption.blocks.flatMap((block, blockIndex) =>
        block.type === "SINGLES"
          ? generateProgramRoundMatches(leagueId, selectedOption, participantData?.participants ?? [], blockIndex + 1).map((match) => ({
              ...match,
              program_round: blockIndex + 1,
              program_block_type: block.type,
            }))
          : []
      );
      try {
        await syncLeagueProgramMatches({ leagueId, matches: programMatches }).unwrap();
      } catch (error) {
        console.error("Failed to sync program matches", error);
      }
      navigate(`/league/${leagueId}/program`);
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
    mode: "team" | "group"
  ) => {
    const block = option.blocks[blockIndex];

    if (mode === "team") {
      return getRoundGroupSizes(option, blockIndex);
    }

    return block?.type === "TEAM"
      ? getRoundTeamGroupSizes(option, blockIndex)
      : getRoundGroupSizes(option, blockIndex);
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
    mode: "team" | "group"
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
      teamShuffleSeed: mode === "team" && roundIndex === blockIndex
        ? nextTeamShuffleSeed
        : round.teamShuffleSeed,
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
        teamShuffleSeed: mode === "team"
          ? nextTeamShuffleSeed
          : block.teamShuffleSeed,
      };
    });

    setCustomProgramOptions((previous) => ({
      ...previous,
      [optionIndex]: {
        ...updatedOption,
        blocks: nextBlocks,
      },
    }));
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
  const teamResultGroups =
    groupResultOption && groupResultDialog
      ? distributeSnake(
          teamFormationPlayers,
          getRoundGroupSizes(groupResultOption, groupResultDialog.blockIndex)
        )
      : [];
  const teamUnits = teamResultGroups.map((team, teamIndex) => {
    const leader = team.players[0];
    return {
      name: `팀 ${leader?.name ?? teamIndex + 1}`,
      level: leader?.level ?? teamIndex + 1,
      roster: team.players,
    };
  });
  const dialogGroupResult =
    groupResultSizes.length > 0
      ? groupResultDialog?.mode === "team"
        ? teamResultGroups
        : groupResultDialog?.mode === "group" && groupResultOption?.blocks[groupResultDialog.blockIndex]?.type === "TEAM"
          ? distributeSnake(
              reshuffleWithinLevel(teamUnits, groupShuffleSeed),
              groupResultSizes
            )
          : distributeSnake(
              reshuffleWithinLevel(groupPlayers.slice(0, effectiveFormationPlayerCount), groupShuffleSeed),
              groupResultSizes
            )
      : [];

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
            if (leagueId) {
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
          이벤트 프로그램 생성
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
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

      <div style={{ marginTop: '24px' }}>
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

      <div style={{ marginTop: "24px" }}>
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
        style={{ marginTop: "30px" }}
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

      {isProgramGenerated && !isGeneratingProgram && (
      <div style={{ marginTop: "60px" }}>
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

        {rounds.map((round) => (
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
                    rounds.filter(
                      (x) => x.id !== round.id
                    )
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
                                tournamentSeeding:
                                  value === "TOURNAMENT"
                                    ? x.tournamentSeeding ?? "seed"
                                    : x.tournamentSeeding,
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

	                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    옵션
                  </div>

                  <ToggleButtonGroup
                    exclusive
                    value={round.option}
                    fullWidth
                    onChange={(_, value) => {
                      if (!value) return;

                      setRounds(
                        rounds.map((x) =>
                          x.id === round.id
                            ? {
                                ...x,
                                option: value,
                              }
                            : x
                        )
                      );
                    }}
                  >
                    <ToggleButton value="NONE">
                      없음
                    </ToggleButton>

                    <ToggleButton value="PRELIM">
                      예선
                    </ToggleButton>

                    <ToggleButton value="FINAL">
                      본선
                    </ToggleButton>

                    <ToggleButton value="UPPER">
                      상위
                    </ToggleButton>

                    <ToggleButton value="LOWER">
                      하위
                    </ToggleButton>
                  </ToggleButtonGroup>
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
                </div>
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

                  <ToggleButtonGroup
                    exclusive
                    value={round.teamMatchType}
                    fullWidth
                    onChange={(_, value) => {
                      if (!value) return;

                      setRounds(
                        rounds.map((x) =>
                          x.id === round.id
                            ? {
                                ...x,
                                teamMatchType: value,
                              }
                            : x
                        )
                      );
                    }}
                  >
                    <ToggleButton value="SSS">
                      단단단
                    </ToggleButton>

                    <ToggleButton value="SDS">
                      단복단
                    </ToggleButton>

                    <ToggleButton value="DSD">
                      복단복
                    </ToggleButton>
                    
                    <ToggleButton value="DDD">
                      복복복
                    </ToggleButton>
                  </ToggleButtonGroup>
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
              ...rounds,
              {
                id: rounds.length + 1,
                expanded: true,
                program: "SINGLES",
                format: "GROUP",
                option: "NONE",
                matchRule: "BEST_OF_3",
                teamPlayerCount: 4,
                teamMatchType: "SSS",
                tournamentSeeding: "seed",
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
<h2 style={{ marginTop: '40px' }}>
  프로그램 추천안
</h2>

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
        <Checkbox
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
                      option.rounds[blockIndex].option === "PRELIM"
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

            {block.type === "TEAM" && (
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

            {block.format === "GROUP" && (
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
        onClose={() => setGroupResultDialog(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isGroupResultTeam ? "팀 편성 결과" : "조 편성 결과"}
        </DialogTitle>

        <DialogContent dividers>
          <div
            key={`${groupResultDialog?.optionIndex ?? "x"}-${groupResultDialog?.blockIndex ?? "x"}-${groupResultDialog?.mode ?? "x"}-${teamShuffleSeed}-${groupShuffleSeed}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
          {dialogGroupResult.map((group) => (
            <div
              key={group.name}
              style={{
                border: '1px solid #ddd',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <h3>{isGroupResultTeam ? group.name.replace(/조$/, "팀") : group.name}</h3>

              {group.players.map((player) => {
                const roster = (player as typeof player & { roster?: Array<{ name: string; level: number }> }).roster;

                return (
                  <div key={player.name} style={{ marginTop: roster ? "8px" : 0 }}>
                    {player.level}부 - {formatFormationName(player.name, player.level)}
                    {roster && (
                      <div style={{ paddingLeft: "12px", marginTop: "4px", color: "#6b7280" }}>
                        {roster.map((member) => (
                          <div key={member.name}>
                            {member.level}부 - {formatFormationName(member.name, member.level)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          </div>
        </DialogContent>

        <DialogActions>
          {groupResultDialog && (
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
          <Button onClick={() => setGroupResultDialog(null)}>
            닫기
          </Button>
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
            width: "min(430px, calc(100% - 32px))",
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
