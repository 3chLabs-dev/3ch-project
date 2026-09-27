function canApplyToTournament(tournament, now = new Date()) {
  return tournament.status === 'open' && now < new Date(tournament.application_deadline_at ?? tournament.starts_at);
}

module.exports = { canApplyToTournament };
