function calculate(participants, items, contributions) {
  const attendees = participants.filter((p) => p.attending && !p.excluded);
  const shares = Object.fromEntries(participants.map((p) => [p.id, 0]));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const contributed = contributions.reduce((sum, entry) => sum + entry.amount, 0);
  if (contributed > total) throw new Error('찬조금이 전체 비용을 초과합니다.');
  let credit = contributed;
  const ordered = [...items].sort((a, b) => (a.category === 'common' ? 0 : 1) - (b.category === 'common' ? 0 : 1));
  const allocations = [];
  for (const item of ordered) {
    const applied = Math.min(credit, item.amount);
    credit -= applied;
    const amount = item.amount - applied;
    const people = attendees.filter((p) => item.category === 'common' ||
      (item.category === 'alcohol' && p.drinking) ||
      (item.category === 'nonalcohol' && !p.drinking) ||
      (item.category === 'specific' && item.personIds.includes(p.id)));
    if (amount > 0 && people.length === 0) throw new Error(`'${item.name}' 항목의 부담 대상이 없습니다.`);
    const base = people.length ? Math.floor(amount / people.length) : 0;
    people.forEach((person, index) => { shares[person.id] += base + (index < amount % people.length ? 1 : 0); });
    allocations.push({ itemId: item.id, amount, contributionApplied: applied, personIds: people.map((p) => p.id) });
  }
  return { total, contributed, distributable: total - contributed, shares, allocations };
}

module.exports = { calculate };
