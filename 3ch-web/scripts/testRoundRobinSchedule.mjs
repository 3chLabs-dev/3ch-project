import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/leagueUtils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { generateRoundRobin, buildFixedNumberRoundRobinSchedule, hasStartedRoundRobinMatch, sortRoundRobinMatches } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const ids = ['a', 'b', 'c', 'd'];
const matches = generateRoundRobin(4).map(([a, b], index) => ({
  id: `match-${index}`, participant_a_id: ids[a], participant_b_id: ids[b],
  status: 'pending', score_a: null, score_b: null, match_order: index + 1, court: `${index + 1}`,
}));
const permutations = xs => xs.length ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map(tail => [x, ...tail])) : [[]];

test('all participant permutations retain the same numbered schedule before play', () => {
  for (const order of permutations(ids)) {
    const displayed = buildFixedNumberRoundRobinSchedule(matches, order);
    assert.deepEqual(displayed.map(m => [m.display_seed_a, m.display_seed_b]), generateRoundRobin(4).map(([a, b]) => [a + 1, b + 1]));
    for (const m of displayed) {
      assert.deepEqual(new Set([order[m.display_seed_a - 1], order[m.display_seed_b - 1]]), new Set([m.participant_a_id, m.participant_b_id]));
    }
  }
});
test('display changes preserve every persisted match side, result, court and manual order', () => {
  const rows = matches.map((m, i) => ({ ...m, status: i ? 'pending' : 'done', score_a: i ? null : 2, score_b: i ? null : 1 }));
  const before = structuredClone(rows);
  const display = buildFixedNumberRoundRobinSchedule(rows, ['b', 'a', 'd', 'c']);
  assert.deepEqual(rows, before);
  for (const row of display) {
    const { display_seed_a, display_seed_b, ...persisted } = row;
    assert.deepEqual(persisted, before.find(m => m.id === row.id));
  }
});
test('only real play or entered scores end the prestart display mode', () => {
  assert.equal(hasStartedRoundRobinMatch(matches), false);
  assert.equal(hasStartedRoundRobinMatch([{ status: 'done', is_no_game: true, score_a: 0, score_b: 0 }, { status: 'done', is_bye: true }, { status: 'cancelled', score_a: 2 }]), false);
  for (const row of [{ status: 'playing' }, { status: 'done' }, { status: 'completed' }, { status: 'pending', score_a: 0 }]) assert.equal(hasStartedRoundRobinMatch([row]), true);
});
test('the existing poststart ordering retains persisted score-side orientation', () => {
  const display = sortRoundRobinMatches(matches, ['d', 'c', 'b', 'a']);
  assert.ok(display.every(m => !('display_seed_a' in m)));
  assert.ok(display.every(m => m === matches.find(original => original.id === m.id)));
});
test('incomplete rosters never fabricate or drop persisted matches', () => {
  const display = buildFixedNumberRoundRobinSchedule(matches, ['a', 'b']);
  assert.deepEqual(new Set(display.map(m => m.id)), new Set(matches.map(m => m.id)));
});

test('blue-white NO-GAME records do not unfreeze numbers or alter recorded sides', () => {
  const rows = matches.map(m => {
    const sameTeam = ['a', 'b'].includes(m.participant_a_id) === ['a', 'b'].includes(m.participant_b_id);
    return { ...m, is_no_game: sameTeam, status: sameTeam ? 'done' : 'pending', score_a: sameTeam ? 0 : null, score_b: sameTeam ? 0 : null };
  });
  const before = structuredClone(rows);
  assert.equal(hasStartedRoundRobinMatch(rows), false);
  const display = buildFixedNumberRoundRobinSchedule(rows, ['b', 'a', 'd', 'c']);
  assert.deepEqual(display.map(m => [m.display_seed_a, m.display_seed_b]), generateRoundRobin(4).map(([a, b]) => [a + 1, b + 1]));
  assert.deepEqual(rows, before);
  assert.deepEqual(new Set(display.filter(m => m.is_no_game).map(m => m.id)), new Set(before.filter(m => m.is_no_game).map(m => m.id)));
});

test('each group restarts its numbering and keeps its own matches after reordering', () => {
  for (const group of ['group-1', 'group-2']) {
    const people = ids.map(id => `${group}-${id}`);
    const rows = generateRoundRobin(4).map(([a, b], i) => ({ id: `${group}-match-${i}`, participant_a_id: people[a], participant_b_id: people[b], status: 'pending' }));
    const display = buildFixedNumberRoundRobinSchedule(rows, [people[2], people[0], people[3], people[1]]);
    assert.deepEqual(display.map(m => [m.display_seed_a, m.display_seed_b]), generateRoundRobin(4).map(([a, b]) => [a + 1, b + 1]));
    assert.ok(display.every(m => m.id.startsWith(group) && m.participant_a_id.startsWith(group) && m.participant_b_id.startsWith(group)));
  }
});
