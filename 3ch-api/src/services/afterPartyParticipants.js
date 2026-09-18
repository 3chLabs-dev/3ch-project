function normalizeParticipants(input, leagueParticipants, savedRounds = [], currentParticipants = []) {
  const roster = new Map(leagueParticipants.map((person) => [person.id, person]));
  const current = new Map(currentParticipants.map((person) => [person.id, person]));
  const knownGuests = new Map();
  for (const round of savedRounds) {
    for (const person of round.participants ?? []) {
      if (person.guest && !knownGuests.has(person.id)) knownGuests.set(person.id, person);
    }
  }

  return input.map((person) => {
    const saved = current.get(person.id);
    const knownGuest = saved?.guest ? saved : knownGuests.get(person.id);
    if (saved && Boolean(saved.guest) !== Boolean(person.guest)) {
      throw new Error('저장된 참가자의 게스트 구분은 변경할 수 없습니다.');
    }
    if (person.guest) {
      if (roster.has(person.id)) throw new Error('리그 참가자를 게스트로 등록할 수 없습니다.');
      return {
        ...person,
        guest: true,
        name: knownGuest?.name ?? person.name.trim(),
        division: knownGuest?.division ?? (person.division ?? '').trim(),
      };
    }
    const leaguePerson = roster.get(person.id);
    if (!leaguePerson && !saved) throw new Error('리그 참가자 명단에 없는 사람이 포함됐습니다.');
    return {
      ...person,
      guest: false,
      name: saved?.name ?? leaguePerson.name,
      division: saved?.division ?? leaguePerson?.division ?? '',
    };
  });
}

module.exports = { normalizeParticipants };
