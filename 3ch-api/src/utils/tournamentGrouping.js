function strength(value) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(number) ? number : 99;
}

function bitReverse(value, bits) {
  let result = 0;
  for (let index = 0; index < bits; index += 1) result = (result << 1) | ((value >> index) & 1);
  return result;
}

function assignBracketSlots(groups) {
  const bits = Math.ceil(Math.log2(Math.max(groups.length, 2)));
  const slots = Array.from({ length: 2 ** bits }, (_, index) => bitReverse(index, bits) + 1);
  const ordered = [...groups].sort((a, b) => {
    const aClubs = new Set(a.members.map((member) => member.source_group_id).filter(Boolean)).size;
    const bClubs = new Set(b.members.map((member) => member.source_group_id).filter(Boolean)).size;
    return bClubs - aClubs || a.index - b.index;
  });
  const placed = [];
  for (const group of ordered) {
    const clubs = new Set(group.members.map((member) => member.source_group_id).filter(Boolean));
    let best = null;
    for (const slot of slots) {
      if (placed.some((entry) => entry.slot === slot)) continue;
      let penalty = 0;
      for (const entry of placed) {
        const overlap = [...clubs].filter((club) => entry.clubs.has(club)).length;
        if (!overlap) continue;
        const distance = (slot - 1) ^ (entry.slot - 1);
        const earliestRound = Math.floor(Math.log2(distance));
        penalty += overlap * (bits - earliestRound) * 100;
      }
      if (!best || penalty < best.penalty || (penalty === best.penalty && slot < best.slot)) best = { slot, penalty };
    }
    placed.push({ index: group.index, slot: best.slot, clubs });
  }
  return new Map(placed.map((entry) => [entry.index, entry.slot]));
}

function createTournamentGroups(participants, groupCount) {
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > Math.floor(participants.length / 2)) throw new Error('INVALID_GROUP_COUNT');
  const sizes = Array.from({ length: groupCount }, (_, index) => Math.floor(participants.length / groupCount) + (index < participants.length % groupCount ? 1 : 0));
  if (Math.max(...sizes) > 5) throw new Error('GROUP_TOO_LARGE');
  const clubCounts = new Map();
  for (const participant of participants) if (participant.source_group_id) clubCounts.set(participant.source_group_id, (clubCounts.get(participant.source_group_id) ?? 0) + 1);
  const sorted = [...participants].sort((a, b) => {
    const clubDelta = (clubCounts.get(b.source_group_id) ?? 0) - (clubCounts.get(a.source_group_id) ?? 0);
    return clubDelta || strength(a.member_division) - strength(b.member_division) || String(a.id).localeCompare(String(b.id));
  });
  const groups = sizes.map((size, index) => ({ index, size, members: [], strengthSum: 0 }));
  for (const participant of sorted) {
    let chosen = null;
    for (const group of groups) {
      if (group.members.length >= group.size) continue;
      const duplicateClub = participant.source_group_id && group.members.some((member) => member.source_group_id === participant.source_group_id);
      const fillRatio = group.members.length / group.size;
      const averageStrength = group.members.length ? group.strengthSum / group.members.length : strength(participant.member_division);
      const penalty = (duplicateClub ? 100000 : 0) + fillRatio * 1000 + Math.abs(averageStrength - strength(participant.member_division)) * 5 + group.index;
      if (!chosen || penalty < chosen.penalty) chosen = { group, penalty };
    }
    chosen.group.members.push(participant);
    chosen.group.strengthSum += strength(participant.member_division);
  }
  const slots = assignBracketSlots(groups);
  return groups.map((group) => ({ pool_no: group.index + 1, bracket_slot: slots.get(group.index), members: group.members }));
}

function canCreateTournamentGroups({ hasPools, hasMatches, divisionStatus }) {
  return !hasPools && !hasMatches && !['locked', 'active', 'completed'].includes(divisionStatus);
}

module.exports = { createTournamentGroups, canCreateTournamentGroups };
