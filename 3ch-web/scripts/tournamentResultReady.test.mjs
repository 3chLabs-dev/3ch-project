import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildTournamentRoundResult } = require('../../3ch-api/src/services/tournamentResults.js');
const source = await readFile(new URL('../src/utils/tournamentResultReady.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isTournamentResultReady } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const row = (id, a, b, round, extra = {}) => ({ id, participant_a_id: a, participant_b_id: b, round_number: round, score_a: 3, score_b: 1, status: 'done', bracket: 'upper', ...extra });
const matches = [
  row('bye','e',null,1,{ status: 'pending', score_a: null, score_b: null }),
  row('s1','a','b',2,{ next_match_id: 'final' }), row('s2','c','d',2,{ next_match_id: 'final' }),
  row('final','a','c',3),
];

function verify(rows, expected) {
  const before = structuredClone(rows);
  assert.equal(isTournamentResultReady(rows), expected);
  const server = rows.map(match => ({ ...match, status: match.status === 'done' ? 'completed' : match.status, round_no: match.round_number, bracket_index: match.tournament_bracket_index }));
  const people = [...new Set(rows.flatMap(match => [match.participant_a_id, match.participant_b_id]).filter(Boolean))].map(id => ({ id, name: id }));
  assert.equal(buildTournamentRoundResult({ format: 'TOURNAMENT' }, server, people).complete, expected);
  assert.deepEqual(rows, before);
}

test('league and tournament both expose results after settled final despite unfinished opening byes', () => verify(matches, true));
test('unplayed, tied or empty finals cannot expose results', () => {
  for (const extra of [{ status: 'pending' }, { score_a: 1 }, { score_a: null }, { participant_a_id: null, participant_b_id: null }]) {
    verify(matches.map(match => match.id === 'final' ? { ...match, ...extra } : match), false);
  }
  verify([], false);
});
test('bronze playoff must finish when present; without it semifinal losers share third', () => {
  const bronze = row('bronze','b','d',3,{ match_label: '3·4위전' });
  verify([...matches, bronze], true);
  verify([...matches, { ...bronze, status: 'pending' }], false);
});
test('upper/lower and independent team brackets each require a played final', () => {
  const lower = row('lower-final','x','y',1,{ bracket: 'lower' });
  verify([...matches, lower], true);
  verify([...matches, { ...lower, status: 'pending' }], false);
  const teamFinal = row('team-final','x','y',1,{ tournament_bracket_index: 2 });
  verify([...matches, teamFinal], true);
  verify([...matches, { ...teamFinal, status: 'pending' }], false);
});
