function buildSummary(settlements) {
  const people = new Map();
  for (const settlement of settlements) {
    const shares = settlement.calculation?.shares ?? {};
    for (const participant of settlement.participants ?? []) {
      const amount = Number(shares[participant.id] ?? 0);
      if (!participant.attending && amount === 0) continue;
      if (!people.has(participant.id)) people.set(participant.id, { participantId: participant.id, name: participant.name, total: 0, rounds: {} });
      const person = people.get(participant.id);
      person.name = participant.name;
      person.rounds[String(settlement.round_no)] = amount;
      person.total += amount;
    }
  }
  const billable = [...people.values()].filter((person) => person.total > 0).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return { total: billable.reduce((sum, person) => sum + person.total, 0), people: billable };
}

module.exports = { buildSummary };
