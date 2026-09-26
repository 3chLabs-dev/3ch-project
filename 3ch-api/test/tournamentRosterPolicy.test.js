const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesExistingRoster, canCancelParticipantWithResults } = require('../src/utils/tournamentRosterPolicy');

test('저장된 참가자가 요청에서 누락되면 명단 저장을 거부한다', () => {
  assert.equal(matchesExistingRoster([{ id: 'one' }, { id: 'two' }], [{ id: 'one' }]), false);
  assert.equal(matchesExistingRoster([{ id: 'one' }], [{ id: 'one' }, { id: 'one' }]), false);
  assert.equal(matchesExistingRoster([{ id: 'one' }], [{ id: 'one' }, { name: 'new' }]), true);
});

test('완료 경기나 기록된 점수가 있으면 참가 취소를 거부한다', () => {
  assert.equal(canCancelParticipantWithResults(true), false);
  assert.equal(canCancelParticipantWithResults(false), true);
});
