export type MatchRule =
  | "3전 2선승제"
  | "3세트제"
  | "5전 3선승제";

export type EventType =
  | "SINGLES"
  | "DOUBLES"
  | "TEAM";

export type DoublesPairingType =
  | "지정"
  | "랜덤"
  | "실력균형";

export interface TeamConfig {
  teamSize: number;

  matches: TeamMatchType[];

  winCondition: number;
}

export interface EventConfig {
  type: EventType;

  matchRule: MatchRule;
  ruleSwitchSize?: number;
  lateMatchRule?: MatchRule;

  enabled: boolean;
}

export interface SinglesEventConfig extends EventConfig {
  type: "SINGLES";

  playoffEnabled: boolean;

  playoffSize?: number;
}

export interface DoublesEventConfig extends EventConfig {
  type: "DOUBLES";

  pairingType: DoublesPairingType;

  playoffEnabled: boolean;

  playoffSize?: number;
}

export interface TeamEventConfig extends EventConfig {
  type: "TEAM";

  teamConfig: TeamConfig;
}

export interface TournamentConfig {
  playerCount: number;

  courtCount: number;

  rentalMinutes: number;

  breakMinutes?: number;

  events: (
    | SinglesEventConfig
    | DoublesEventConfig
    | TeamEventConfig
  )[];
}

export interface ProgramOption {
  title: string;
  groupSizes: number[];
  matchRule: MatchRule;
  matchCount: number;
  expectedMinutes: number;
  recommendationScore: number;
  description: string;
  blocks: ProgramBlock[];
  totalBlockMatchCount: number;
  totalProgramMinutes: number;
  isOverTime: boolean;
  rounds?: RoundConfig[];
  roundStandings?: ProgramRoundStandingsSnapshot[];
  roundTieBreaks?: ProgramRoundTieBreak[];
}

export interface ProgramRoundTieBreak {
  round: number;
  poolLabel: string;
  participantIds: string[];
  updatedAt: string;
}

export interface ProgramRoundStandingPool {
  label: string;
  complete: boolean;
  participantIds: string[];
}

export interface ProgramRoundStandingsSnapshot {
  round: number;
  complete: boolean;
  pools: ProgramRoundStandingPool[];
  updatedAt: string;
}

export interface ProgramBlock {
  title: string;
  startMinutes?: number;
  endMinutes?: number;
  roundOption?: RoundOption;

  type:
    | "SINGLES"
    | "DOUBLES"
    | "TEAM";

  matchRule: MatchRule;
  nextMatchRule?: MatchRule;
  ruleSwitchSize?: number;
  lateMatchRule?: MatchRule;
  lowerMatchRule?: MatchRule;
  lowerRuleSwitchSize?: number;
  lowerLateMatchRule?: MatchRule;
  format?: RoundFormat;
  expectedMinutes: number;
  matchCount: number;
  description?: string;
  groupSizes?: number[];
  teamGroupSizes?: number[];
  teamPlayerCount?: number;
  teamFormationSizes?: number[];
  groupShuffleSeed?: number;
  teamShuffleSeed?: number;
  groupAssignments?: FormationAssignmentPlayer[][];
  /** 본선 자동 편성을 관리자가 직접 수정했는지 여부. */
  groupFormationCustomized?: boolean;
  /** 완전한 조 목록으로 저장된 수동 편성의 스키마 버전. */
  groupFormationSchemaVersion?: number;
  teamAssignments?: FormationAssignmentPlayer[][];
  /** How each saved team was formed. Missing values are kept for older programs. */
  teamAssignmentModes?: Array<"manual" | "auto">;
  /** Teams preserved when the remaining teams are reshuffled. */
  teamAssignmentLocks?: boolean[];
  doublesAssignments?: FormationAssignmentPlayer[][];
  doublesAssignmentModes?: Array<"manual" | "auto">;
  doublesAssignmentLocks?: boolean[];
  tournamentBracketCount?: number;
  thirdPlaceMatch?: boolean;
  tournamentSeeding?: TournamentSeedingType;
  tournamentMode?: TournamentMode;
  finalAdvancementMode?: FinalAdvancementMode;
  advanceCount?: number;
  sourceRoundId?: number;
  crossClubGrouping?: boolean;
  crossClubOnlyMatches?: boolean;
  halfSplitOnlyMatches?: boolean;
  unitClubMode?: UnitClubMode;
  participantOrder?: string[];
  /** 수정 모드에서 관리자가 명시적으로 저장한 표시 순서인지 여부. */
  participantOrderCustomized?: boolean;
  /** 상단vs하단 경기 구성을 고정할 때 사용하는 참가자 순서. */
  halfSplitMatchOrder?: string[];
  /** NO-GAME 정책에서 관리자가 수동 복구한 경기 ID. */
  restoredMatchIds?: string[];
  deletedMatchIds?: string[];
  /** 모든 기기의 이 시각 이전 로컬 경기 패치를 폐기하기 위한 초기화 버전. */
  matchStateResetAt?: string;
  teamSinglesCount?: number;
  teamDoublesCount?: number;
  inheritPreviousTeamFormation?: boolean;
}

export interface FormationAssignmentPlayer {
  name: string;
  level: number;
  sourceGroupId?: string | null;
  roster?: FormationAssignmentPlayer[];
}

export type UnitClubMode = "same" | "mixed";

export type TeamMatchType =
  | "SINGLES"
  | "DOUBLES";

export type ProgramType =
  | "SINGLES"
  | "DOUBLES"
  | "TEAM";

export type RoundFormat =
  | "LEAGUE"
  | "GROUP"
  | "TOURNAMENT";

export type TournamentSeedingType =
  | "seed"
  | "random"
  | "manual";

export type TournamentMode =
  | "single"
  | "upper-lower";

export type FinalAdvancementMode =
  | "top-n"
  | "all"
  | "upper-lower-groups"
  | "rank-groups";

export type RoundOption =
  | "NONE"
  | "PRELIM"
  | "FINAL"
  | "UPPER"
  | "LOWER";

export type MatchRuleType =
  | "BEST_OF_3"
  | "BEST_OF_5"
  | "THREE_SET";

export type TeamLineupType =
  | "SSS"
  | "SDS"
  | "DSD"
  | "DDD";

export interface RoundConfig {
  id: number;
  expanded: boolean;
  program: ProgramType;
  format: RoundFormat;
  option: RoundOption;
  matchRule: MatchRuleType;
  nextMatchRule?: MatchRuleType;
  ruleSwitchSize?: number;
  lateMatchRule?: MatchRuleType;
  lowerMatchRule?: MatchRuleType;
  lowerRuleSwitchSize?: number;
  lowerLateMatchRule?: MatchRuleType;
  teamPlayerCount: number;
  teamFormationSizes?: number[];
  teamMatchType: TeamLineupType;
  teamSinglesCount?: number;
  teamDoublesCount?: number;
  inheritPreviousTeamFormation?: boolean;
  groupSizes?: number[];
  teamGroupSizes?: number[];
  groupShuffleSeed?: number;
  teamShuffleSeed?: number;
  groupAssignments?: FormationAssignmentPlayer[][];
  groupFormationCustomized?: boolean;
  groupFormationSchemaVersion?: number;
  teamAssignments?: FormationAssignmentPlayer[][];
  teamAssignmentModes?: Array<"manual" | "auto">;
  teamAssignmentLocks?: boolean[];
  doublesAssignments?: FormationAssignmentPlayer[][];
  doublesAssignmentModes?: Array<"manual" | "auto">;
  doublesAssignmentLocks?: boolean[];
  tournamentBracketCount?: number;
  thirdPlaceMatch?: boolean;
  tournamentSeeding?: TournamentSeedingType;
  tournamentMode?: TournamentMode;
  finalAdvancementMode?: FinalAdvancementMode;
  advanceCount?: number;
  sourceRoundId?: number;
  crossClubGrouping?: boolean;
  crossClubOnlyMatches?: boolean;
  halfSplitOnlyMatches?: boolean;
  unitClubMode?: UnitClubMode;
  participantOrder?: string[];
  participantOrderCustomized?: boolean;
  /** 상단vs하단 경기 구성을 고정할 때 사용하는 참가자 순서. */
  halfSplitMatchOrder?: string[];
  /** NO-GAME 정책에서 관리자가 수동 복구한 경기 ID. */
  restoredMatchIds?: string[];
  /** 모든 기기의 이 시각 이전 로컬 경기 패치를 폐기하기 위한 초기화 버전. */
  matchStateResetAt?: string;
}

export interface ProgramPreferences {
  singlesEnabled: boolean;
  doublesEnabled: boolean;
  teamEnabled: boolean;
  teamMatchRounds: TeamMatchType[];
  programOrder: ProgramType[];
  teamPlayerCount: number;

  rounds?: RoundConfig[];
}
