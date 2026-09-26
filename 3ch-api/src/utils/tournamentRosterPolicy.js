function matchesExistingRoster(existingRows, incomingRows) {
  const existingIds = existingRows.map((row) => row.id);
  const incomingIds = incomingRows.filter((row) => row.id).map((row) => row.id);
  return new Set(incomingIds).size === incomingIds.length
    && existingIds.length === incomingIds.length
    && existingIds.every((id) => incomingIds.includes(id));
}

function canCancelParticipantWithResults(hasCompletedMatchOrScore) {
  return !hasCompletedMatchOrScore;
}

module.exports = { matchesExistingRoster, canCancelParticipantWithResults };
