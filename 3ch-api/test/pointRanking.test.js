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
  assert.equal(rowA.championships, 0);
  assert.equal(rowB.championships, 0);
});

test('우승 횟수는 입상자 포인트와 별개로 팀의 실제 구성원 모두에게 적립한다', () => {
  const rows = new Map([
    ['member:1', { championships: 0 }],
    ['member:2', { championships: 0 }],
  ]);

  _test.awardChampionship(rows, ['member:1', 'member:2']);

  assert.equal(rows.get('member:1').championships, 1);
  assert.equal(rows.get('member:2').championships, 1);
});

test('팀원 순서와 무관하게 같은 순위 집계 단위로 묶는다', () => {
  assert.equal(_test.rankingUnitKey([12, 3, 8]), '3,8,12');
  assert.equal(_test.rankingUnitKey([8, 12, 3]), '3,8,12');
});

test('일반 회원과 사전등록 회원을 서로 다른 순위 식별자로 구분한다', () => {
  assert.equal(_test.rankingMemberKey({ member_id: 17 }), 'member:17');
  assert.equal(_test.rankingMemberKey({ member_id: null, pre_member_id: 'pre-17' }), 'pre:pre-17');
});

test('예선 뒤 본선 토너먼트 경기는 리그 순위에 계속 합산한다', () => {
  const leagueId = 'mixed-league';
  const regularMatch = {
    league_id: leagueId,
    program_round: 1,
    program_data: { blocks: [{ format: 'GROUP' }, { format: 'TOURNAMENT' }] },
    bracket: null,
  };
  const finalsMatch = {
    league_id: leagueId,
    program_round: 2,
    program_data: regularMatch.program_data,
    bracket: 'upper',
  };
  const leagueHasRegularPhase = new Set([leagueId]);

  assert.equal(_test.getMatchPhaseSection(regularMatch), 'league');
  assert.equal(_test.getMatchPhaseSection(finalsMatch), 'tournament');
  assert.equal(_test.getRankingSection(finalsMatch, leagueHasRegularPhase), 'league');
});

test('상대가 순위 대상이 아니어도 식별된 회원의 획득 세트는 반영한다', () => {
  const member = { matches_played: 0, score_points: 0, wins: 0, losses: 0 };
  const rules = { matchPoints: { mode: 'sets', winPoints: 3 } };

  _test.applyMatchPoints([member], [], 3, 1, rules, 1, 0);

  assert.equal(member.matches_played, 1);
  assert.equal(member.score_points, 3);
  assert.equal(member.wins, 1);
  assert.equal(member.losses, 0);
});

test('토너먼트 추가 점수는 해당 강에서 패배한 구성원에게만 나눠 지급한다', () => {
  const rows = new Map([
    ['member:1', { bonus_points: 0 }],
    ['member:2', { bonus_points: 0 }],
    ['member:3', { bonus_points: 0 }],
  ]);

  assert.equal(_test.tournamentEliminationRound({ match_label: '상위 8강' }), 8);
  assert.equal(_test.tournamentEliminationRound({ match_label: '결승' }), null);
  _test.awardEliminationBonus(rows, ['member:1', 'member:2'], 10);

  assert.equal(rows.get('member:1').bonus_points, 5);
  assert.equal(rows.get('member:2').bonus_points, 5);
  assert.equal(rows.get('member:3').bonus_points, 0);
});

test('하위부 진출 시 상위부 포인트 제외 옵션은 같은 토너먼트의 하위부 참가자를 상위부 지급 대상에서 뺀다', () => {
  const lowerMembers = new Set(['member:2']);

  assert.deepEqual(
    _test.eligibleTournamentBonusMemberIds(['member:1', 'member:2'], 'UPPER', true, lowerMembers),
    ['member:1'],
  );
  assert.deepEqual(
    _test.eligibleTournamentBonusMemberIds(['member:1', 'member:2'], 'UPPER', false, lowerMembers),
    ['member:1', 'member:2'],
  );
  assert.deepEqual(
    _test.eligibleTournamentBonusMemberIds(['member:2'], 'LOWER', true, lowerMembers),
    ['member:2'],
  );
});
