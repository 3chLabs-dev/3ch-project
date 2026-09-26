function canChangeTournamentCompetitionSettings({ hasMatches, updates }) {
  if (!hasMatches) return true;
  return updates.league_type === undefined
    && updates.format === undefined
    && updates.rules === undefined;
}

module.exports = { canChangeTournamentCompetitionSettings };
