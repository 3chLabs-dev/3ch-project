export function formatTournamentParticipantName(participant: { name: string; member_division?: string | null; club_name?: string | null }, compact = false): string {
  const nameAndDivision = `${participant.name}${participant.member_division ? ` ${participant.member_division}` : ""}`;
  return compact ? nameAndDivision : `${nameAndDivision} (${participant.club_name || "개인"})`;
}
