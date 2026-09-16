function orderedPools(snapshot) {
  return [...(snapshot?.pools ?? [])].sort((left, right) => {
    const leftNumber = Number.parseInt(left?.label, 10);
    const rightNumber = Number.parseInt(right?.label, 10);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return String(left?.label ?? '').localeCompare(String(right?.label ?? ''), 'ko', { numeric: true });
  });
}

function resolveCustomizedGroupParticipantId(block, seedLabel, matchLabel) {
  if (block?.participantOrderCustomized !== true || !Array.isArray(block.participantOrder)) return null;
  const seedIndex = Number(seedLabel) - 1;
  if (!Number.isInteger(seedIndex) || seedIndex < 0) return null;

  const groupSizes = Array.isArray(block.groupSizes) && block.groupSizes.length > 0
    ? block.groupSizes.map(Number)
    : [block.participantOrder.length];
  const groupMatched = String(matchLabel ?? '').match(/^(\d+)(?:위)?조$/);
  const groupIndex = groupMatched ? Number(groupMatched[1]) - 1 : 0;
  if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= groupSizes.length) return null;
  const offset = groupSizes.slice(0, groupIndex).reduce((sum, size) => sum + size, 0);
  const participantId = block.participantOrder[offset + seedIndex];
  return participantId ? String(participantId) : null;
}

function resolveProgramParticipantId(programData, programRound, seedLabel, matchLabel = null) {
  const roundNumber = Number(programRound || 1);
  const block = programData?.blocks?.[roundNumber - 1] ?? programData?.rounds?.[roundNumber - 1];
  const customizedParticipantId = resolveCustomizedGroupParticipantId(block, seedLabel, matchLabel);
  if (customizedParticipantId) return customizedParticipantId;
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
