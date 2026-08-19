import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import {
  DndContext, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useDeleteAllLeagueMatchesMutation,
  useDeleteLeagueProgramMutation,
  useGetLeagueProgramQuery,
  useGetLeagueMatchesQuery,
  useGetLeagueParticipantsQuery,
  useGetLeagueQuery,
  useSaveLeagueProgramMutation,
  useSyncLeagueProgramMatchesMutation,
} from "../../features/league/leagueApi";
import { useGetGroupDetailQuery } from "../../features/group/groupApi";
import { formatLeagueDate } from "../../utils/dateUtils";
import { distributeSnake } from "../../features/league/algorithms/distributeSnake";
import { generateGroupOptions } from "../../features/league/algorithms/generateGroupOptions";
import { clearProgramMatchState, generateProgramRoundMatches } from "../../utils/programMatchGenerator";
import type { ProgramOption } from "../../features/league/types/tournament.types";

const ADVANCEMENT_LABEL: Record<string, string> = {
  "upper-only": "상위 진출",
  "upper-lower": "상·하위 진출",
};

const SEEDING_LABEL: Record<string, string> = {
  manual: "수동",
  seed: "시드",
  random: "랜덤",
};

type StoredProgramBlock = {
  title?: string;
  type?: "SINGLES" | "DOUBLES" | "TEAM";
  program?: "SINGLES" | "DOUBLES" | "TEAM";
  format?: "LEAGUE" | "GROUP" | "TOURNAMENT";
  matchRule?: "BEST_OF_3" | "BEST_OF_5" | "THREE_SET" | "3전 2선승제" | "5전 3선승제" | "3세트제";
  groupSizes?: number[];
  teamGroupSizes?: number[];
  groupShuffleSeed?: number;
  teamShuffleSeed?: number;
  groupAssignments?: FormationPlayer[][];
  teamAssignments?: FormationPlayer[][];
  teamAssignmentModes?: Array<"manual" | "auto">;
  teamAssignmentLocks?: boolean[];
  doublesAssignments?: FormationPlayer[][];
  doublesAssignmentModes?: Array<"manual" | "auto">;
  doublesAssignmentLocks?: boolean[];
  teamFormationPublished?: boolean;
  doublesFormationPublished?: boolean;
  groupFormationPublished?: boolean;
  participantOrder?: string[];
  description?: string;
  teamSinglesCount?: number;
  teamDoublesCount?: number;
  teamPlayerCount?: number;
  inheritPreviousTeamFormation?: boolean;
};

type FormationPlayer = {
  name: string;
  level: number;
  roster?: FormationPlayer[];
};

const FORMATION_COLORS = [
  "#E53935", "#F57C00", "#D4A000", "#2E7D32",
  "#1976D2", "#303F9F", "#7B1FA2", "#212121",
  "#D81B60", "#00897B", "#0097A7", "#6D4C41",
];

const hasFormationLevel = (level?: number): level is number =>
  Number.isFinite(level) && Number(level) > 0 && Number(level) < 999;

const formationLevelSum = (players: FormationPlayer[]): number =>
  players.reduce(
    (sum, player) => sum + (player.roster?.length
      ? formationLevelSum(player.roster)
      : hasFormationLevel(player.level) ? player.level : 0),
    0,
  );

const formationPlayerId = (player: FormationPlayer) =>
  `formation-${player.name}-${player.level}`;

function SortableFormationPlayer({ player, locked = false }: { player: FormationPlayer; locked?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: formationPlayerId(player),
    disabled: locked,
  });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...(locked ? {} : listeners)}
      sx={{
        display: "flex", alignItems: "center", gap: 0.75, py: 0.65, px: 0.5,
        borderRadius: 1, cursor: locked ? "default" : "grab", touchAction: "none",
        bgcolor: isDragging ? "#EFF6FF" : "transparent", opacity: isDragging ? 0.55 : 1,
      }}
    >
      {!locked && <DragHandleIcon sx={{ color: "#9CA3AF", fontSize: 17, flexShrink: 0 }} />}
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#FAAA47", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
        {hasFormationLevel(player.level) ? `${player.level}부` : "-"}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{player.name}</Typography>
    </Box>
  );
}

function FormationEditCard({ players, index, label, locked = false, teamMode }: { players: FormationPlayer[]; index: number; label: string; locked?: boolean; teamMode?: "manual" | "auto" }) {
  const { setNodeRef, isOver } = useDroppable({ id: `formation-group-${index}`, disabled: locked });
  const accent = FORMATION_COLORS[index % FORMATION_COLORS.length];

  return (
    <Box sx={{ border: `1px solid ${isOver ? accent : "#E5E7EB"}`, borderTop: `3px solid ${accent}`, borderRadius: 1.5, bgcolor: isOver ? "#F8FAFF" : "#FFF", overflow: "hidden" }}>
      <Box sx={{ px: 1.25, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#F8FAFC" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900 }}>{label}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {teamMode && <Chip label={teamMode === "manual" ? "수동" : "자동"} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: teamMode === "manual" ? "#FEF3C7" : "#DBEAFE", color: teamMode === "manual" ? "#B45309" : "#1D4ED8" }} />}
          {teamMode && (locked ? <LockOutlinedIcon sx={{ fontSize: 15, color: "#D97706" }} /> : <LockOpenOutlinedIcon sx={{ fontSize: 15, color: "#94A3B8" }} />)}
          <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 700 }}>{players.length}명</Typography>
        </Stack>
      </Box>
      <Box ref={setNodeRef} sx={{ px: 0.75, py: 0.5, minHeight: 54 }}>
        <SortableContext items={players.map(formationPlayerId)} strategy={verticalListSortingStrategy} disabled={locked}>
          {players.map((player) => <SortableFormationPlayer key={formationPlayerId(player)} player={player} locked={locked} />)}
        </SortableContext>
      </Box>
      <Box sx={{ borderTop: "1px solid #E5E7EB", px: 1.25, py: 0.8 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 700 }}>
          합 <Box component="span" sx={{ color: accent, fontWeight: 900 }}>{formationLevelSum(players)}부</Box>
        </Typography>
      </Box>
    </Box>
  );
}

type StoredProgramOption = {
  title?: string;
  groupSizes?: number[];
  blocks?: StoredProgramBlock[];
  rounds?: StoredProgramBlock[];
};

function getProgramTypeLabel(type?: StoredProgramBlock["type"]) {
  switch (type) {
    case "SINGLES":
      return "단식";
    case "DOUBLES":
      return "복식";
    case "TEAM":
      return "단체전";
    default:
      return "";
  }
}

function getProgramFormatLabel(format?: StoredProgramBlock["format"]) {
  switch (format) {
    case "LEAGUE":
      return "단일리그";
    case "GROUP":
      return "조별리그";
    case "TOURNAMENT":
      return "토너먼트";
    default:
      return "";
  }
}

function getProgramMatchRuleLabel(matchRule?: StoredProgramBlock["matchRule"]) {
  switch (matchRule) {
    case "BEST_OF_5":
    case "5전 3선승제":
      return "5전 3선승제";
    case "THREE_SET":
    case "3세트제":
      return "3세트제";
    case "BEST_OF_3":
    case "3전 2선승제":
    default:
      return "3전 2선승제";
  }
}

function getProgramBracketPath(format?: StoredProgramBlock["format"]) {
  return format === "TOURNAMENT" ? "tournament-bracket" : "bracket";
}

function getProgramBracketLabel() {
  return "대진표 보기";
}

export default function LeagueProgramList({ embedded = false }: { embedded?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: leagueData, isLoading: leagueLoading } = useGetLeagueQuery(id!);
  const { data: matchesData, isLoading: matchesLoading } = useGetLeagueMatchesQuery(id!);
  const { data: participantsData, isLoading: participantsLoading } = useGetLeagueParticipantsQuery(id!, { skip: !id });
  const { data: programData, isLoading: programLoading } = useGetLeagueProgramQuery(id!, { skip: !id });
  const { data: groupData, isLoading: groupLoading } = useGetGroupDetailQuery(
    leagueData?.league?.group_id ?? "",
    { skip: !leagueData?.league?.group_id },
  );
  const [deleteAllMatches, { isLoading: isDeleting }] = useDeleteAllLeagueMatchesMutation();
  const [deleteLeagueProgram] = useDeleteLeagueProgramMutation();
  const [saveLeagueProgram, { isLoading: isSavingFormation }] = useSaveLeagueProgramMutation();
  const [syncLeagueProgramMatches] = useSyncLeagueProgramMatchesMutation();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [storedProgram, setStoredProgram] = useState<StoredProgramOption | null>(null);
  const [formationDialog, setFormationDialog] = useState<{ roundIndex: number; mode: "team" | "doubles" | "group" } | null>(null);
  const [groupStructureRoundIndex, setGroupStructureRoundIndex] = useState<number | null>(null);
  const [pendingGroupStructureSizes, setPendingGroupStructureSizes] = useState<number[]>([]);
  const [formationDraft, setFormationDraft] = useState<FormationPlayer[][]>([]);
  const [isFormationEditing, setIsFormationEditing] = useState(false);
  const [reshuffleConfirmOpen, setReshuffleConfirmOpen] = useState(false);
  const [pendingFormationSave, setPendingFormationSave] = useState<{
    program: StoredProgramOption;
    roundIndex: number;
  } | null>(null);
  const autoSyncedRoundsRef = useRef(new Set<number>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const league = leagueData?.league;
  const matches = matchesData?.matches ?? [];
  const participants = participantsData?.participants ?? [];
  const hasProgram = Boolean(storedProgram?.blocks?.length);
  const canManage = !groupLoading && (groupData?.myRole === "owner" || groupData?.myRole === "admin");

  const programRounds = storedProgram?.blocks?.length
    ? storedProgram.blocks.map((block, index) => {
        const legacySinglesCount = block.description?.match(/단식/g)?.length;
        const legacyDoublesCount = block.description?.match(/복식/g)?.length;

        return {
        round: index + 1,
        title: block.title ?? `${index + 1}라운드 ${getProgramTypeLabel(block.type)}`.trim(),
        format: block.format ?? "GROUP",
        formatLabel: getProgramFormatLabel(block.format),
        typeLabel: getProgramTypeLabel(block.type),
        matchRuleLabel: getProgramMatchRuleLabel(block.matchRule),
        bracketLabel: getProgramBracketLabel(),
        bracketPath: getProgramBracketPath(block.format),
        type: block.type,
        teamSinglesCount: block.teamSinglesCount ?? legacySinglesCount ?? 3,
        teamDoublesCount: block.teamDoublesCount ?? legacyDoublesCount ?? 0,
        teamFormationPublished: block.teamFormationPublished,
        doublesFormationPublished: block.doublesFormationPublished,
        groupFormationPublished: block.groupFormationPublished,
      };
      })
    : [];

  const advancementLabel = ADVANCEMENT_LABEL[league?.tournament_advancement ?? ""] ?? "";
  const seedingLabel = SEEDING_LABEL[league?.tournament_seeding ?? ""] ?? "";
  const isLoading = leagueLoading || matchesLoading || groupLoading || programLoading || participantsLoading;

  useEffect(() => {
    setStoredProgram((programData?.program?.program_data as StoredProgramOption | null | undefined) ?? null);
  }, [programData]);

  const programPlayers = useMemo(() => {
    return [...participants]
      .map((participant) => {
        const level = Number.parseInt(participant.division ?? "", 10);
        return {
          name: participant.name,
          level: Number.isNaN(level) ? 0 : level,
        };
      })
      .sort((a, b) => (a.level || Number.MAX_SAFE_INTEGER) - (b.level || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
  }, [participants]);

  useEffect(() => {
    if (!id || !canManage || !storedProgram?.blocks?.length || participants.length === 0) return;

    storedProgram.blocks.forEach((block, index) => {
      const round = index + 1;
      const isPublished = block.groupFormationPublished || block.teamFormationPublished || block.doublesFormationPublished;
      const hasServerMatches = matches.some((match) => match.is_program && match.program_round === round);
      if (!isPublished || hasServerMatches || autoSyncedRoundsRef.current.has(round)) return;

      autoSyncedRoundsRef.current.add(round);
      const roundMatches = generateProgramRoundMatches(
        id,
        storedProgram as ProgramOption,
        participants,
        round,
        matches,
      ).map((match) => ({
        ...match,
        program_round: round,
        program_block_type: block.type,
      }));
      if (roundMatches.length === 0) return;
      void syncLeagueProgramMatches({ leagueId: id, matches: roundMatches }).unwrap()
        .catch(() => autoSyncedRoundsRef.current.delete(round));
    });
  }, [canManage, id, matches, participants, storedProgram, syncLeagueProgramMatches]);

  const rotateBySeed = <T,>(items: T[], seed: number) => {
    if (items.length < 2) return items;
    const offset = seed % items.length || 1;
    const rotated = [...items.slice(offset), ...items.slice(0, offset)];
    return Math.floor(seed / items.length) % 2 === 1
      ? rotated.reverse()
      : rotated;
  };

  const reshuffleWithinLevel = <T extends { level?: number }>(items: T[], seed?: number) => {
    if (seed == null) return items;
    const buckets = new Map<number, T[]>();
    items.forEach((item) => {
      const level = item.level ?? 0;
      buckets.set(level, [...(buckets.get(level) ?? []), item]);
    });
    return [...buckets.keys()]
      .sort((a, b) => (a || Number.MAX_SAFE_INTEGER) - (b || Number.MAX_SAFE_INTEGER))
      .flatMap((level) => rotateBySeed(buckets.get(level) ?? [], seed + level * 997));
  };

  const formatFormationName = (name: string, level?: number) =>
    level == null ? name : name.replace(new RegExp(`\\s*\\(${level}\\)$`), "");

  const splitIntoTwoGroups = (count: number) => {
    if (count <= 0) return [];
    if (count <= 2) return [count];
    return [Math.ceil(count / 2), Math.floor(count / 2)];
  };

  const resolveFormationBlock = (roundIndex: number): StoredProgramBlock | undefined => {
    const block = storedProgram?.blocks?.[roundIndex];
    if (!block) return undefined;
    const inheritsPrevious =
      storedProgram?.rounds?.[roundIndex]?.inheritPreviousTeamFormation ??
      block.inheritPreviousTeamFormation;
    if (!inheritsPrevious || block.type !== "TEAM" || roundIndex === 0) return block;
    const previousBlock = resolveFormationBlock(roundIndex - 1);
    if (!previousBlock || previousBlock.type !== "TEAM") return block;
    return {
      ...block,
      groupSizes: previousBlock.groupSizes,
      teamShuffleSeed: previousBlock.teamShuffleSeed,
      teamAssignments: previousBlock.teamAssignments,
    };
  };
  const activeFormationBlock = formationDialog
    ? resolveFormationBlock(formationDialog.roundIndex)
    : undefined;
  const teamGroupSizes = activeFormationBlock?.groupSizes ?? storedProgram?.groupSizes ?? [programPlayers.length];
  const defaultFormationSeed = formationDialog ? (formationDialog.roundIndex + 1) * 1000 : 0;
  const teamFormationPlayers = reshuffleWithinLevel(
    programPlayers,
    activeFormationBlock?.teamShuffleSeed ?? defaultFormationSeed + 101,
  );
  const automaticTeamResultGroups = activeFormationBlock
    ? distributeSnake(teamFormationPlayers, teamGroupSizes)
    : [];
  const teamResultGroups = activeFormationBlock?.teamAssignments?.length
    ? activeFormationBlock.teamAssignments.map((players, index) => ({ name: `${String.fromCharCode(65 + index)}팀`, players }))
    : automaticTeamResultGroups;
  const teamFormationMode = (index: number): "manual" | "auto" => {
    if (!activeFormationBlock?.teamAssignments?.length) return "auto";
    // Programs saved before the per-team flag existed were entirely hand arranged.
    return activeFormationBlock.teamAssignmentModes?.[index] ?? "manual";
  };
  const isTeamLocked = (index: number) =>
    activeFormationBlock?.teamAssignmentLocks?.[index] ?? teamFormationMode(index) === "manual";
  const doublesResultGroups = activeFormationBlock?.type === "DOUBLES"
    ? activeFormationBlock.doublesAssignments?.length
      ? activeFormationBlock.doublesAssignments.map((players, index) => ({ name: `${index + 1}복식`, players }))
      : distributeSnake(
          teamFormationPlayers,
          Array.from({ length: Math.floor(programPlayers.length / 2) }, () => 2),
        ).filter((group) => group.players.length === 2)
    : [];
  const doublesFormationMode = (index: number): "manual" | "auto" => {
    if (!activeFormationBlock?.doublesAssignments?.length) return "auto";
    return activeFormationBlock.doublesAssignmentModes?.[index] ?? "manual";
  };
  const isDoublesLocked = (index: number) =>
    activeFormationBlock?.doublesAssignmentLocks?.[index] ?? doublesFormationMode(index) === "manual";
  const teamUnits = teamResultGroups.map((team, teamIndex) => {
    const leader = team.players[0];
    return {
      name: `팀 ${leader?.name ?? teamIndex + 1}`,
      level: leader?.level ?? teamIndex + 1,
      roster: team.players,
    };
  });
  const doublesUnits = doublesResultGroups.map((pair, pairIndex) => ({
    name: pair.players.map((player) => formatFormationName(player.name, player.level)).join(" · "),
    level: pairIndex + 1,
    roster: pair.players,
  }));
  const configuredGroupSizes = activeFormationBlock?.groupSizes ?? storedProgram?.groupSizes;
  const validDoublesGroupSizes = configuredGroupSizes?.reduce((sum, size) => sum + size, 0) === doublesUnits.length
    ? configuredGroupSizes
    : splitIntoTwoGroups(doublesUnits.length);
  const groupResultSizes = activeFormationBlock?.type === "TEAM"
    ? activeFormationBlock?.teamGroupSizes ?? splitIntoTwoGroups(teamUnits.length)
    : activeFormationBlock?.type === "DOUBLES"
      ? validDoublesGroupSizes
      : configuredGroupSizes ?? [programPlayers.length];
  const formationGroups = formationDialog?.mode === "team"
    ? teamResultGroups
    : formationDialog?.mode === "doubles"
      ? doublesResultGroups
    : activeFormationBlock?.groupAssignments?.length
      ? activeFormationBlock.groupAssignments.map((players, index) => ({ name: `${index + 1}조`, players }))
      : activeFormationBlock?.type === "TEAM"
        ? distributeSnake(reshuffleWithinLevel(teamUnits, activeFormationBlock?.groupShuffleSeed ?? defaultFormationSeed + 503), groupResultSizes)
        : activeFormationBlock?.type === "DOUBLES"
          ? distributeSnake(reshuffleWithinLevel(doublesUnits, activeFormationBlock?.groupShuffleSeed ?? defaultFormationSeed + 503), groupResultSizes)
        : distributeSnake(reshuffleWithinLevel(programPlayers, activeFormationBlock?.groupShuffleSeed ?? defaultFormationSeed + 503), groupResultSizes);
  const isDoublesGroupResult = formationDialog?.mode === "group" && activeFormationBlock?.type === "DOUBLES";
  const groupStructureBlock = groupStructureRoundIndex == null
    ? undefined
    : storedProgram?.blocks?.[groupStructureRoundIndex];
  const groupStructureMemberCount = groupStructureBlock?.groupSizes?.reduce((sum, size) => sum + size, 0)
    || programPlayers.length;
  const groupStructureOptions = useMemo(
    () => generateGroupOptions(groupStructureMemberCount),
    [groupStructureMemberCount],
  );

  const openGroupStructureDialog = (roundIndex: number) => {
    const block = storedProgram?.blocks?.[roundIndex];
    setPendingGroupStructureSizes(block?.groupSizes ?? generateGroupOptions(programPlayers.length)[0]?.groups ?? [programPlayers.length]);
    setGroupStructureRoundIndex(roundIndex);
  };

  const closeGroupStructureDialog = () => {
    setGroupStructureRoundIndex(null);
    setPendingGroupStructureSizes([]);
  };

  const saveGroupStructure = async () => {
    if (groupStructureRoundIndex == null || !storedProgram || pendingGroupStructureSizes.length === 0) return;
    const block = storedProgram.blocks?.[groupStructureRoundIndex];
    if (!block) return;
    const nextProgram: StoredProgramOption = {
      ...storedProgram,
      blocks: (storedProgram.blocks ?? []).map((currentBlock, index) => index === groupStructureRoundIndex
        ? {
            ...currentBlock,
            groupSizes: pendingGroupStructureSizes,
            groupAssignments: undefined,
            groupShuffleSeed: (currentBlock.groupShuffleSeed ?? (index + 1) * 1000 + 503) + 1,
          }
        : currentBlock),
    };
    await persistFormation(nextProgram, groupStructureRoundIndex, true);
    closeGroupStructureDialog();
  };

  const closeFormationDialog = () => {
    setFormationDialog(null);
    setFormationDraft([]);
    setIsFormationEditing(false);
    setReshuffleConfirmOpen(false);
  };

  const persistFormation = async (
    nextProgram: StoredProgramOption,
    roundIndex: number,
    resetMatches: boolean,
    syncMatches = resetMatches,
  ) => {
    if (!id || !canManage) return;
    setStoredProgram(nextProgram);
    localStorage.setItem(`league-program-${id}`, JSON.stringify(nextProgram));
    await saveLeagueProgram({ leagueId: id, program: nextProgram }).unwrap();

    if (syncMatches) {
      const affectedRoundIndexes = [roundIndex];
      for (let index = roundIndex + 1; index < (nextProgram.blocks?.length ?? 0); index += 1) {
        const linked =
          nextProgram.rounds?.[index]?.inheritPreviousTeamFormation ??
          nextProgram.blocks?.[index]?.inheritPreviousTeamFormation;
        if (!linked || nextProgram.blocks?.[index]?.type !== "TEAM") break;
        affectedRoundIndexes.push(index);
      }
      for (const affectedRoundIndex of affectedRoundIndexes) {
        const block = nextProgram.blocks?.[affectedRoundIndex];
        if (!block) continue;
        if (resetMatches) clearProgramMatchState(id, affectedRoundIndex + 1);
        const roundMatches = generateProgramRoundMatches(
          id,
          nextProgram as ProgramOption,
          participants,
          affectedRoundIndex + 1,
          matches,
        ).map((match) => ({
          ...match,
          program_round: affectedRoundIndex + 1,
          program_block_type: block.type,
        }));
        await syncLeagueProgramMatches({
          leagueId: id,
          matches: roundMatches,
          resetResults: resetMatches,
        }).unwrap();
      }
    }
  };

  const requestFormationSave = (program: StoredProgramOption, roundIndex: number) => {
    setPendingFormationSave({ program, roundIndex });
    setIsFormationEditing(false);
    setFormationDraft([]);
  };

  const finishFormationSave = async (resetMatches: boolean) => {
    if (!pendingFormationSave) return;
    const pending = pendingFormationSave;
    setPendingFormationSave(null);
    await persistFormation(pending.program, pending.roundIndex, resetMatches);
    closeFormationDialog();
  };

  const beginFormationEditing = () => {
    setFormationDraft(formationGroups.map((group) => group.players.map((player) => ({ ...player }))));
    setIsFormationEditing(true);
  };

  const publishFormation = async (roundIndex: number, mode: "team" | "doubles" | "group") => {
    if (!storedProgram?.blocks || !canManage) return;
    const key = mode === "team" ? "teamFormationPublished" : mode === "doubles" ? "doublesFormationPublished" : "groupFormationPublished";
    const nextBlocks = storedProgram.blocks.map((block, index) => index === roundIndex ? { ...block, [key]: true } : block);
    const nextRounds = storedProgram.rounds?.map((round, index) => index === roundIndex ? { ...round, [key]: true } : round);
    await persistFormation({ ...storedProgram, blocks: nextBlocks, ...(nextRounds ? { rounds: nextRounds } : {}) }, roundIndex, false, true);
    setFormationDialog({ roundIndex, mode });
  };

  const toggleTeamLock = async (teamIndex: number) => {
    if (!formationDialog || formationDialog.mode !== "team" || !storedProgram?.blocks) return;
    const { roundIndex } = formationDialog;
    const nextLocks = teamResultGroups.map((_, index) => index === teamIndex ? !isTeamLocked(index) : isTeamLocked(index));
    const nextAssignments = teamResultGroups.map((group) => group.players);
    const nextModes = teamResultGroups.map((_, index) => teamFormationMode(index));
    let propagate = false;
    const updateTeamBlock = (block: StoredProgramBlock, index: number) => {
      if (index === roundIndex) propagate = true;
      else if (index > roundIndex && propagate && !(storedProgram.rounds?.[index]?.inheritPreviousTeamFormation ?? block.inheritPreviousTeamFormation)) propagate = false;
      if (!propagate) return block;
      return { ...block, teamAssignments: nextAssignments, teamAssignmentModes: nextModes, teamAssignmentLocks: nextLocks };
    };
    const nextBlocks = storedProgram.blocks.map(updateTeamBlock);
    propagate = false;
    const nextRounds = storedProgram.rounds?.map((round, index) => {
      if (index === roundIndex) propagate = true;
      else if (index > roundIndex && propagate && !(round.program === "TEAM" && round.inheritPreviousTeamFormation)) propagate = false;
      return propagate ? { ...round, teamAssignments: nextAssignments, teamAssignmentModes: nextModes, teamAssignmentLocks: nextLocks } : round;
    });
    await persistFormation({ ...storedProgram, blocks: nextBlocks, ...(nextRounds ? { rounds: nextRounds } : {}) }, roundIndex, false);
  };

  const toggleDoublesLock = async (pairIndex: number) => {
    if (!formationDialog || formationDialog.mode !== "doubles" || !storedProgram?.blocks) return;
    const { roundIndex } = formationDialog;
    const nextLocks = doublesResultGroups.map((_, index) => index === pairIndex ? !isDoublesLocked(index) : isDoublesLocked(index));
    const nextAssignments = doublesResultGroups.map((group) => group.players);
    const nextModes = doublesResultGroups.map((_, index) => doublesFormationMode(index));
    const nextBlocks = storedProgram.blocks.map((block, index) => index === roundIndex
      ? { ...block, doublesAssignments: nextAssignments, doublesAssignmentModes: nextModes, doublesAssignmentLocks: nextLocks }
      : block);
    const nextRounds = storedProgram.rounds?.map((round, index) => index === roundIndex
      ? { ...round, doublesAssignments: nextAssignments, doublesAssignmentModes: nextModes, doublesAssignmentLocks: nextLocks }
      : round);
    await persistFormation({ ...storedProgram, blocks: nextBlocks, ...(nextRounds ? { rounds: nextRounds } : {}) }, roundIndex, false);
  };

  const findFormationContainer = (groups: FormationPlayer[][], itemId: string) => {
    if (itemId.startsWith("formation-group-")) return Number(itemId.replace("formation-group-", ""));
    return groups.findIndex((group) => group.some((player) => formationPlayerId(player) === itemId));
  };

  const handleFormationDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setFormationDraft((previous) => {
      const from = findFormationContainer(previous, activeId);
      const to = findFormationContainer(previous, overId);
      if (formationDialog?.mode === "team" && (isTeamLocked(from) || isTeamLocked(to))) return previous;
      if (formationDialog?.mode === "doubles" && (isDoublesLocked(from) || isDoublesLocked(to))) return previous;
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
      if (formationDialog?.mode === "team" && (isTeamLocked(container) || isTeamLocked(overContainer))) return previous;
      if (formationDialog?.mode === "doubles" && (isDoublesLocked(container) || isDoublesLocked(overContainer))) return previous;
      if (container < 0 || container !== overContainer) return previous;
      const oldIndex = previous[container].findIndex((player) => formationPlayerId(player) === activeId);
      const newIndex = previous[container].findIndex((player) => formationPlayerId(player) === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return previous;
      const next = previous.map((group) => [...group]);
      next[container] = arrayMove(next[container], oldIndex, newIndex);
      return next;
    });
  };

  const saveManualFormation = async () => {
    if (!formationDialog || !storedProgram?.blocks) return;
    const { roundIndex, mode } = formationDialog;
    if (mode === "doubles" && formationDraft.some((group) => group.length !== 2)) return;
    // Editing changes members only. A team's manual/automatic identity is decided
    // when it is created, and must not change merely because an operator adjusts it.
    const mixedTeamAssignments = formationDraft;
    const teamAssignmentModes = mode === "team"
      ? formationDraft.map((_, index) => teamFormationMode(index))
      : undefined;
    const teamAssignmentLocks = mode === "team"
      ? formationDraft.map((_, index) => isTeamLocked(index))
      : undefined;
    const doublesAssignmentModes = mode === "doubles"
      ? formationDraft.map((_, index) => doublesFormationMode(index))
      : undefined;
    const doublesAssignmentLocks = mode === "doubles"
      ? formationDraft.map((_, index) => isDoublesLocked(index))
      : undefined;
    const remainingParticipants = [...participants];
    const participantOrder = formationDraft.flatMap((group) =>
      group.flatMap((player) => {
        let participantIndex = remainingParticipants.findIndex((participant) => {
          const division = Number.parseInt(String(participant.division ?? "").replace(/[^0-9]/g, ""), 10);
          return participant.name === player.name && division === player.level;
        });
        if (participantIndex < 0) {
          participantIndex = remainingParticipants.findIndex(
            (participant) => participant.name === player.name,
          );
        }
        if (participantIndex < 0) return [];
        const [participant] = remainingParticipants.splice(participantIndex, 1);
        return [participant.id];
      }),
    );
    let propagateTeamFormation = false;
    const nextBlocks = storedProgram.blocks.map((block, index) => {
      if (mode === "team") {
        if (index === roundIndex) {
          propagateTeamFormation = true;
        } else if (
          index > roundIndex &&
          propagateTeamFormation &&
          !(storedProgram.rounds?.[index]?.inheritPreviousTeamFormation ?? block.inheritPreviousTeamFormation)
        ) {
          propagateTeamFormation = false;
        }
        if (propagateTeamFormation) {
          return {
            ...block,
            groupSizes: mixedTeamAssignments.map((group) => group.length),
            teamAssignments: mixedTeamAssignments,
            teamAssignmentModes,
            teamAssignmentLocks,
            groupAssignments: undefined,
          };
        }
      }
      if (index !== roundIndex) return block;
      if (mode === "team") {
        return {
          ...block,
          groupSizes: mixedTeamAssignments.map((group) => group.length),
          teamAssignments: mixedTeamAssignments,
          teamAssignmentModes,
          teamAssignmentLocks,
          groupAssignments: undefined,
        };
      }
      if (mode === "doubles") {
        return { ...block, doublesAssignments: formationDraft, doublesAssignmentModes, doublesAssignmentLocks };
      }
      return {
        ...block,
        groupAssignments: formationDraft,
        participantOrder,
        ...(block.type === "TEAM"
          ? { teamGroupSizes: formationDraft.map((group) => group.length) }
          : { groupSizes: formationDraft.map((group) => group.length) }),
      };
    });
    propagateTeamFormation = false;
    const nextRounds = storedProgram.rounds?.map((round, index) => {
      if (mode === "team") {
        if (index === roundIndex) {
          propagateTeamFormation = true;
        } else if (
          index > roundIndex &&
          propagateTeamFormation &&
          !(round.program === "TEAM" && round.inheritPreviousTeamFormation)
        ) {
          propagateTeamFormation = false;
        }
        if (propagateTeamFormation) {
          return {
            ...round,
            teamPlayerCount: mixedTeamAssignments[0]?.length ?? round.teamPlayerCount,
            groupSizes: mixedTeamAssignments.map((group) => group.length),
            teamAssignments: mixedTeamAssignments,
            teamAssignmentModes,
            teamAssignmentLocks,
            groupAssignments: undefined,
          };
        }
      }
      if (index !== roundIndex) return round;
      if (mode === "team") {
        return {
          ...round,
          groupSizes: mixedTeamAssignments.map((group) => group.length),
          teamAssignments: mixedTeamAssignments,
          teamAssignmentModes,
          teamAssignmentLocks,
          groupAssignments: undefined,
        };
      }
      if (mode === "doubles") {
        return { ...round, doublesAssignments: formationDraft, doublesAssignmentModes, doublesAssignmentLocks };
      }
      return {
        ...round,
        groupAssignments: formationDraft,
        participantOrder,
        ...(activeFormationBlock?.type === "TEAM"
          ? { teamGroupSizes: formationDraft.map((group) => group.length) }
          : { groupSizes: formationDraft.map((group) => group.length) }),
      };
    });
    requestFormationSave(
      { ...storedProgram, blocks: nextBlocks, ...(nextRounds ? { rounds: nextRounds } : {}) },
      roundIndex,
    );
  };

  const reshuffleFormation = async () => {
    if (!formationDialog || !storedProgram?.blocks) return;
    const { roundIndex, mode } = formationDialog;
    const nextTeamShuffleSeed =
      ((storedProgram.blocks[roundIndex]?.teamShuffleSeed ?? (roundIndex + 1) * 1000 + 101) + 1);
    const lockedTeamIndexes = mode === "team"
      ? new Set(teamResultGroups.flatMap((_, index) => isTeamLocked(index) ? [index] : []))
      : new Set<number>();
    const lockedPlayerIds = new Set(
      [...lockedTeamIndexes].flatMap((index) => teamResultGroups[index].players.map(formationPlayerId)),
    );
    const unlockedTeamIndexes = teamResultGroups.flatMap((_, index) => lockedTeamIndexes.has(index) ? [] : [index]);
    const reshuffledUnlockedTeams = mode === "team" && unlockedTeamIndexes.length > 0
      ? distributeSnake(
          reshuffleWithinLevel(programPlayers, nextTeamShuffleSeed).filter((player) => !lockedPlayerIds.has(formationPlayerId(player))),
          unlockedTeamIndexes.map((index) => teamResultGroups[index].players.length),
        ).map((group) => group.players)
      : [];
    const reshuffledTeamAssignments = mode === "team"
      ? teamResultGroups.map((group, index) => lockedTeamIndexes.has(index)
        ? group.players
        : reshuffledUnlockedTeams[unlockedTeamIndexes.indexOf(index)] ?? [])
      : [];
    const reshuffledTeamModes = mode === "team"
      ? teamResultGroups.map((_, index) => lockedTeamIndexes.has(index) ? teamFormationMode(index) : "auto" as const)
      : [];
    const reshuffledTeamLocks = mode === "team"
      ? teamResultGroups.map((_, index) => lockedTeamIndexes.has(index))
      : [];
    const lockedDoublesIndexes = mode === "doubles"
      ? new Set(doublesResultGroups.flatMap((_, index) => isDoublesLocked(index) ? [index] : []))
      : new Set<number>();
    const lockedDoublesPlayerIds = new Set([...lockedDoublesIndexes].flatMap((index) => doublesResultGroups[index].players.map(formationPlayerId)));
    const unlockedDoublesIndexes = doublesResultGroups.flatMap((_, index) => lockedDoublesIndexes.has(index) ? [] : [index]);
    const reshuffledUnlockedDoubles = mode === "doubles" && unlockedDoublesIndexes.length > 0
      ? distributeSnake(reshuffleWithinLevel(programPlayers, nextTeamShuffleSeed).filter((player) => !lockedDoublesPlayerIds.has(formationPlayerId(player))), unlockedDoublesIndexes.map((index) => doublesResultGroups[index].players.length)).map((group) => group.players)
      : [];
    const reshuffledDoublesAssignments = mode === "doubles"
      ? doublesResultGroups.map((group, index) => lockedDoublesIndexes.has(index) ? group.players : reshuffledUnlockedDoubles[unlockedDoublesIndexes.indexOf(index)] ?? [])
      : [];
    const reshuffledDoublesModes = mode === "doubles"
      ? doublesResultGroups.map((_, index) => lockedDoublesIndexes.has(index) ? doublesFormationMode(index) : "auto" as const)
      : [];
    const reshuffledDoublesLocks = mode === "doubles" ? doublesResultGroups.map((_, index) => lockedDoublesIndexes.has(index)) : [];
    let propagateTeamFormation = false;
    const nextBlocks = storedProgram.blocks.map((block, index) => {
      if (mode === "team") {
        if (index === roundIndex) {
          propagateTeamFormation = true;
        } else if (
          index > roundIndex &&
          propagateTeamFormation &&
          !(storedProgram.rounds?.[index]?.inheritPreviousTeamFormation ?? block.inheritPreviousTeamFormation)
        ) {
          propagateTeamFormation = false;
        }
        if (propagateTeamFormation) {
          return {
            ...block,
            teamShuffleSeed: nextTeamShuffleSeed,
            teamAssignments: reshuffledTeamAssignments,
            teamAssignmentModes: reshuffledTeamModes,
            teamAssignmentLocks: reshuffledTeamLocks,
            groupAssignments: undefined,
          };
        }
      }
      if (index !== roundIndex) return block;
      if (mode === "team") {
        return {
          ...block,
          teamShuffleSeed: nextTeamShuffleSeed,
          teamAssignments: reshuffledTeamAssignments,
          teamAssignmentModes: reshuffledTeamModes,
          teamAssignmentLocks: reshuffledTeamLocks,
          groupAssignments: undefined,
        };
      }
      if (mode === "doubles") {
        return {
          ...block,
          teamShuffleSeed: (block.teamShuffleSeed ?? (roundIndex + 1) * 1000 + 101) + 1,
          doublesAssignments: reshuffledDoublesAssignments,
          doublesAssignmentModes: reshuffledDoublesModes,
          doublesAssignmentLocks: reshuffledDoublesLocks,
        };
      }
      return {
        ...block,
        groupShuffleSeed: (block.groupShuffleSeed ?? (roundIndex + 1) * 1000 + 503) + 1,
        groupAssignments: undefined,
      };
    });
    propagateTeamFormation = false;
    const nextRounds = storedProgram.rounds?.map((round, index) => {
      if (mode === "team") {
        if (index === roundIndex) {
          propagateTeamFormation = true;
        } else if (
          index > roundIndex &&
          propagateTeamFormation &&
          !(round.program === "TEAM" && round.inheritPreviousTeamFormation)
        ) {
          propagateTeamFormation = false;
        }
        if (propagateTeamFormation) {
          return {
            ...round,
            teamShuffleSeed: nextTeamShuffleSeed,
            teamAssignments: reshuffledTeamAssignments,
            teamAssignmentModes: reshuffledTeamModes,
            teamAssignmentLocks: reshuffledTeamLocks,
            groupAssignments: undefined,
          };
        }
      }
      if (index !== roundIndex) return round;
      if (mode === "team") {
        return {
          ...round,
          teamShuffleSeed: nextTeamShuffleSeed,
          teamAssignments: reshuffledTeamAssignments,
          teamAssignmentModes: reshuffledTeamModes,
          teamAssignmentLocks: reshuffledTeamLocks,
          groupAssignments: undefined,
        };
      }
      if (mode === "doubles") {
        return {
          ...round,
          teamShuffleSeed: (round.teamShuffleSeed ?? (roundIndex + 1) * 1000 + 101) + 1,
          doublesAssignments: reshuffledDoublesAssignments,
          doublesAssignmentModes: reshuffledDoublesModes,
          doublesAssignmentLocks: reshuffledDoublesLocks,
        };
      }
      return {
        ...round,
        groupShuffleSeed: (round.groupShuffleSeed ?? (roundIndex + 1) * 1000 + 503) + 1,
        groupAssignments: undefined,
      };
    });
    setReshuffleConfirmOpen(false);
    requestFormationSave(
      { ...storedProgram, blocks: nextBlocks, ...(nextRounds ? { rounds: nextRounds } : {}) },
      roundIndex,
    );
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    if (!id || !canManage) return;

    try {
      await deleteLeagueProgram({ leagueId: id }).unwrap();
      localStorage.removeItem(`league-program-${id}`);
      setStoredProgram(null);
      await deleteAllMatches({ leagueId: id }).unwrap();
    } catch {
      // 서버 삭제 실패 시 현재 프로그램 캐시를 유지합니다.
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", pb: embedded ? 0 : 8 }}>
      {!embedded && <>
      <Stack direction="row" alignItems="center" sx={{ px: 1, pt: 1.5, pb: 1 }}>
        <IconButton size="small" onClick={() => navigate(`/league/${id}`)} sx={{ mr: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 17, fontWeight: 900, flex: 1 }}>
          이벤트 프로그램
        </Typography>
        {canManage && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            onClick={() => navigate(`/league/${id}/program/new`)}
            sx={{
              borderRadius: "20px",
              fontSize: 12,
              fontWeight: 700,
              px: 1.5,
              height: 32,
              textTransform: "none",
              boxShadow: "none",
              bgcolor: "#2563EB",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            생성
          </Button>
        )}
      </Stack>

      {league && (
        <Stack direction="row" spacing={0.75} sx={{ px: 2, pb: 2, flexWrap: "wrap" }}>
          <Chip label={formatLeagueDate(league.start_date)} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />
          {league.type && <Chip label={league.type} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />}
          {league.rules && <Chip label={league.rules} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F1F5F9", color: "#475569", height: 24 }} />}
        </Stack>
      )}
      </>}

      <Box sx={{ px: embedded ? 0 : 2 }}>
        {hasProgram ? (
          <Box sx={{ bgcolor: "#fff", border: embedded ? 0 : "1px solid #E5E7EB", borderRadius: embedded ? 0 : 2, overflow: "hidden", boxShadow: embedded ? "none" : "0 1px 4px rgba(0,0,0,0.05)" }}>
            {!embedded && <Box sx={{ height: 4, bgcolor: "#2563EB", borderRadius: "8px 8px 0 0" }} />}

            <Box sx={{ px: embedded ? 0 : 2.5, pt: embedded ? 0.5 : 2, pb: embedded ? 1 : 2 }}>
              {!embedded && <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AccountTreeOutlinedIcon sx={{ fontSize: 20, color: "#2563EB" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>
                    {storedProgram?.title ?? `${league?.type ?? "클럽 이벤트"} 프로그램`}
                  </Typography>
                  {league?.start_date && (
                    <Typography sx={{ fontSize: 12, color: "#94A3B8", mt: 0.2 }}>
                      {formatLeagueDate(league.start_date)}
                    </Typography>
                  )}
                </Box>
              </Stack>}

              {(advancementLabel || (!embedded && seedingLabel)) && <Stack direction="row" spacing={0.75} flexWrap="wrap" mb={2}>
                {advancementLabel && <Chip label={advancementLabel} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F5F3FF", color: "#7C3AED", height: 22, border: "1px solid #DDD6FE" }} />}
                {!embedded && seedingLabel && <Chip label={`시드: ${seedingLabel}`} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: "#F0FDF4", color: "#16A34A", height: 22, border: "1px solid #BBF7D0" }} />}
              </Stack>}

              <Stack spacing={1}>
                {programRounds.map((round) => (
                  <Box key={round.round} sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, p: 1.25, bgcolor: "#F9FAFB" }}>
                    <Stack direction="row" alignItems="center" spacing={0.6} mb={1} flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, mr: 0.25 }}>
                        {round.round}라운드
                      </Typography>
                      <Chip label={round.typeLabel} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }} />
                      <Chip label={round.formatLabel} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }} />
                      <Chip label={round.matchRuleLabel} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }} />
                    </Stack>

                    {round.type === "TEAM" && (
                      <Typography sx={{ mb: 1, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                        단식 {round.teamSinglesCount ?? 3}경기, 복식 {round.teamDoublesCount ?? 0}경기
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        disableElevation
                        endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(`/league/${id}/program/matches?program=1&round=${round.round}`)}
                        sx={{ flex: 1, height: 38, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#2563EB", color: "#2563EB", "&:hover": { bgcolor: "#EFF6FF" } }}
                      >
                        경기 순서
                      </Button>
                      <Button
                        variant="contained"
                        disableElevation
                        endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                        onClick={() => navigate(`/league/${id}/program/${round.bracketPath}?program=1&round=${round.round}&format=${round.format}`)}
                        sx={{ flex: 1, height: 38, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", boxShadow: "none", whiteSpace: "nowrap", bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
                      >
                        {round.bracketLabel}
                      </Button>
                    </Stack>

                    {(round.type === "TEAM" || round.type === "DOUBLES" || round.format === "GROUP") && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {canManage && round.format === "GROUP" && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => openGroupStructureDialog(round.round - 1)}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            조 편성 구조
                          </Button>
                        )}
                        {round.type === "TEAM" && (round.teamFormationPublished || canManage) && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => round.teamFormationPublished ? setFormationDialog({ roundIndex: round.round - 1, mode: "team" }) : void publishFormation(round.round - 1, "team")}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            {round.teamFormationPublished ? "팀 편성 결과" : "팀 편성하기"}
                          </Button>
                        )}
                        {round.type === "DOUBLES" && (round.doublesFormationPublished || canManage) && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => round.doublesFormationPublished ? setFormationDialog({ roundIndex: round.round - 1, mode: "doubles" }) : void publishFormation(round.round - 1, "doubles")}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            {round.doublesFormationPublished ? "복식 편성 결과" : "복식 편성하기"}
                          </Button>
                        )}
                        {round.format === "GROUP" && (round.groupFormationPublished || canManage) && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => round.groupFormationPublished ? setFormationDialog({ roundIndex: round.round - 1, mode: "group" }) : void publishFormation(round.round - 1, "group")}
                            sx={{ flex: 1, height: 34, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap" }}
                          >
                            {round.groupFormationPublished ? "조 편성 결과" : "조 편성하기"}
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                ))}

                {canManage && !embedded && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlinedIcon sx={{ fontSize: 15 }} />}
                      onClick={() => navigate(`/league/${id}/program/new?edit=true`)}
                      sx={{ flex: 1, height: 36, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#E5E7EB", color: "#6B7280", "&:hover": { bgcolor: "#F9FAFB" } }}
                    >
                      프로그램 수정
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DeleteOutlineIcon sx={{ fontSize: 15 }} />}
                      onClick={() => setConfirmOpen(true)}
                      disabled={isDeleting}
                      sx={{ flex: 1, height: 36, fontWeight: 700, fontSize: 12, borderRadius: 1.5, textTransform: "none", whiteSpace: "nowrap", borderColor: "#FEE2E2", color: "#EF4444", "&:hover": { bgcolor: "#FFF5F5" } }}
                    >
                      삭제
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Box>
        ) : (
          <Box sx={{ bgcolor: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 2, py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AccountTreeOutlinedIcon sx={{ fontSize: 26, color: "#94A3B8" }} />
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                프로그램이 없습니다
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 0.3 }}>
                {canManage ? "프로그램을 생성해 주세요." : "아직 프로그램이 생성되지 않았습니다."}
              </Typography>
            </Box>
            {canManage && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<AddIcon />}
                onClick={() => navigate(`/league/${id}/program/new`)}
                sx={{ mt: 0.5, borderRadius: 1.5, fontWeight: 700, fontSize: 13, textTransform: "none", boxShadow: "none", bgcolor: "#2563EB", "&:hover": { bgcolor: "#1D4ED8" } }}
              >
                프로그램 생성
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Dialog
        open={groupStructureRoundIndex !== null}
        onClose={closeGroupStructureDialog}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>조 편성 구조</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {groupStructureOptions.map((option) => {
              const selected = option.groups.length === pendingGroupStructureSizes.length
                && option.groups.every((size, index) => size === pendingGroupStructureSizes[index]);
              return (
                <Box
                  key={option.groups.join("-")}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPendingGroupStructureSizes(option.groups)}
                  sx={{
                    border: selected ? "2px solid #3B82F6" : "1px solid #D1D5DB",
                    borderRadius: 1.5,
                    p: 2,
                    bgcolor: selected ? "#EFF6FF" : "#FFF",
                    cursor: "pointer",
                  }}
                >
                  {option.recommended && <Typography sx={{ mb: 0.5, color: "#2563EB", fontSize: 12, fontWeight: 800 }}>추천</Typography>}
                  <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{option.groups.length}개 조</Typography>
                  <Typography sx={{ mt: 0.5, color: "#6B7280", fontSize: 13 }}>
                    {option.groups.map((size) => `${size}인`).join(" / ")}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 2 }}>
          <Button onClick={closeGroupStructureDialog}>취소</Button>
          <Button variant="contained" onClick={() => void saveGroupStructure()} disabled={isSavingFormation}>완료</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={formationDialog !== null}
        onClose={closeFormationDialog}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
          {formationDialog?.mode === "team" ? "팀 편성 결과" : formationDialog?.mode === "doubles" ? "복식 편성 결과" : "조 편성 결과"}
          {canManage && !isFormationEditing && (
            <Tooltip title="수동 편성">
              <IconButton size="small" onClick={beginFormationEditing} aria-label="수동 편성">
                <EditOutlinedIcon fontSize="small" />
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
              {formationDialog?.mode === "doubles" && (
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
                    label={formationDialog?.mode === "team" || formationDialog?.mode === "doubles" ? `${String.fromCharCode(65 + index)}팀` : `${index + 1}조`}
                    locked={formationDialog?.mode === "team" ? isTeamLocked(index) : formationDialog?.mode === "doubles" ? isDoublesLocked(index) : false}
                    teamMode={formationDialog?.mode === "team" ? teamFormationMode(index) : formationDialog?.mode === "doubles" ? doublesFormationMode(index) : undefined}
                  />
                ))}
              </Box>
            </DndContext>
          ) : formationGroups.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary", py: 2, textAlign: "center" }}>
              편성 결과가 없습니다.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 1.25,
              }}
            >
            {formationGroups.map((group, groupIndex) => {
              const accent = FORMATION_COLORS[groupIndex % FORMATION_COLORS.length];
              return (
            <Box
              key={group.name}
              sx={{
                border: "1px solid #E5E7EB",
                borderTop: `3px solid ${accent}`,
                borderRadius: 1.5,
                bgcolor: "#fff",
                overflow: "hidden",
              }}
            >
              <Box sx={{ px: 1.5, py: 1.1, bgcolor: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
                {formationDialog?.mode === "team" || formationDialog?.mode === "doubles" ? `${String.fromCharCode(65 + groupIndex)}팀` : group.name}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {(formationDialog?.mode === "team" || formationDialog?.mode === "doubles") && (
                  <Chip
                    label={(formationDialog?.mode === "team" ? teamFormationMode(groupIndex) : doublesFormationMode(groupIndex)) === "manual" ? "수동" : "자동"}
                    size="small"
                    sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: (formationDialog?.mode === "team" ? teamFormationMode(groupIndex) : doublesFormationMode(groupIndex)) === "manual" ? "#FEF3C7" : "#DBEAFE", color: (formationDialog?.mode === "team" ? teamFormationMode(groupIndex) : doublesFormationMode(groupIndex)) === "manual" ? "#B45309" : "#1D4ED8" }}
                  />
                )}
                {formationDialog?.mode === "team" && canManage && (
                  <Tooltip title={isTeamLocked(groupIndex) ? "팀 잠금 해제" : "팀 잠금"}>
                    <IconButton
                      size="small"
                      onClick={() => void toggleTeamLock(groupIndex)}
                      disabled={isSavingFormation}
                      aria-label={isTeamLocked(groupIndex) ? "팀 잠금 해제" : "팀 잠금"}
                      sx={{ width: 22, height: 22, color: isTeamLocked(groupIndex) ? "#D97706" : "#94A3B8" }}
                    >
                      {isTeamLocked(groupIndex) ? <LockOutlinedIcon sx={{ fontSize: 15 }} /> : <LockOpenOutlinedIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                  </Tooltip>
                )}
                {formationDialog?.mode === "doubles" && canManage && (
                  <Tooltip title={isDoublesLocked(groupIndex) ? "복식 잠금 해제" : "복식 잠금"}>
                    <IconButton size="small" onClick={() => void toggleDoublesLock(groupIndex)} disabled={isSavingFormation} aria-label={isDoublesLocked(groupIndex) ? "복식 잠금 해제" : "복식 잠금"} sx={{ width: 22, height: 22, color: isDoublesLocked(groupIndex) ? "#D97706" : "#94A3B8" }}>
                      {isDoublesLocked(groupIndex) ? <LockOutlinedIcon sx={{ fontSize: 15 }} /> : <LockOpenOutlinedIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                  </Tooltip>
                )}
                <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 700 }}>
                  {group.players.length}{isDoublesGroupResult ? "팀" : "명"}
                </Typography>
              </Stack>
              </Box>
              <Stack spacing={0.75} sx={{ px: 1.5, py: 1.25 }}>
                {group.players.map((player) => {
                  const roster = (player as typeof player & { roster?: Array<{ name: string; level: number }> }).roster;
                  return (
                    <Box key={player.name}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                        {isDoublesGroupResult && roster
                          ? formatFormationName(player.name, player.level)
                          : `${hasFormationLevel(player.level) ? `${player.level}부` : "-"} - ${formatFormationName(player.name, player.level)}`}
                      </Typography>
                      {roster && (
                        <Box sx={{ pl: isDoublesGroupResult ? 0 : 1.5, mt: 0.5, color: "#6B7280" }}>
                          {roster.map((member) => (
                            <Typography key={member.name} sx={{ fontSize: 12 }}>
                              {hasFormationLevel(member.level) ? `${member.level}부` : "-"} - {formatFormationName(member.name, member.level)}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
              <Box sx={{ borderTop: "1px solid #E5E7EB", px: 1.5, py: 0.9 }}>
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
        <DialogActions sx={{ px: 2, pb: 2 }}>
          {isFormationEditing ? (
            <>
              <Button onClick={() => { setIsFormationEditing(false); setFormationDraft([]); }} disabled={isSavingFormation}>취소</Button>
              <Button
                variant="contained"
                onClick={() => void saveManualFormation()}
                disabled={isSavingFormation || (formationDialog?.mode === "doubles" && formationDraft.some((group) => group.length !== 2))}
              >
                완료
              </Button>
            </>
          ) : (
            <>
              {canManage && (
                <Button variant="outlined" onClick={() => setReshuffleConfirmOpen(true)} disabled={isSavingFormation}>
                  재편성
                </Button>
              )}
              <Button onClick={closeFormationDialog} sx={{ fontWeight: 700 }} disabled={isSavingFormation}>
                닫기
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={reshuffleConfirmOpen}
        onClose={() => setReshuffleConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>
          {formationDialog?.mode === "team" ? "팀 재편성" : formationDialog?.mode === "doubles" ? "복식 재편성" : "조 재편성"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14, color: "text.primary" }}>
            {formationDialog?.mode === "team"
              ? "전체 팀 편성을 전부 재편성하겠습니까?"
              : formationDialog?.mode === "doubles"
                ? "전체 복식 편성을 전부 재편성하겠습니까?"
              : "전체 조 편성을 전부 재편성하겠습니까?"}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setReshuffleConfirmOpen(false)} disabled={isSavingFormation}>취소</Button>
          <Button variant="contained" onClick={() => void reshuffleFormation()} disabled={isSavingFormation}>확인</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingFormationSave !== null}
        onClose={() => setPendingFormationSave(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>
          프로그램 수정 적용
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14, color: "text.primary" }}>
            프로그램 구성이 변경되면 기존 대진표의 연결 관계가 달라질 수 있습니다.<br />
            원활한 진행을 위해 대진표 초기화를 권장합니다.<br />
            기존 경기를 유지하면 종료되었거나 진행 중인 경기는 그대로 유지됩니다.<br />
            변경사항은 아직 시작하지 않은 경기에만 적용됩니다.<br />
            대진표를 초기화하면 기존 경기 결과와 진행 상태가 모두 삭제되고 대진표가 새로 생성됩니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={() => void finishFormationSave(false)}
            disabled={isSavingFormation}
            sx={{ fontWeight: 700 }}
          >
            기존 경기 유지
          </Button>
          <Button
            variant="contained"
            onClick={() => void finishFormationSave(true)}
            disabled={isSavingFormation}
            disableElevation
            sx={{
              bgcolor: "#EF4444",
              "&:hover": { bgcolor: "#DC2626" },
              fontWeight: 700,
            }}
          >
            대진표 초기화
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} slotProps={{ paper: { sx: { borderRadius: 2, mx: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: 16 }}>프로그램 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            생성된 프로그램을 삭제하면 프로그램 경기 정보가 사라집니다. 계속하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: "text.secondary", fontWeight: 700 }}>
            취소
          </Button>
          <Button onClick={handleDelete} variant="contained" disableElevation sx={{ bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" }, fontWeight: 700, borderRadius: 1 }}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
