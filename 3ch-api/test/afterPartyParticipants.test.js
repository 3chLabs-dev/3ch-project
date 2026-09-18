const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeParticipants } = require('../src/services/afterPartyParticipants');

const leaguePerson = { id: 'league-person', name: '리그 참가자', division: '4' };
const guest = { id: 'guest-person', name: '뒤풀이 손님', division: '6', guest: true, attending: true, drinking: false, excluded: false };

test('리그 참가자가 아닌 게스트를 정산에만 보관한다', () => {
  const result = normalizeParticipants([guest], [leaguePerson]);
  assert.deepEqual(result, [guest]);
});

test('다음 차수에서 같은 게스트 ID를 쓰면 저장된 이름과 부수를 유지한다', () => {
  const nextRound = { ...guest, name: '임의 이름', division: '9', attending: false };
  const result = normalizeParticipants([nextRound], [leaguePerson], [{ participants: [guest] }]);
  assert.equal(result[0].id, guest.id);
  assert.equal(result[0].name, guest.name);
  assert.equal(result[0].division, guest.division);
  assert.equal(result[0].attending, false);
});

test('기존 참가자를 게스트로 바꾸거나 명단 밖의 일반 참가자를 추가하지 않는다', () => {
  const flags = { attending: true, drinking: false, excluded: false };
  assert.throws(() => normalizeParticipants([{ ...leaguePerson, ...flags, guest: true }], [leaguePerson]));
  assert.throws(() => normalizeParticipants([{ id: 'unknown', name: '명단 밖', ...flags }], [leaguePerson]));
});

test('저장된 게스트 구분은 일반 저장으로 바꿀 수 없다', () => {
  const altered = { ...guest, guest: false };
  assert.throws(() => normalizeParticipants([altered], [], [{ participants: [guest] }], [guest]));
});
