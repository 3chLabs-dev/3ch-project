const test = require('node:test');
const assert = require('node:assert/strict');
const { canApplyToTournament } = require('../src/utils/tournamentApplicationPolicy');

const now = new Date('2026-09-27T01:00:00Z');
const starts_at = '2026-10-01T01:00:00Z';

test('신청 마감만 설정된 초안은 명시적으로 신청을 열기 전까지 신청할 수 없다', () => {
  const tournament = { status: 'draft', starts_at, application_deadline_at: '2026-09-30T01:00:00Z', premium_visible: false };
  assert.equal(canApplyToTournament(tournament, now), false);
  assert.equal(canApplyToTournament({ ...tournament, status: 'open' }, now), true);
});

test('프리미엄 노출과 무관하게 열린 대회는 마감 전 신청할 수 있다', () => {
  for (const premium_visible of [true, false]) {
    assert.equal(canApplyToTournament({ status: 'open', starts_at, application_deadline_at: null, premium_visible }, now), true);
  }
});

test('마감 또는 대회 시작 후에는 새 신청을 받을 수 없다', () => {
  assert.equal(canApplyToTournament({ status: 'open', starts_at, application_deadline_at: '2026-09-26T01:00:00Z' }, now), false);
  assert.equal(canApplyToTournament({ status: 'open', starts_at: '2026-09-26T01:00:00Z', application_deadline_at: null }, now), false);
});
