interface RecommendationInput {
  expectedMinutes: number;
  rentalMinutes: number;
  matchCount: number;
  averageGroupSize: number;
}

export function calculateRecommendationScore(
  input: RecommendationInput
): number {
  let score = 0;

  // 시간 활용도 (최대 50점)
  const usageRate =
    input.expectedMinutes / input.rentalMinutes;

  score += Math.max(
    0,
    50 - Math.abs(0.9 - usageRate) * 100
  );

  // 경기수 (최대 30점)
  score += Math.min(
    30,
    input.matchCount
  );

  // 4인조 선호 (최대 20점)
  score += Math.max(
    0,
    20 - Math.abs(4 - input.averageGroupSize) * 10
  );

  return Math.round(score);
}