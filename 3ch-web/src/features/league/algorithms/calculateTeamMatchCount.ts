export function calculateTeamLeagueMatchCount(
  teamCount: number
): number {
  return (teamCount * (teamCount - 1)) / 2;
}

export function calculateTeamCount(
  playerCount: number,
  teamSize: number
): number {
  return Math.ceil(
    playerCount / teamSize
  );
}

export function calculateTeamGroupMatchCount(
  groupSizes: number[]
): number {
  return groupSizes.reduce(
    (total, size) =>
      total + (size * (size - 1)) / 2,
    0
  );
}

export function calculateTeamTournamentMatchCount(
  teamCount: number
): number {
  return Math.max(
    0,
    teamCount - 1
  );
}