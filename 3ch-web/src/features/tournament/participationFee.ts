export function calculateTournamentFee(
  participants: Array<{ division_id: string }>,
  divisions: Array<{ id: string; rounds: unknown[]; rules?: Record<string, unknown> }>,
  fee: number | null | undefined,
) {
  const roundCount = participants.reduce((sum, participant) => sum + divisions.reduce((total, division) => {
    const sources = (division.rules?.entry_config as { source_division_ids?: string[] } | undefined)?.source_division_ids;
    return total + ((sources?.length ? sources.includes(participant.division_id) : division.id === participant.division_id) ? division.rounds.length : 0);
  }, 0), 0);
  return { roundCount, amount: fee == null ? null : roundCount * fee };
}
