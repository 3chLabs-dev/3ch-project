const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTournamentRoundResult } = require('../src/services/tournamentResults');
const participants = ['a','b','c','d'].map((id) => ({ id, name: id, member_division: '7', club_name: '클럽' }));
const match = (overrides = {}) => ({ id: 'm', participant_a_id: 'a', participant_b_id: 'b', score_a: 2, score_b: 1, status: 'completed', round_no: 1, pool_name: null, ...overrides });

test('동일 승수는 전체 세트득실이 아닌 동점자 직접 대결로 결정한다', () => {
  // Reported seven-player pool: player 1 wins the head-to-head 3:1,
  // although player 2 has the better overall set ratio (16:4 versus 17:6).
  const people = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `player${i}` }));
  const scores = [[0,1,0,0,3,3,3],[3,0,3,3,2,3,3],[3,1,0,3,3,3,3],[3,0,0,0,1,3,3],[0,3,0,3,0,3,3],[2,1,0,0,2,0,3],[2,0,1,1,0,0,0]];
  const matches = scores.flatMap((row, a) => row.flatMap((score, b) => b > a ? [match({ id: `${a}-${b}`, participant_a_id: String(a), participant_b_id: String(b), score_a: score, score_b: scores[b][a], pool_name: '1' })] : []));
  const before = structuredClone(matches);
  const result = buildTournamentRoundResult({ round_no: 1, format: 'GROUP', rules: { match_rule: 'BEST_OF_5' } }, matches, people);
  assert.deepEqual(result.pools[0].standings.map(row => row.id), ['1','2','4','3','0','5','6']);
  assert.deepEqual(result.pools[0].standings.map(row => row.tie_set_diff), ['3/1','1/3','','3/0','0/3','','']);
  assert.equal(result.pools[0].standings[0].rank, 1);
  assert.deepEqual(matches, before);
});

test('3인 동률은 동점자 간 세트비를 비교하고 취소 및 다른 조의 점수는 제외한다', () => {
  const matches = [
    match({ participant_a_id: 'a', participant_b_id: 'b', score_a: 3, score_b: 0, pool_name: '1' }),
    match({ participant_a_id: 'b', participant_b_id: 'c', score_a: 3, score_b: 1, pool_name: '1' }),
    match({ participant_a_id: 'c', participant_b_id: 'a', score_a: 3, score_b: 2, pool_name: '1' }),
    match({ participant_a_id: 'a', participant_b_id: 'b', score_a: 0, score_b: 99, status: 'cancelled', pool_name: '1' }),
    match({ participant_a_id: 'c', participant_b_id: 'd', score_a: 99, score_b: 0, pool_name: '2' }),
  ];
  const pool = buildTournamentRoundResult({ format: 'GROUP' }, matches, participants).pools[0];
  assert.deepEqual(pool.standings.map(row => [row.id, row.tie_set_diff]), [['a','5/3'], ['c','4/5'], ['b','3/4']]);
});

test('세트득실까지 같은 경우 수동 동점자 순위를 반영하고 자동 비교가 다른 순위를 뒤집지 않는다', () => {
  const matches = [
    match({ participant_a_id: 'a', participant_b_id: 'b', score_a: 3, score_b: 0, pool_name: '1' }),
    match({ participant_a_id: 'b', participant_b_id: 'c', score_a: 3, score_b: 0, pool_name: '1' }),
    match({ participant_a_id: 'c', participant_b_id: 'a', score_a: 3, score_b: 0, pool_name: '1' }),
  ];
  const round = { round_no: 1, format: 'GROUP' };
  const result = buildTournamentRoundResult(round, matches, participants, { tieBreaks: [{ round: 1, poolLabel: '1조', participantIds: ['c','a','b'] }] });
  assert.deepEqual(result.pools[0].standings.map(row => [row.id, row.rank]), [['c',1],['a',2],['b',3]]);
  assert.deepEqual(buildTournamentRoundResult(round, matches, participants).pools[0].standings.map(row => row.rank), [1,1,1]);
});

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

test('상위와 하위 우승자를 별도로 집계하고 다음 라운드 순위에서도 상위를 우선한다',()=>{
 const rows=[
  match({id:'u1',participant_a_id:'a',participant_b_id:'c',score_a:2,score_b:0,bracket:'upper',round_no:1}),
  match({id:'u2',participant_a_id:'b',participant_b_id:'d',score_a:2,score_b:0,bracket:'upper',round_no:1}),
  match({id:'uf',participant_a_id:'a',participant_b_id:'b',score_a:2,score_b:0,bracket:'upper',round_no:2}),
  match({id:'lf',participant_a_id:'c',participant_b_id:'d',score_a:0,score_b:2,bracket:'lower',round_no:2}),
 ];
 const result=buildTournamentRoundResult({format:'TOURNAMENT',rules:{match_rule:'BEST_OF_3'}},rows,participants);
 assert.equal(result.brackets[0].standings[0].id,'a');assert.equal(result.brackets[1].standings[0].id,'d');
 assert.deepEqual(result.standings.map(p=>p.id),['a','b','d','c']);
});
