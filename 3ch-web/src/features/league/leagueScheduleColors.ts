const CLUB_COLORS = [
  // 빨 · 주 · 노 · 초 · 파 · 남 · 자주 · 검
  "#E53935", "#F57C00", "#D4A000", "#2E7D32",
  "#1976D2", "#303F9F", "#C2185B", "#212121",
  // 9번째 클럽부터도 서로 쉽게 구분되는 확장 색상
  "#D81B60", "#00897B", "#0097A7", "#6D4C41",
  "#EC407A", "#558B2F", "#5D4037", "#455A64",
  "#AD1457", "#00695C", "#0277BD", "#AFB42B",
] as const;

export function getLeagueClubColor(groupId: string | undefined, groupIds: string[]) {
  const index = groupId ? groupIds.indexOf(groupId) : -1;
  if (index >= 0) return CLUB_COLORS[index % CLUB_COLORS.length];

  const hash = [...(groupId ?? "")].reduce((value, char) => value + char.charCodeAt(0), 0);
  return CLUB_COLORS[hash % CLUB_COLORS.length];
}
