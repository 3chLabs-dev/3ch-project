const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary } = require('../src/services/afterPartySummary');

test('차수별 저장 결과를 참가자 ID로 합산하고 참석하지 않은 차수는 청구하지 않는다', () => {
  const summary = buildSummary([
    { round_no: 1, participants: [{ id: 'a', name: '가', attending: true }, { id: 'b', name: '나', attending: true }], calculation: { shares: { a: 12001, b: 8000 } } },
    { round_no: 2, participants: [{ id: 'a', name: '가', attending: true }, { id: 'b', name: '나', attending: false }, { id: 'c', name: '다', attending: true }], calculation: { shares: { a: 7000, b: 0, c: 5000 } } },
  ]);
  assert.equal(summary.total, 32001);
  assert.deepEqual(summary.people.find((person) => person.participantId === 'a'), { participantId: 'a', name: '가', total: 19001, rounds: { '1': 12001, '2': 7000 } });
  assert.deepEqual(summary.people.find((person) => person.participantId === 'b')?.rounds, { '1': 8000 });
});
