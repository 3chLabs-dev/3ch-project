export type MatchRule =
  | "3전 2선승제"
  | "3세트제"
  | "5전 3선승제";

export function getMatchDuration(
  rule: MatchRule
): number {
  switch (rule) {
    case "3전 2선승제":
      return 20;

    case "3세트제":
      return 25;

    case "5전 3선승제":
      return 35;

    default:
      return 20;
  }
}

export function calculateDuration(
  matchCount: number,
  courtCount: number,
  rule: MatchRule
): number {
  const slotMinutes = getMatchDuration(rule);

  const rounds = Math.ceil(
    matchCount / courtCount
  );

  return rounds * slotMinutes;
}