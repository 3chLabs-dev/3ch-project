import { generateProgramOptions } from '../../features/league/algorithms/generateProgramOptions';
import { generateProgramBlocks } from '../../features/league/algorithms/generateProgramBlocks';
import { distributeSnake } from '../../features/league/algorithms/distributeSnake';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { generateGroupOptions } from '../../features/league/algorithms/generateGroupOptions';
import type { ProgramBlock, ProgramOption, ProgramType, TeamMatchType, RoundConfig } from '../../features/league/types/tournament.types';
import { ToggleButton, ToggleButtonGroup, Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from "@mui/material";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, } from "@dnd-kit/sortable";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import EditIcon from "@mui/icons-material/Edit";

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

              {round.program !== "TEAM" && (
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
              )}

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
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
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
    },
  ]);

  const [programMode, setProgramMode] = useState<
    "recommend" | "custom"
  >("recommend");
  const [isProgramGenerated, setIsProgramGenerated] = useState(false);
  const [isCustomProgramCompleted, setIsCustomProgramCompleted] = useState(false);
  const [customProgramOptions, setCustomProgramOptions] = useState<Record<number, ProgramOption>>({});
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
  const [editingRounds, setEditingRounds] = useState<RoundConfig[]>([]);

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

  const rentalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  const rentalStartMinutes = startHour * 60 + startMinute;
  const rentalHours = rentalMinutes / 60;

  const options = useMemo(() => {
  return generateGroupOptions(playerCount);
}, [playerCount]);

  const groupResult =
    options.length > 0
      ? distributeSnake(
          mockPlayers.slice(0, playerCount),
          options[selectedOptionIndex]?.groups ?? []
        )
      : [];

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


  const programOptions = generateProgramOptions({
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
});
  useEffect(() => {
    setCustomProgramOptions({});
  }, [
    playerCount,
    courtCount,
    rentalMinutes,
    rentalStartMinutes,
  ]);

  const displayedProgramOptions = programOptions.map(
    (option, index) => customProgramOptions[index] ?? option
  );

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
      playerCount,
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

  const getStars = (score: number) => {
    if (score >= 90) return "★★★★★";
    if (score >= 80) return "★★★★☆";
    if (score >= 70) return "★★★☆☆";
    if (score >= 60) return "★★☆☆☆";

  return "★☆☆☆☆";
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
      <h1>조 편성 알고리즘 테스트</h1>

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
        onClick={() => {
          setIsProgramGenerated(true);
          setCustomProgramOptions({});
        }}
        style={{ marginTop: "24px" }}
      >
        AI 프로그램 생성하기
      </Button>

      {isProgramGenerated && (
      <div style={{ marginTop: "24px" }}>
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

            {round.program !== "TEAM" && (
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
            )}

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

        <Button
          variant="contained"
          fullWidth
          onClick={() => setIsCustomProgramCompleted(true)}
          style={{ marginTop: "12px" }}
        >
          완료
        </Button>
      </div>
      )}

      {isProgramGenerated && (
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
    style={{
      border: '1px solid #ddd',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '12px',
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
      <h3 style={{ margin: 0 }}>
        {option.title}
      </h3>

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
          onClick={() => openProgramEditDialog(index)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  <div style={{ paddingLeft: '16px'}}>
    <div>
      - 조 구성: {option.groupSizes?.join('/') ?? "-"}
    </div>

    <div>
      - 경기방식: {option.matchRule}
    </div>

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
          index: number
        ) => {
          const elapsedMinutes = option.blocks
            .slice(0, index)
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
          <div key={index}>
            {block.title}
            
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
          </div>
          );
        }
      )}
    </div>
  </div>
    </div>
))}

      <h2 style={{ marginTop: '40px' }}>
        조 편성 선택
      </h2>

      <div style={{ marginTop: '16px' }}>
        {options.map((option, index) => (
          <div
            key={`${option.tierSize}-${option.groupCount}`}
            onClick={() => setSelectedOptionIndex(index)}
            style={{
              border:
                selectedOptionIndex === index
                  ? '2px solid #3b82f6'
                  : '1px solid #d1d5db',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px',
              backgroundColor:
                selectedOptionIndex === index
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
              {option.groupCount}개 조
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
        ))}
      </div>

      <h2 style={{ marginTop: '40px' }}>
        조 편성 결과
      </h2>

      {groupResult.map((group) => (
        <div
          key={group.name}
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '12px',
          }}
        >
          <h3>{group.name}</h3>

          {group.players.map((player) => (
            <div key={player.name}>
              {player.level}부 - {player.name}
            </div>
          ))}
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
    </div>
  );
};

export default LeagueAlgorithmDemo;
