const CLUB_COLORS = [
  "#2563EB",
  "#E11D48",
  "#059669",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#C026D3",
  "#4D7C0F",
] as const;

export function getLeagueClubColor(groupId: string | undefined, groupIds: string[]) {
  const index = groupId ? groupIds.indexOf(groupId) : -1;
  if (index >= 0) return CLUB_COLORS[index % CLUB_COLORS.length];

  const hash = [...(groupId ?? "")].reduce((value, char) => value + char.charCodeAt(0), 0);
  return CLUB_COLORS[hash % CLUB_COLORS.length];
}

