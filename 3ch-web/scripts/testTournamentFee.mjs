import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/tournament/participationFee.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { calculateTournamentFee } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const entries = [{ division_id: 'three' }, { division_id: 'three' }, { division_id: 'four' }];
const divisions = [{ id: 'three', rounds: [{}] }, { id: 'four', rounds: [{}] }];

test('existing per-division fees retain the same round totals', () => {
  assert.deepEqual(calculateTournamentFee(entries, divisions, 5000), { roundCount: 3, amount: 15000 });
});
test('combined preliminary counts each original participant once without a second registration', () => {
  const combined = { id: 'combined', rounds: [{}], rules: { entry_config: { source_division_ids: ['three', 'four'], start_round: 2 } } };
  assert.deepEqual(calculateTournamentFee(entries, [...divisions, combined], 5000), { roundCount: 6, amount: 30000 });
  assert.deepEqual(calculateTournamentFee(entries, [...divisions, combined], null), { roundCount: 6, amount: null });
});
