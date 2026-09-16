const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../src/services/groupRanking');

test('사전등록 회원과 실제 회원은 서로 다른 레이팅 식별자를 사용한다', () => {
  assert.equal(_test.rankingIdentity(42, null), 'member:42');
  assert.equal(_test.rankingIdentity(null, 'pre-42'), 'pre:pre-42');
  assert.notEqual(_test.rankingIdentity(42, null), _test.rankingIdentity(null, 'pre-42'));
});

test('회원 전환 뒤에는 기존 사전등록 ID보다 실제 회원 ID를 우선한다', () => {
  assert.equal(_test.rankingIdentity(42, 'pre-42'), 'member:42');
  assert.equal(_test.rankingIdentity(null, null), null);
});
