export interface Player {
  name: string;
  level: number;
}

export interface GroupResult {
  name: string;
  players: Player[];
}

export function distributeSnake(
  players: Player[],
  groupSizes: number[]
): GroupResult[] {
  const groupCount = groupSizes.length;

  const groups: GroupResult[] = groupSizes.map((_, index) => ({
    name: `${index + 1}조`,
    players: [],
  }));

  const tiers: Player[][] = [];

  for (let i = 0; i < players.length; i += groupCount) {
    tiers.push(players.slice(i, i + groupCount));
  }

  let reverse = false;

  tiers.forEach((tier) => {
    const currentTier = reverse ? [...tier].reverse() : tier;

    currentTier.forEach((player, index) => {
      const groupIndex = index;

      if (
        groups[groupIndex] &&
        groups[groupIndex].players.length < groupSizes[groupIndex]
      ) {
        groups[groupIndex].players.push(player);
      }
    });

    reverse = !reverse;
  });

  return groups;
}
