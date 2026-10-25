import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/roundRobinStandings.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { calculateRoundRobinStandings, rankRoundRobinResultRows } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const match = (a, b, score_a, score_b) => ({ participant_a_id: a, participant_b_id: b, score_a, score_b, status: 'done' });

test('result tables match bracket rankings when overall set ratio disagrees with head-to-head', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ key: String(i), name: `player${i}` }));
  const scores = [[0,1,0,0,3,3,3],[3,0,3,3,2,3,3],[3,1,0,3,3,3,3],[3,0,0,0,1,3,3],[0,3,0,3,0,3,3],[2,1,0,0,2,0,3],[2,0,1,1,0,0,0]];
  const matches = scores.flatMap((row, a) => row.flatMap((score, b) => b > a ? [match(String(a), String(b), score, scores[b][a])] : []));
  const before = structuredClone({ rows, matches });
  const result = rankRoundRobinResultRows(rows, matches, 'BEST_OF_5');
  assert.deepEqual(result.map(row => row.key), ['1','2','4','3','0','5','6']);
  assert.deepEqual(result.map(row => row.tieSetDiff), ['3/1','1/3','','3/0','0/3','','']);
  const bracket = calculateRoundRobinStandings(rows.map(row => ({ id: row.key })), matches, 'BEST_OF_5');
  assert.deepEqual(result.map(row => row.key), bracket.rankingOrder);
  assert.deepEqual({ rows, matches }, before);
});

test('saved manual tie order applies only when automatic comparisons are equal', () => {
  const rows = ['a','b','c'].map(key => ({ key }));
  const matches = [match('a','b',3,0), match('b','c',3,0), match('c','a',3,0)];
  const result = rankRoundRobinResultRows(rows, matches, 'BEST_OF_5', ['c','b','a']);
  assert.deepEqual(result.map(row => [row.key, row.rank]), [['c','1'],['b','2'],['a','3']]);
  assert.deepEqual(rankRoundRobinResultRows([{ key: 'a' }, { key: 'b' }], [match('a','b',3,1)], 'BEST_OF_5', ['b','a']).map(row => row.key), ['a','b']);
});

test('three-set events rank by earned sets and show tied head-to-head scores', () => {
  const rows = ['a','b','c','d'].map(key => ({ key }));
  const matches = [match('a','b',2,1),match('a','c',0,3),match('a','d',3,0),match('b','c',2,1),match('b','d',2,1),match('c','d',0,3)];
  const result = rankRoundRobinResultRows(rows, matches, 'THREE_SET');
  assert.equal(result[0].key, 'a');
  assert.equal(result[0].tieSetDiff, '2/1');
  assert.equal(result[1].key, 'b');
});

test('compound roster keys are independent from names and non-completed scores are ignored', () => {
  const rows = [{ key: 'a|b', name: 'same' }, { key: 'c|d', name: 'same' }];
  const matches = [match('a|b','c|d',3,1), { ...match('c|d','a|b',99,0), status: 'pending' }];
  assert.deepEqual(rankRoundRobinResultRows(rows, matches, 'BEST_OF_5').map(row => row.key), ['a|b','c|d']);
});
