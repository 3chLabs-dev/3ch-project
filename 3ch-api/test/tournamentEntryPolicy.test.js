const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTournamentEntrySettings, guardTournamentEntryChanges, validateCappedRoundMatches } = require('../src/services/tournamentEntryPolicy');
const { generateProgramRoundMatches: generate } = require('../src/shared/leagueProgramEngine.cjs');
const block = { title: '예선', type: 'SINGLES', format: 'TOURNAMENT', roundOption: 'PRELIM', tournamentStartSize: 8, tournamentSeeding: 'seed', matchRule: '3전 2선승제' };
const program = { blocks: [block], rounds: [{ option: 'PRELIM' }] };
const people = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `player${i}`, division: String(i + 1) }));

test('only valid power-of-two sizes and unique explicit selection IDs are accepted', () => {
  assert.doesNotThrow(() => validateTournamentEntrySettings(program));
  for (const size of [0,3,7,9,2048,'8']) assert.throws(() => validateTournamentEntrySettings({ blocks: [{ ...block, tournamentStartSize: size }] }));
  assert.throws(() => validateTournamentEntrySettings({ blocks: [{ ...block, tournamentSelectedIds: { '1': ['p1','p1'] } }] }));
});
test('existing pending and completed matches cannot be repurposed by changing entry settings', () => {
  const before = structuredClone(program);
  for (const status of ['pending', 'done']) {
    for (const patch of [{ tournamentStartSize: 4 }, { tournamentSelectedIds: { '1': ['p1'] } }, { tournamentSeeding: 'random' }]) {
      assert.throws(() => guardTournamentEntryChanges(program, { ...program, blocks: [{ ...block, ...patch }] }, [{ program_round: 1, status, score_a: 3 }]));
    }
  }
  assert.deepEqual(program, before);
  assert.doesNotThrow(() => guardTournamentEntryChanges(program, program, [{ program_round: 1 }]));
});
test('initial sync is checked against persisted program and roster rather than client-derived entrants', () => {
  const rows = generate('league', program, people, 1);
  assert.doesNotThrow(() => validateCappedRoundMatches('league', program, 1, people, rows));
  const forged = rows.map((row, index) => index ? row : { ...row, participant_a_id: 'p9' });
  assert.throws(() => validateCappedRoundMatches('league', program, 1, people, forged));
  const tied = people.map((row, i) => i >= 7 ? { ...row, division: '8' } : row);
  assert.throws(() => validateCappedRoundMatches('league', program, 1, tied, rows));
});
