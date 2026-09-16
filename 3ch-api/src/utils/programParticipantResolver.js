function orderedPools(snapshot) {
  return [...(snapshot?.pools ?? [])].sort((left, right) => {
    const leftNumber = Number.parseInt(left?.label, 10);
    const rightNumber = Number.parseInt(right?.label, 10);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return String(left?.label ?? '').localeCompare(String(right?.label ?? ''), 'ko', { numeric: true });
  });
}

function resolveProgramParticipantId(programData, programRound, seedLabel) {
  const roundNumber = Number(programRound || 1);
  const block = programData?.blocks?.[roundNumber - 1] ?? programData?.rounds?.[roundNumber - 1];
  if (block?.finalAdvancementMode !== 'rank-groups') return null;

  const matched = String(seedLabel ?? '').trim().match(/^(\d+)-(\d+)$/);
  if (!matched) return null;
  const sourcePoolIndex = Number(matched[1]) - 1;
  const sourceRankIndex = Number(matched[2]) - 1;
  const sourceRound = Number(block.sourceRoundId ?? roundNumber - 1);
  const snapshot = (programData?.roundStandings ?? []).find(
    (entry) => Number(entry?.round) === sourceRound && entry?.complete === true,
  );
  const participantId = orderedPools(snapshot)[sourcePoolIndex]?.participantIds?.[sourceRankIndex];
  return participantId ? String(participantId) : null;
}

module.exports = { resolveProgramParticipantId };
