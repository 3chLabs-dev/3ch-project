import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle = await build({
  stdin: { contents: 'export { swapProgramTournamentSlots } from "./src/utils/programMatchGenerator";', resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'ts' },
  write: false, bundle: true, platform: 'node', format: 'esm', target: 'node20',
});
const { swapProgramTournamentSlots } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('copying a walkover winner into the next round never completes or populates a further round', () => {
  const rows = [
    { id: 'bye', bracket: 'upper', round_number: 1, participant_a_id: 'a', participant_a_name: 'A', participant_b_id: null, participant_b_name: null, status: 'pending', score_a: null, score_b: null, next_match_id: 'semi', next_slot: 'a' },
    { id: 'semi', bracket: 'upper', round_number: 2, participant_a_id: null, participant_a_name: null, participant_b_id: null, participant_b_name: null, status: 'pending', score_a: null, score_b: null, next_match_id: 'final', next_slot: 'a' },
    { id: 'final', bracket: 'upper', round_number: 3, participant_a_id: null, participant_a_name: null, participant_b_id: null, participant_b_name: null, status: 'pending', score_a: null, score_b: null },
  ];
  const before = structuredClone(rows);
  const result = swapProgramTournamentSlots(rows, { matchId: 'bye', slot: 'a' }, { matchId: 'semi', slot: 'a' });
  assert.equal(result[1].participant_a_id, 'a');
  assert.equal(result[1].status, 'pending');
  assert.equal(result[1].score_a, null);
  assert.deepEqual(result[0], before[0]);
  assert.deepEqual(result[2], before[2]);
  assert.deepEqual(rows, before);
  const completed = rows.map(row => row.id === 'semi' ? { ...row, status: 'done', participant_a_id: 'b', participant_b_id: 'c', score_a: 3, score_b: 1 } : row);
  assert.throws(() => swapProgramTournamentSlots(completed, { matchId: 'bye', slot: 'a' }, { matchId: 'semi', slot: 'a' }));
});
