import { generateGroupOptions } from "./generateGroupOptions";
import { generateProgramBlocks } from "./generateProgramBlocks";
import { calculateDuration } from "./calculateDuration";

import type {
  MatchRule,
  MatchRuleType,
  ProgramOption,
  ProgramPreferences,
  ProgramType,
  RoundConfig,
  RoundFormat,
  TeamLineupType,
} from "../types/tournament.types";

interface GenerateProgramOptionsInput {
  playerCount: number;
  courtCount: number;
  rentalMinutes: number;
  rentalStartMinutes: number;
  preferences: ProgramPreferences;
}

type RecommendationType =
  | "regular"
  | "balanced"
  | "fast";

interface RecommendationProfile {
  type: RecommendationType;
  title: string;
  description: string;
  idealUsageRate: number;
  weights: {
    totalMatches: number;
    averageMatches: number;
    timeUsage: number;
    diversity: number;
    rankAccuracy: number;
    speed: number;
    timeBuffer: number;
  };
}

interface CandidateMetrics {
  totalMatchesScore: number;
  averageMatchesScore: number;
  timeUsageScore: number;
  diversityScore: number;
  rankAccuracyScore: number;
  speedScore: number;
  timeBufferScore: number;
}

interface ProgramCandidate {
  option: ProgramOption;
  rounds: RoundConfig[];
  metrics: CandidateMetrics;
}

const RECOMMENDATION_PROFILES: RecommendationProfile[] = [
  {
    type: "regular",
    title: "✨정규 경기",
    description:
      "순위 정확도와 경기 품질을 우선으로 구성한 프로그램입니다.",
    idealUsageRate: 0.92,
    weights: {
      totalMatches: 18,
      averageMatches: 16,
      timeUsage: 14,
      diversity: 8,
      rankAccuracy: 32,
      speed: 2,
      timeBuffer: 10,
    },
  },
  {
    type: "balanced",
    title: "⚖️밸런스형",
    description:
      "종목 경험, 경기 수, 진행시간의 균형을 맞춘 프로그램입니다.",
    idealUsageRate: 0.82,
    weights: {
      totalMatches: 13,
      averageMatches: 14,
      timeUsage: 18,
      diversity: 26,
      rankAccuracy: 16,
      speed: 5,
      timeBuffer: 8,
    },
  },
  {
    type: "fast",
    title: "⚡빠른 진행",
    description:
      "빠른 종료와 대관시간 여유를 우선으로 구성한 프로그램입니다.",
    idealUsageRate: 0.62,
    weights: {
      totalMatches: 7,
      averageMatches: 8,
      timeUsage: 12,
      diversity: 10,
      rankAccuracy: 10,
      speed: 30,
      timeBuffer: 23,
    },
  },
];

const MATCH_RULES: MatchRuleType[] = [
  "BEST_OF_5",
  "THREE_SET",
  "BEST_OF_3",
];

const TEAM_LINEUPS: TeamLineupType[] = [
  "SSS",
  "SDS",
  "DSD",
  "DDD",
];

function getAvailablePrograms(
  preferences: ProgramPreferences
): ProgramType[] {
  const programs: ProgramType[] = [];
  const preferredOrder =
    preferences.programOrder.length > 0
      ? preferences.programOrder
      : (["SINGLES", "DOUBLES", "TEAM"] as ProgramType[]);

  for (const program of preferredOrder) {
    if (
      program === "SINGLES" &&
      preferences.singlesEnabled &&
      !programs.includes(program)
    ) {
      programs.push(program);
    }

    if (
      program === "DOUBLES" &&
      preferences.doublesEnabled &&
      !programs.includes(program)
    ) {
      programs.push(program);
    }

    if (
      program === "TEAM" &&
      preferences.teamEnabled &&
      !programs.includes(program)
    ) {
      programs.push(program);
    }
  }

  return programs.length > 0
    ? programs
    : ["SINGLES"];
}

function getTeamPlayerCounts(
  playerCount: number,
  preferredTeamPlayerCount: number
): number[] {
  const counts = [
    preferredTeamPlayerCount,
    4,
    3,
  ];

  return [...new Set(counts)].filter(
    (count) =>
      count >= 2 &&
      count <= 5 &&
      Math.ceil(playerCount / count) >= 2
  );
}

function createRound(
  id: number,
  program: ProgramType,
  format: RoundFormat,
  matchRule: MatchRuleType,
  teamPlayerCount: number,
  teamMatchType: TeamLineupType
): RoundConfig {
  return {
    id,
    expanded: true,
    program,
    format,
    option: id === 1 ? "PRELIM" : "NONE",
    matchRule,
    teamPlayerCount,
    teamMatchType,
  };
}

function getLeagueUnitCount(
  program: ProgramType,
  playerCount: number,
  teamPlayerCount: number
) {
  if (program === "DOUBLES") {
    return Math.floor(playerCount / 2);
  }

  if (program === "TEAM") {
    return Math.ceil(playerCount / teamPlayerCount);
  }

  return playerCount;
}

function canIncludeLeagueFormat(
  program: ProgramType,
  input: GenerateProgramOptionsInput,
  teamPlayerCount: number
) {
  const unitCount = getLeagueUnitCount(
    program,
    input.playerCount,
    teamPlayerCount
  );
  const matchCount =
    (unitCount * (unitCount - 1)) / 2;
  const minimumMinutes = calculateDuration(
    matchCount,
    input.courtCount,
    "3전 2선승제"
  );

  return minimumMinutes <= input.rentalMinutes * 0.75;
}

function getFormatCandidates(
  program: ProgramType,
  input: GenerateProgramOptionsInput,
  teamPlayerCount: number
): RoundFormat[] {
  const formats: RoundFormat[] = [];

  if (input.playerCount < 8) {
    formats.push("LEAGUE");

    if (
      input.courtCount <= 2 ||
      input.rentalMinutes < 120
    ) {
      formats.push("GROUP");
    }

    formats.push("TOURNAMENT");
    return formats;
  }

  if (input.playerCount <= 12) {
    formats.push(
      "LEAGUE",
      "GROUP",
      "TOURNAMENT"
    );
    return formats;
  }

  formats.push("GROUP");

  if (
    canIncludeLeagueFormat(
      program,
      input,
      teamPlayerCount
    )
  ) {
    formats.push("LEAGUE");
  }

  formats.push("TOURNAMENT");
  return formats;
}

function getMatchRuleCandidates(
  format: RoundFormat
): MatchRuleType[] {
  if (format === "LEAGUE") {
    return [
      "THREE_SET",
      "BEST_OF_3",
    ];
  }

  if (format === "TOURNAMENT") {
    return [
      "BEST_OF_3",
      "THREE_SET",
    ];
  }

  return MATCH_RULES;
}

function buildRoundChoices(
  id: number,
  program: ProgramType,
  input: GenerateProgramOptionsInput,
  teamPlayerCounts: number[]
): RoundConfig[] {
  if (program === "SINGLES") {
    return getFormatCandidates(
      program,
      input,
      input.preferences.teamPlayerCount
    ).flatMap((format) =>
      getMatchRuleCandidates(format).map(
        (matchRule) =>
          createRound(
            id,
            program,
            format,
            matchRule,
            input.preferences.teamPlayerCount,
            "SSS"
          )
      )
    );
  }

  if (program === "DOUBLES") {
    return getFormatCandidates(
      program,
      input,
      input.preferences.teamPlayerCount
    ).flatMap((format) =>
      getMatchRuleCandidates(format).map(
        (matchRule) =>
          createRound(
            id,
            program,
            format,
            matchRule,
            input.preferences.teamPlayerCount,
            "SSS"
          )
      )
    );
  }

  const choices: RoundConfig[] = [];

  for (const teamPlayerCount of teamPlayerCounts) {
    const formats = getFormatCandidates(
      program,
      input,
      teamPlayerCount
    );

    for (const format of formats) {
      for (const matchRule of getMatchRuleCandidates(format)) {
        for (const teamMatchType of TEAM_LINEUPS) {
          choices.push(
            createRound(
              id,
              program,
              format,
              matchRule,
              teamPlayerCount,
              teamMatchType
            )
          );
        }
      }
    }
  }

  return choices;
}

function buildProgramSequences(
  programs: ProgramType[],
  maxRoundCount: number
): ProgramType[][] {
  const sequences: ProgramType[][] = [];

  function visit(sequence: ProgramType[]) {
    if (sequence.length > 0) {
      sequences.push(sequence);
    }

    if (sequence.length === maxRoundCount) {
      return;
    }

    for (const program of programs) {
      visit([...sequence, program]);
    }
  }

  visit([]);

  return sequences;
}

function cartesianLimited<T>(
  items: T[][],
  limit: number
): T[][] {
  let result: T[][] = [[]];

  for (const values of items) {
    const next: T[][] = [];

    for (const prefix of result) {
      for (const value of values) {
        next.push([...prefix, value]);

        if (next.length >= limit) {
          break;
        }
      }

      if (next.length >= limit) {
        break;
      }
    }

    result = next;
  }

  return result;
}

function buildRoundCandidates(
  input: GenerateProgramOptionsInput
): RoundConfig[][] {
  const maxCandidateCount = 2500;
  const programs = getAvailablePrograms(
    input.preferences
  );
  const maxRoundCount =
    input.rentalMinutes >= 240 ? 3 : 2;
  const sequences = buildProgramSequences(
    programs,
    maxRoundCount
  );
  const teamPlayerCounts = getTeamPlayerCounts(
    input.playerCount,
    input.preferences.teamPlayerCount
  );
  const candidates: RoundConfig[][] = [];

  for (const sequence of sequences) {
    if (candidates.length >= maxCandidateCount) {
      break;
    }

    const perRoundChoices = sequence.map(
      (program, index) =>
        buildRoundChoices(
          index + 1,
          program,
          input,
          teamPlayerCounts
        )
    );
    const sequenceCandidates = cartesianLimited(
      perRoundChoices,
      maxCandidateCount - candidates.length
    );

    for (const candidate of sequenceCandidates) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function addSchedule(
  blocks: ProgramOption["blocks"],
  rentalStartMinutes: number
): ProgramOption["blocks"] {
  let elapsedMinutes = 0;

  return blocks.map((block) => {
    const startMinutes =
      rentalStartMinutes + elapsedMinutes;
    const endMinutes =
      startMinutes + block.expectedMinutes;

    elapsedMinutes += block.expectedMinutes;

    return {
      ...block,
      startMinutes,
      endMinutes,
    };
  });
}

function getAverageMatchesPerPlayer(
  blocks: ProgramOption["blocks"],
  playerCount: number
): number {
  const playerMatchSlots = blocks.reduce(
    (sum, block) => {
      if (block.type === "DOUBLES") {
        return sum + block.matchCount * 4;
      }

      return sum + block.matchCount * 2;
    },
    0
  );

  return playerMatchSlots / playerCount;
}

function getDiversityScore(
  rounds: RoundConfig[]
): number {
  const uniquePrograms = new Set(
    rounds.map((round) => round.program)
  ).size;
  const uniqueRules = new Set(
    rounds.map((round) => round.matchRule)
  ).size;
  const teamRounds = rounds.filter(
    (round) => round.program === "TEAM"
  );
  const mixedTeamLineupCount = teamRounds.filter(
    (round) => round.teamMatchType !== "SSS"
  ).length;
  const teamLineupScore = teamRounds.length === 0
    ? 100
    : (mixedTeamLineupCount / teamRounds.length) * 100;

  return Math.min(
    100,
    (uniquePrograms / 3) * 60 +
      (uniqueRules / MATCH_RULES.length) * 20 +
      teamLineupScore * 0.2
  );
}

function getFormatAccuracy(format: RoundFormat) {
  switch (format) {
    case "LEAGUE":
      return 100;
    case "GROUP":
      return 82;
    case "TOURNAMENT":
      return 46;
    default:
      return 60;
  }
}

function getRuleQuality(matchRule: MatchRuleType) {
  switch (matchRule) {
    case "BEST_OF_5":
      return 100;
    case "THREE_SET":
      return 78;
    case "BEST_OF_3":
      return 64;
    default:
      return 60;
  }
}

function getRankAccuracyScore(
  rounds: RoundConfig[],
  averageGroupSize: number
): number {
  const formatScore =
    rounds.reduce(
      (sum, round) =>
        sum + getFormatAccuracy(round.format),
      0
    ) / rounds.length;
  const ruleScore =
    rounds.reduce(
      (sum, round) =>
        sum + getRuleQuality(round.matchRule),
      0
    ) / rounds.length;
  const groupScore = Math.max(
    0,
    100 - Math.abs(4.5 - averageGroupSize) * 18
  );

  return (
    formatScore * 0.48 +
    ruleScore * 0.32 +
    groupScore * 0.2
  );
}

function getTimeUsageScore(
  usageRate: number,
  idealUsageRate: number
): number {
  return Math.max(
    0,
    100 - Math.abs(idealUsageRate - usageRate) * 160
  );
}

function getCandidateMetrics(
  candidate: ProgramOption,
  rounds: RoundConfig[],
  input: GenerateProgramOptionsInput,
  profile: RecommendationProfile
): CandidateMetrics {
  const usageRate =
    candidate.totalProgramMinutes / input.rentalMinutes;
  const averageMatches = getAverageMatchesPerPlayer(
    candidate.blocks,
    input.playerCount
  );
  const averageGroupSize =
    (candidate.groupSizes ?? []).reduce(
      (sum, value) => sum + value,
      0
    ) / (candidate.groupSizes?.length || 1);

  return {
    totalMatchesScore: Math.min(
      100,
      candidate.totalBlockMatchCount * 2.5
    ),
    averageMatchesScore: Math.max(
      0,
      100 - Math.abs(3.8 - averageMatches) * 22
    ),
    timeUsageScore: getTimeUsageScore(
      usageRate,
      profile.idealUsageRate
    ),
    diversityScore: getDiversityScore(rounds),
    rankAccuracyScore: getRankAccuracyScore(
      rounds,
      averageGroupSize
    ),
    speedScore: Math.max(
      0,
      100 - usageRate * 100
    ),
    timeBufferScore: Math.max(
      0,
      (1 - usageRate) * 100
    ),
  };
}

function scoreCandidate(
  metrics: CandidateMetrics,
  profile: RecommendationProfile
): number {
  const weightedScore =
    metrics.totalMatchesScore * profile.weights.totalMatches +
    metrics.averageMatchesScore * profile.weights.averageMatches +
    metrics.timeUsageScore * profile.weights.timeUsage +
    metrics.diversityScore * profile.weights.diversity +
    metrics.rankAccuracyScore * profile.weights.rankAccuracy +
    metrics.speedScore * profile.weights.speed +
    metrics.timeBufferScore * profile.weights.timeBuffer;
  const totalWeight = Object.values(
    profile.weights
  ).reduce((sum, value) => sum + value, 0);

  return Math.round(weightedScore / totalWeight);
}

function getRepresentativeRule(
  blocks: ProgramOption["blocks"]
): MatchRule {
  return blocks[0]?.matchRule ?? "3전 2선승제";
}

function buildCandidate(
  input: GenerateProgramOptionsInput,
  groupSizes: number[],
  rounds: RoundConfig[],
  profile: RecommendationProfile
): ProgramCandidate | null {
  const roundsWithGroupSizes = rounds.map((round) => ({
    ...round,
    groupSizes: round.groupSizes ?? groupSizes,
  }));
  const blocks = addSchedule(
    generateProgramBlocks(
      {
        ...input.preferences,
        rounds: roundsWithGroupSizes,
      },
      input.playerCount,
      input.courtCount,
      groupSizes
    ),
    input.rentalStartMinutes
  );
  const totalBlockMatchCount = blocks.reduce(
    (sum, block) => sum + block.matchCount,
    0
  );
  const totalProgramMinutes = blocks.reduce(
    (sum, block) => sum + block.expectedMinutes,
    0
  );

  if (
    totalProgramMinutes <= 0 ||
    totalProgramMinutes > input.rentalMinutes
  ) {
    return null;
  }

  const option: ProgramOption = {
    title: profile.title,
    groupSizes,
    matchRule: getRepresentativeRule(blocks),
    matchCount: totalBlockMatchCount,
    expectedMinutes: totalProgramMinutes,
    recommendationScore: 0,
    description: profile.description,
    blocks,
    totalBlockMatchCount,
    totalProgramMinutes,
    isOverTime: false,
    rounds: roundsWithGroupSizes,
  };
  const metrics = getCandidateMetrics(
    option,
    roundsWithGroupSizes,
    input,
    profile
  );

  return {
    option: {
      ...option,
      recommendationScore: scoreCandidate(
        metrics,
        profile
      ),
    },
    rounds: roundsWithGroupSizes,
    metrics,
  };
}

function getFallbackCandidate(
  input: GenerateProgramOptionsInput,
  profile: RecommendationProfile
): ProgramOption {
  const groupSizes =
    generateGroupOptions(input.playerCount)[0]?.groups ?? [
      input.playerCount,
    ];
  const round = createRound(
    1,
    "SINGLES",
    "TOURNAMENT",
    "BEST_OF_3",
    input.preferences.teamPlayerCount,
    "SSS"
  );
  const roundWithGroupSizes = {
    ...round,
    groupSizes,
  };
  const blocks = addSchedule(
    generateProgramBlocks(
      {
        ...input.preferences,
        rounds: [roundWithGroupSizes],
      },
      input.playerCount,
      input.courtCount,
      groupSizes
    ),
    input.rentalStartMinutes
  );
  const totalBlockMatchCount = blocks.reduce(
    (sum, block) => sum + block.matchCount,
    0
  );
  const totalProgramMinutes = blocks.reduce(
    (sum, block) => sum + block.expectedMinutes,
    0
  );

  return {
    title: profile.title,
    groupSizes,
    matchRule: getRepresentativeRule(blocks),
    matchCount: totalBlockMatchCount,
    expectedMinutes: totalProgramMinutes,
    recommendationScore: 50,
    description: profile.description,
    blocks,
    totalBlockMatchCount,
    totalProgramMinutes,
    isOverTime:
      totalProgramMinutes > input.rentalMinutes,
    rounds: [roundWithGroupSizes],
  };
}

export function generateProgramOptions(
  input: GenerateProgramOptionsInput
): ProgramOption[] {
  const groupOptions = generateGroupOptions(
    input.playerCount
  );
  const roundCandidates = buildRoundCandidates(input);

  return RECOMMENDATION_PROFILES.map((profile) => {
    let bestCandidate: ProgramCandidate | null = null;

    for (const groupOption of groupOptions) {
      for (const rounds of roundCandidates) {
        const candidate = buildCandidate(
          input,
          groupOption.groups,
          rounds,
          profile
        );

        if (!candidate) {
          continue;
        }

        if (
          !bestCandidate ||
          candidate.option.recommendationScore >
            bestCandidate.option.recommendationScore
        ) {
          bestCandidate = candidate;
        }
      }
    }

    return bestCandidate?.option ??
      getFallbackCandidate(input, profile);
  });
}
