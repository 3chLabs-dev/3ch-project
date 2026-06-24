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
}

export interface ProgramBlock {
  title: string;
  startMinutes?: number;
  endMinutes?: number;

  type:
    | "SINGLES"
    | "DOUBLES"
    | "TEAM";

  matchRule: MatchRule;
  expectedMinutes: number;
  matchCount: number;
  description?: string;
}

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
  teamPlayerCount: number;
  teamMatchType: TeamLineupType;
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