export function calculateTournamentFee(
  participants: Array<{ division_id: string }>,
  divisions: Array<{ id: string; rounds: unknown[] }>,
  fee: number | null | undefined,
) {
  const roundCount = participants.reduce((sum, participant) => sum + (divisions.find((division) => division.id === participant.division_id)?.rounds.length ?? 0), 0);
  return { roundCount, amount: fee == null ? null : roundCount * fee };
}
