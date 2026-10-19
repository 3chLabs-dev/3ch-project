const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTournamentRoundResult } = require('../src/services/tournamentResults');
const participants = ['a','b','c','d'].map((id) => ({ id, name: id, member_division: '7', club_name: '클럽' }));
const match = (overrides = {}) => ({ id: 'm', participant_a_id: 'a', participant_b_id: 'b', score_a: 2, score_b: 1, status: 'completed', round_no: 1, pool_name: null, ...overrides });

test('완료 상태와 저장된 점수로 결과를 계산하며 원본 기록을 변경하지 않는다', () => {
  const matches = [match(), match({ id: 'pending', participant_a_id: 'b', participant_b_id: 'c', status: 'pending', score_a: 3, score_b: 0 })];
  const before = structuredClone(matches);
  const result = buildTournamentRoundResult({ format: 'LEAGUE', rules: { match_rule: 'BEST_OF_3' } }, matches, participants);
  assert.equal(result.complete, false);
  assert.equal(result.standings.find((person) => person.id === 'b').wins, 0);
  assert.deepEqual(matches, before);
});
test('모든 경기가 완료되어야 결과 보기를 활성화하고 취소 경기만 있거나 점수가 없으면 완료로 보지 않는다', () => {
  const round = { format: 'LEAGUE' };
  assert.equal(buildTournamentRoundResult(round, [match()], participants).complete, true);
  assert.equal(buildTournamentRoundResult(round, [match({ score_a: null })], participants).complete, false);
  assert.equal(buildTournamentRoundResult(round, [match({ status: 'cancelled' })], participants).complete, false);
  assert.equal(buildTournamentRoundResult(round, [], participants).complete, false);
  assert.equal(buildTournamentRoundResult(round, [match({ participant_a_id: null, participant_b_id: null })], participants).complete, false);
});
test('조별 결과는 서로 다른 조의 참가자를 섞지 않는다', () => {
  const result = buildTournamentRoundResult({ format: 'GROUP' }, [match({ pool_name: '1' }), match({ id: 'm2', pool_name: '2', participant_a_id: 'c', participant_b_id: 'd' })], participants);
  assert.deepEqual(result.pools.map((pool) => pool.standings.map((person) => person.id)), [['a','b'], ['c','d']]);
});
test('3세트제는 리그 결과처럼 획득 세트가 우선이다', () => {
  const result = buildTournamentRoundResult({ format: 'LEAGUE', rules: { match_rule: 'THREE_SET' } }, [match({ score_a: 2, score_b: 1 }), match({ id: 'm2', participant_a_id: 'a', participant_b_id: 'c', score_a: 0, score_b: 3 })], participants);
  assert.equal(result.standings[0].id, 'c');
});
test('토너먼트 우승자와 준우승자는 저장된 결승 결과로 결정한다', () => {
  const result = buildTournamentRoundResult({ format: 'TOURNAMENT' }, [match(), match({ id: 'm2', participant_a_id: 'c', participant_b_id: 'd' }), match({ id: 'final', participant_a_id: 'a', participant_b_id: 'c', score_a: 1, score_b: 3, round_no: 2 })], participants);
  assert.equal(result.standings[0].id, 'c'); assert.equal(result.standings[1].id, 'a');
  assert.equal(result.standings.find((person) => person.id === 'b').rank, 3);
  assert.equal(result.standings.find((person) => person.id === 'd').rank, 3);
});
