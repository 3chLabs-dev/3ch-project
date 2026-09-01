const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../src/services/pointRanking');

test('상·하위 접두사가 붙은 3·4위전과 결승을 구분한다', () => {
  assert.equal(_test.isThirdPlaceMatch({ match_label: '상위 3·4위전' }), true);
  assert.equal(_test.isThirdPlaceMatch({ match_label: '하위 3·4위전' }), true);
  assert.equal(_test.isFinalMatch({ match_label: '상위 결승' }), true);
  assert.equal(_test.isFinalMatch({ match_label: '하위 결승' }), true);
  assert.equal(_test.isFinalMatch({ match_label: '상위 3·4위전' }), false);
});

test('하위 브래킷에는 하위 토너먼트 점수표를 사용한다', () => {
  const rules = {
    rankings: {
      tournamentUpper: { first: 50, second: 30, third: 20, fourth: 15 },
      tournamentLower: { first: 20, second: 15, third: 10, fourth: 5 },
    },
  };
  assert.equal(_test.getBonusRule(rules, 'tournament', 'TOURNAMENT', 'LOWER').first, 20);
  assert.equal(_test.getBonusRule(rules, 'tournament', 'TOURNAMENT', 'UPPER').first, 50);
});

test('복식·단체전 순위 점수는 실제 팀원 수로 나눠 개인에게 지급한다', () => {
  const rowA = { bonus_points: 0, championships: 0 };
  const rowB = { bonus_points: 0, championships: 0 };
  const rule = { first: 50, second: 30, third: 20, fourth: 15 };
  _test.awardBonus(rowA, 1, rule, 2);
  _test.awardBonus(rowB, 1, rule, 2);
  assert.equal(rowA.bonus_points, 25);
  assert.equal(rowB.bonus_points, 25);
  assert.equal(rowA.championships, 1);
  assert.equal(rowB.championships, 1);
});

test('팀원 순서와 무관하게 같은 순위 집계 단위로 묶는다', () => {
  assert.equal(_test.rankingUnitKey([12, 3, 8]), '3,8,12');
  assert.equal(_test.rankingUnitKey([8, 12, 3]), '3,8,12');
});
