const test = require('node:test');
const assert = require('node:assert/strict');
const { applyProgramTournamentAdvancement } = require('../src/shared/leagueProgramEngine.cjs');
const { projectBracketAdvancement } = require('../src/services/tournamentBracket');

test('manual walkover advances one edge and cannot auto-complete the next waiting match', () => {
  const rows = [
    { id: 'opening', round_number: 1, bracket: 'upper', status: 'done', participant_a_id: 'a', participant_a_name: 'A', participant_b_id: null, participant_b_name: null, score_a: 0, score_b: 0, next_match_id: 'semi', next_slot: 'a' },
    { id: 'semi', round_number: 2, bracket: 'upper', status: 'pending', participant_a_id: null, participant_a_name: null, participant_b_id: null, participant_b_name: null, score_a: null, score_b: null, next_match_id: 'final', next_slot: 'a' },
    { id: 'final', round_number: 3, bracket: 'upper', status: 'pending', participant_a_id: null, participant_a_name: null, participant_b_id: null, participant_b_name: null, score_a: null, score_b: null },
  ];
  const before = structuredClone(rows);
  const result = applyProgramTournamentAdvancement(rows);
  assert.equal(result[1].participant_a_id, 'a');
  assert.equal(result[1].status, 'pending');
  assert.equal(result[2].participant_a_id, null);
  assert.deepEqual(rows, before);
  const serverRows = rows.map(row => ({ ...row, division_id: 'division', program_round: 1, status: row.status === 'done' ? 'completed' : row.status, is_bye: row.id === 'opening' }));
  const saved = structuredClone(serverRows);
  const projected = projectBracketAdvancement(serverRows);
  assert.equal(projected[1].participant_a_id, 'a');
  assert.equal(projected[1].status, 'pending');
  assert.equal(projected[2].participant_a_id, null);
  assert.deepEqual(serverRows, saved);
});

test('manual placement with resolved empty feeders remains pending until explicitly advanced', () => {
  const base = { division_id: 'd', program_round: 1, phase: 'TOURNAMENT', score_a: null, score_b: null };
  const rows = [
    { ...base, id: 'one', status: 'completed', is_bye: true, participant_a_id: 'a', participant_b_id: null, next_match_id: 'semi', next_slot: 'a' },
    { ...base, id: 'two', status: 'completed', is_bye: true, participant_a_id: null, participant_b_id: null, next_match_id: 'semi', next_slot: 'b' },
    { ...base, id: 'semi', status: 'pending', participant_a_id: 'a', participant_b_id: null, next_match_id: 'final', next_slot: 'a', league_data: { manual_assigned_slots: ['a'] } },
    { ...base, id: 'final', status: 'pending', participant_a_id: null, participant_b_id: null },
  ];
  const result = projectBracketAdvancement(rows);
  assert.equal(result[2].status, 'pending');
  assert.equal(result[3].participant_a_id, null);
});
