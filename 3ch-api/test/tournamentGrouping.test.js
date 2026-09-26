const test = require('node:test');
const assert = require('node:assert/strict');
const { createTournamentGroups, canCreateTournamentGroups } = require('../src/utils/tournamentGrouping');

test('클럽 인원이 조 수 이하면 같은 클럽을 각 조로 분산한다', () => {
  const participants = Array.from({ length: 12 }, (_, index) => ({ id: String(index), member_division: String(3 + index % 4), source_group_id: index < 3 ? 'club-a' : index < 6 ? 'club-b' : null }));
  const groups = createTournamentGroups(participants, 3);
  assert.deepEqual(groups.map((group) => group.members.length), [4, 4, 4]);
  for (const group of groups) assert.equal(group.members.filter((member) => member.source_group_id === 'club-a').length, 1);
  assert.equal(new Set(groups.map((group) => group.bracket_slot)).size, 3);
});

test('개인은 같은 클럽으로 취급하지 않고 모든 참가자를 한 번씩 배치한다', () => {
  const participants = Array.from({ length: 17 }, (_, index) => ({ id: String(index), member_division: '5', source_group_id: null }));
  const groups = createTournamentGroups(participants, 4);
  assert.equal(groups.flatMap((group) => group.members).length, 17);
  assert.equal(new Set(groups.flatMap((group) => group.members.map((member) => member.id))).size, 17);
  assert.ok(groups.every((group) => group.members.length >= 4 && group.members.length <= 5));
});

test('같은 클럽이 서로 다른 조에 있을 때 후속 토너먼트의 반대쪽에 배치한다', () => {
  const participants = Array.from({ length: 16 }, (_, index) => ({ id: String(index), member_division: '5', source_group_id: index < 2 ? 'club-a' : null }));
  const groups = createTournamentGroups(participants, 4);
  const slots = groups.filter((group) => group.members.some((member) => member.source_group_id === 'club-a')).map((group) => group.bracket_slot);
  assert.equal(slots.length, 2);
  assert.notEqual(Math.floor((slots[0] - 1) / 2), Math.floor((slots[1] - 1) / 2));
});

test('기존 조나 완료된 경기가 있으면 재생성을 거부한다', () => {
  assert.equal(canCreateTournamentGroups({ hasPools: true, hasMatches: false, divisionStatus: 'locked' }), false);
  assert.equal(canCreateTournamentGroups({ hasPools: false, hasMatches: true, divisionStatus: 'open' }), false);
  assert.equal(canCreateTournamentGroups({ hasPools: false, hasMatches: true, divisionStatus: 'completed' }), false);
  assert.equal(canCreateTournamentGroups({ hasPools: false, hasMatches: false, divisionStatus: 'draft' }), true);
});
