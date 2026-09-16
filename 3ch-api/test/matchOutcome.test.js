const test = require('node:test');
const assert = require('node:assert/strict');
const { requiredWinScore, winnerSide } = require('../src/utils/matchOutcome');

test('3전 2선승제는 2점에 도달한 쪽만 승리한다', () => {
  assert.equal(requiredWinScore('BEST_OF_3'), 2);
  assert.equal(winnerSide(2, 0, 'BEST_OF_3'), 'a');
  assert.equal(winnerSide(1, 2, '3전 2선승제'), 'b');
  assert.equal(winnerSide(1, 0, 'BEST_OF_3'), null);
});

test('5전 3선승제는 3점에 도달한 쪽만 승리한다', () => {
  assert.equal(requiredWinScore('BEST_OF_5'), 3);
  assert.equal(winnerSide(3, 2, 'BEST_OF_5'), 'a');
  assert.equal(winnerSide(2, 3, '5전 3선승제'), 'b');
  assert.equal(winnerSide(2, 1, 'BEST_OF_5'), null);
});

test('3세트제는 세트 합계 비교로 승자를 판정한다', () => {
  assert.equal(requiredWinScore('THREE_SET'), null);
  assert.equal(winnerSide(2, 1, 'THREE_SET'), 'a');
  assert.equal(winnerSide(1, 2, '3세트제'), 'b');
  assert.equal(winnerSide(1, 1, 'THREE_SET'), null);
});
