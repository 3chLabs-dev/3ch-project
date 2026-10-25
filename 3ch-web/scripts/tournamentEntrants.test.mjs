import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle = await build({ stdin: { contents: 'export { generateProgramRoundMatches, getProgramTournamentSelectionPools, buildTournamentSlots } from "./src/utils/programMatchGenerator"; export { generateProgramBlocks } from "./src/features/league/algorithms/generateProgramBlocks"; export { hasCappedTournamentEntryChanges } from "./src/utils/tournamentEntrants";', resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'ts' }, write: false, bundle: true, platform: 'node', format: 'esm', target: 'node20' });
const { generateProgramRoundMatches: generate, getProgramTournamentSelectionPools: pools, generateProgramBlocks, buildTournamentSlots, hasCappedTournamentEntryChanges } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const people = (n = 10) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `player${i + 1}`, division: String(i + 1), status: 'active' }));
const option = (patch = {}) => ({ rounds: [{ id: 1, program: 'SINGLES', format: 'TOURNAMENT', option: 'PRELIM', matchRule: 'BEST_OF_3' }], blocks: [{ title: '예선', type: 'SINGLES', format: 'TOURNAMENT', roundOption: 'PRELIM', matchRule: '3전 2선승제', tournamentSeeding: 'seed', tournamentStartSize: 8, thirdPlaceMatch: false, ...patch }] });
const entrants = rows => [...new Set(rows.filter(row => row.round_number === 1 && row.bracket !== 'lower').flatMap(row => [row.participant_a_id, row.participant_b_id]).filter(Boolean))].sort();

test('10 entrants: seeded 8-person draw selects top eight and leaves the input roster intact', () => {
  const roster = people(), before = structuredClone(roster);
  const rows = generate('league', option(), roster, 1);
  assert.equal(rows.length, 7);
  assert.deepEqual(entrants(rows), ['p1','p2','p3','p4','p5','p6','p7','p8']);
  assert.deepEqual(roster, before);
  assert.equal(rows.filter(row => row.round_number === 1).length, 4);
});
test('random selection is deterministic across rerenders and caps the whole draw at eight', () => {
  const program = option({ tournamentSeeding: 'random' });
  const first = generate('league', program, people(), 1);
  assert.equal(entrants(first).length, 8);
  assert.deepEqual(first, generate('league', program, people(), 1));
});
test('cutoff ties require a complete administrator selection and reject outsiders or omitted mandatory entrants', () => {
  const roster = people().map((row, index) => index >= 7 ? { ...row, division: '8' } : row);
  const program = option();
  assert.equal(generate('league', program, roster, 1).length, 0);
  const pending = pools('league', program, roster, 1, []);
  assert.equal(pending[0].mandatory.length, 7);
  assert.equal(pending[0].candidates.length, 3);
  assert.equal(pending[0].remaining, 1);
  const ids = [...roster.slice(0, 7).map(row => row.id), 'p10'];
  program.blocks[0].tournamentSelectedIds = { '1': ids };
  assert.deepEqual(entrants(generate('league', program, roster, 1)), [...ids].sort());
  for (const invalid of [[...ids.slice(0, 7), 'outsider'], [...ids.slice(1), 'p9'], [...ids.slice(0, 7), 'p7']]) {
    program.blocks[0].tournamentSelectedIds['1'] = invalid;
    assert.equal(generate('league', program, roster, 1).length, 0);
  }
});
test('manual draws have exactly eight empty slots, and a larger requested size adds byes', () => {
  const manual = generate('league', option({ tournamentSeeding: 'manual' }), people(), 1);
  assert.equal(manual.length, 7);
  assert.deepEqual(entrants(manual), []);
  const sixteen = generate('league', option({ tournamentStartSize: 16 }), people(), 1);
  assert.equal(sixteen.filter(row => row.round_number === 1).length, 8);
  assert.equal(entrants(sixteen).length, 10);
  const legacy = generate('league', option({ tournamentStartSize: undefined }), people(), 1);
  assert.equal(legacy.length, sixteen.length);
});
test('final rounds ignore preliminary caps and multiple draws cannot be generated partially', () => {
  const roster = people(20).map((row, i) => ({ ...row, division: i < 10 ? '3' : String(i) }));
  const program = option({ competitionMode: 'blue-white', blueWhiteTournamentPlacement: 'by-team' });
  program.blueWhiteTeams = { blueParticipantIds: roster.slice(0,10).map(row => row.id), whiteParticipantIds: roster.slice(10).map(row => row.id) };
  assert.equal(generate('league', program, roster, 1).length, 0);
});
test('doubles apply the cap to pairs instead of counting individual players', () => {
  const roster = people(20);
  const assignments = Array.from({ length: 10 }, (_, index) => roster.slice(index * 2, index * 2 + 2).map(row => ({ id: row.id, name: row.name, level: Number(row.division) })));
  const program = option({ type: 'DOUBLES', doublesAssignments: assignments });
  program.rounds[0].program = 'DOUBLES';
  const result = generate('league', program, roster, 1);
  assert.equal(entrants(result).length, 8);
  assert.ok(entrants(result).every(id => id.includes('+')));
});


test('creation and editing preserve the cap and estimate actual selected matches', () => {
  const rounds = [{ id: 1, program: 'SINGLES', format: 'TOURNAMENT', option: 'PRELIM', matchRule: 'BEST_OF_3', tournamentStartSize: 8, tournamentSeeding: 'seed', thirdPlaceMatch: false }];
  const blocks = generateProgramBlocks({ rounds }, 10, 1, [10]);
  assert.equal(blocks[0].tournamentStartSize, 8);
  assert.equal(blocks[0].matchCount, 7);
  assert.equal(hasCappedTournamentEntryChanges({ blocks }, { blocks }), false);
  assert.equal(hasCappedTournamentEntryChanges({ blocks }, { blocks: [{ ...blocks[0], tournamentSeeding: 'random' }] }), true);
});

test('team events cap the number of teams, while finals retain their source-qualified size', () => {
  const roster = people(20);
  const program = option({ type: 'TEAM', teamPlayerCount: 2, teamFormationSizes: Array(10).fill(2) });
  program.rounds[0].program = 'TEAM';
  assert.equal(entrants(generate('league', program, roster, 1)).length, 8);
  const units = people().map(row => ({ ...row, level: Number(row.division) }));
  assert.equal(buildTournamentSlots('league', 0, { ...option().blocks[0], roundOption: 'FINAL' }, units).length, 16);
});
