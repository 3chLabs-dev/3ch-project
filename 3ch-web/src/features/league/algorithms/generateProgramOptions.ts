import { generateGroupOptions } from "./generateGroupOptions";
import { calculateGroupMatchCount } from "./calculateMatchCount";
import { calculateDuration } from "./calculateDuration";
import { calculateRecommendationScore } from "./calculateRecommendationScore";
import { generateProgramBlocks } from "./generateProgramBlocks";

import type {
  MatchRule,
  ProgramOption,
  ProgramPreferences,
} from "../types/tournament.types";

interface GenerateProgramOptionsInput {
  playerCount: number;
  courtCount: number;
  rentalMinutes: number;
  rentalStartMinutes: number;
  preferences: ProgramPreferences;
}

export function generateProgramOptions(
  input: GenerateProgramOptionsInput
): ProgramOption[] {
  const preferences =
    input.preferences;
  const options = generateGroupOptions(
    input.playerCount
  );

  const result: ProgramOption[] = [];

  const rules: MatchRule[] = [
    "5전 3선승제",
    "3세트제",
    "3전 2선승제",
  ];

  for (const option of options) {
    for (const rule of rules) {
      const matchCount =
        calculateGroupMatchCount(
          option.groups
        );

      const expectedMinutes =
        calculateDuration(
          matchCount,
          input.courtCount,
          rule
        );

      const averageGroupSize =
        option.groups.reduce(
          (sum, value) => sum + value,
          0
        ) / option.groups.length;

      const recommendationScore =
        calculateRecommendationScore({
          expectedMinutes,
          rentalMinutes: input.rentalMinutes,
          matchCount,
          averageGroupSize,
      });
      const generatedBlocks = generateProgramBlocks(
        preferences,
        input.playerCount,
        input.courtCount,
        option.groups
      );
      let elapsedMinutes = 0;
      const blocks = generatedBlocks.map((block) => {
        const startMinutes =
          input.rentalStartMinutes + elapsedMinutes;
        const endMinutes =
          startMinutes + block.expectedMinutes;

        elapsedMinutes += block.expectedMinutes;

        return {
          ...block,
          startMinutes,
          endMinutes,
        };
      });

      const totalBlockMatchCount =
        blocks.reduce(
          (sum, block) =>
            sum + block.matchCount,
          0
        );
      const totalProgramMinutes =
        blocks.reduce(
          (sum, block) =>
            sum + block.expectedMinutes,
          0
        );
      console.log(
        option.groups,
        rule,
        totalProgramMinutes,
        input.rentalMinutes
      );
      /*
      if (
        totalProgramMinutes >
        input.rentalMinutes
      ) {
        continue;
      }
      */

      result.push({
        title: "",
        groupSizes: option.groups,
        matchRule: rule,
        matchCount,
        expectedMinutes,
        recommendationScore,
        description: "",
        blocks,
        totalBlockMatchCount,
        totalProgramMinutes,

        isOverTime:
          totalProgramMinutes >
          input.rentalMinutes,
      });
    }
  }

    const maxMatches = result.find(
      r => r.matchRule === "5전 3선승제"
    );

    const balanced = result.find(
      r => r.matchRule === "3세트제"
    );

    const fast = result.find(
      r => r.matchRule === "3전 2선승제"
    );

    console.log(
      maxMatches?.isOverTime,
      balanced?.isOverTime,
      fast?.isOverTime
    );

    const finalOptions: ProgramOption[] = [];
    if (maxMatches) {
      finalOptions.push({
        ...maxMatches,
        title: "✨정규 경기",
      });
    }

    if (balanced) {
      finalOptions.push({
        ...balanced,
        title: "⚖️밸런스형",
      });
    }

    if (fast) {
      finalOptions.push({
        ...fast,
        title: "⚡빠른 진행",
      });
    }

    return finalOptions;
}
