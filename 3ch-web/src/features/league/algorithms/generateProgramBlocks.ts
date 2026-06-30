import { calculateDuration } from "./calculateDuration";
import { calculateGroupMatchCount, calculateRoundRobinMatchCount, calculateTournamentMatchCount, } from "./calculateMatchCount";

import {
  calculateTeamCount,
  calculateTeamLeagueMatchCount,
  calculateTeamGroupMatchCount,
  calculateTeamTournamentMatchCount,
} from "./calculateTeamMatchCount";

import type {
  ProgramBlock,
  ProgramPreferences,
} from "../types/tournament.types";

type UnscheduledProgramBlock = Omit<
  ProgramBlock,
  "startMinutes" | "endMinutes"
>;

function getOptionLabel(option: string) {
  switch (option) {
    case "PRELIM":
      return "예선";
    case "FINAL":
      return "본선";
    case "UPPER":
      return "상위";
    case "LOWER":
      return "하위";
    default:
      return "";
  }
}

function getMatchRuleLabel(
  matchRule: string
) {
  switch (matchRule) {
    case "BEST_OF_5":
      return "5전 3선승제";

    case "THREE_SET":
      return "3세트제";

    default:
      return "3전 2선승제";
  }
}

export function generateProgramBlocks(
  preferences: ProgramPreferences,
  playerCount: number,
  courtCount: number,
  groupSizes: number[]
): UnscheduledProgramBlock[] {
  
  const doublesMatchCount =
    Math.floor(playerCount * 0.75);

  function getTeamMatchInfo(
    teamMatchType: string
  ) {
    switch (teamMatchType) {
      case "SSS":
        return {
          singles: 3,
          doubles: 0,
          description:
            "단식 / 단식 / 단식",
        };

      case "SDS":
        return {
          singles: 2,
          doubles: 1,
          description:
            "단식 / 복식 / 단식",
        };

      case "DSD":
        return {
          singles: 1,
          doubles: 2,
          description:
            "복식 / 단식 / 복식",
        };

      case "DDD":
        return {
          singles: 0,
          doubles: 3,
          description:
            "복식 / 복식 / 복식",
        };

      default:
        return {
          singles: 3,
          doubles: 0,
          description:
            "단식 / 단식 / 단식",
        };
    }
  }

  const blocks: UnscheduledProgramBlock[] = [];
  const rounds = preferences.rounds ?? [];
  for (const round of rounds) {
  const roundGroupSizes =
    round.groupSizes ?? groupSizes;

  if (round.program === "SINGLES") {
    let matchCount = 0;

    if (round.format === "LEAGUE") {
      matchCount =
        calculateRoundRobinMatchCount(
          playerCount
        );
    }

    if (round.format === "GROUP") {
      matchCount =
        calculateGroupMatchCount(
          roundGroupSizes
        );
    }

    if (round.format === "TOURNAMENT") {
      matchCount =
        calculateTournamentMatchCount(
          playerCount
        );
    }

  const duration =
    calculateDuration(
      matchCount,
      courtCount,
      getMatchRuleLabel(round.matchRule)
    );

  blocks.push({
    title: `${blocks.length + 1}라운드 ${getOptionLabel(round.option)} 단식`,
    type: "SINGLES",
    matchRule: getMatchRuleLabel(round.matchRule),

    expectedMinutes: duration,

    matchCount,
    groupSizes: roundGroupSizes,
  });
}

  if (round.program === "DOUBLES") {
    let matchCount = 0;

    if (round.format === "LEAGUE") {
      matchCount =
        calculateRoundRobinMatchCount(
          Math.floor(playerCount / 2)
        );
    }

    if (round.format === "GROUP") {
      matchCount = doublesMatchCount;
    }

    if (round.format === "TOURNAMENT") {
      matchCount =
        calculateTournamentMatchCount(
          Math.floor(playerCount / 2)
        );
    }
    const duration =
      calculateDuration(
        matchCount,
        courtCount,
        getMatchRuleLabel(round.matchRule)
      );

    blocks.push({
      title: `${blocks.length + 1}라운드 ${getOptionLabel(round.option)} 복식`,
      type: "DOUBLES",
      matchRule: getMatchRuleLabel(round.matchRule),

      expectedMinutes: duration,

      matchCount,
      groupSizes: roundGroupSizes,
    });
  }

  if (round.program === "TEAM") {

    const teamCount =
      calculateTeamCount(
        playerCount,
        round.teamPlayerCount
      );

    const teamInfo =
      getTeamMatchInfo(
        round.teamMatchType
      );

    let matchCount = 0;

      if (round.format === "LEAGUE") {
        matchCount =
          calculateTeamLeagueMatchCount(
            teamCount
          );
      }

      if (round.format === "GROUP") {
        matchCount =
          calculateTeamGroupMatchCount([
            Math.ceil(teamCount / 2),
            Math.floor(teamCount / 2),
          ]);
      }

      if (round.format === "TOURNAMENT") {
        matchCount =
          calculateTeamTournamentMatchCount(
            teamCount
          );
      }

    const duration =
      calculateDuration(
        matchCount * (teamInfo.singles + teamInfo.doubles),
        courtCount,
        getMatchRuleLabel(round.matchRule)
      );

    blocks.push({
      title: `${blocks.length + 1}라운드 ${getOptionLabel(round.option)} 단체전`,
      type: "TEAM",
      matchRule: getMatchRuleLabel(round.matchRule),

      expectedMinutes: duration,

      matchCount: matchCount * (teamInfo.singles + teamInfo.doubles),

      description:
        teamInfo.description,
      groupSizes: roundGroupSizes,
    });
  }
}
    return blocks;
  }
