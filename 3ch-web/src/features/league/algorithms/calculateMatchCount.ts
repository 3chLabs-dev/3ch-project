export function calculateRoundRobinMatchCount(
  playerCount: number
): number {
  return (playerCount * (playerCount - 1)) / 2;
}

export function calculateGroupMatchCount(
  groupSizes: number[]
): number {
  return groupSizes.reduce((total, size) => {
    return total + calculateRoundRobinMatchCount(size);
  }, 0);
}

export function calculateTournamentMatchCount(
  playerCount: number
): number {
  return playerCount - 1;
}