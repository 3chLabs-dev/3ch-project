const test = require('node:test');
const assert = require('node:assert/strict');
const { canChangeTournamentCompetitionSettings } = require('../src/utils/tournamentDivisionPolicy');

test('경기 생성 전에는 부문 경기 설정을 수정할 수 있다', () => {
  assert.equal(canChangeTournamentCompetitionSettings({
    hasMatches: false,
    updates: { league_type: 'DOUBLES', format: 'TOURNAMENT', rules: { match_rule: '5게임 3선승' } },
  }), true);
});

test('경기가 있으면 결과에 영향을 줄 유형·방식·규칙 변경을 거부한다', () => {
  for (const updates of [
    { league_type: 'TEAM' },
    { format: 'LEAGUE' },
    { rules: { match_rule: '1게임 단판' } },
  ]) {
    assert.equal(canChangeTournamentCompetitionSettings({ hasMatches: true, updates }), false);
  }
});

test('경기가 있어도 부문명과 모집 인원 변경은 경기 결과를 건드리지 않는다', () => {
  assert.equal(canChangeTournamentCompetitionSettings({
    hasMatches: true,
    updates: { name: '3~4부', recruit_count: 32 },
  }), true);
});
