const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../src/services/afterPartyCalculation');

const people = [
  { id: 'a', attending: true, drinking: true, excluded: false },
  { id: 'b', attending: true, drinking: false, excluded: false },
  { id: 'c', attending: true, drinking: true, excluded: true },
];

test('찬조금, 주류, 비주류, 정산 제외를 각각 반영하고 원 단위 합계를 보존한다', () => {
  const result = calculate(people, [
    { id: 'food', name: '식사', amount: 10001, category: 'common', personIds: [] },
    { id: 'beer', name: '맥주', amount: 5000, category: 'alcohol', personIds: [] },
    { id: 'cola', name: '콜라', amount: 2000, category: 'nonalcohol', personIds: [] },
  ], [{ id: 'gift', name: '찬조자', amount: 2000 }]);
  assert.deepEqual(result.shares, { a: 9001, b: 6000, c: 0 });
  assert.equal(Object.values(result.shares).reduce((sum, amount) => sum + amount, 0), result.distributable);
});

test('비용을 낼 사람이 없는 항목은 정산할 수 없다', () => {
  assert.throws(() => calculate(people, [{ id: 'special', name: '특정', amount: 100, category: 'specific', personIds: ['c'] }], []), /부담 대상/);
});

test('찬조금이 비용을 넘을 수 없다', () => {
  assert.throws(() => calculate(people, [], [{ id: 'gift', name: '찬조', amount: 1 }]), /초과/);
});
