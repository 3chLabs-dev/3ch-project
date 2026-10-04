const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const modules = new Map();
function loadTypeScript(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((specifier) =>
    specifier.startsWith('.')
      ? loadTypeScript(path.resolve(path.dirname(filename), `${specifier}.ts`))
      : require(specifier), module, module.exports);
  return module.exports;
}
const { buildCrossGroupTournamentSeedOrder, buildTournamentSlots } =
  loadTypeScript(path.resolve(__dirname, '../src/utils/programMatchGenerator.ts'));
const pools = (count, sizes = Array(count).fill(6)) => Array.from({ length: count }, (_, group) =>
  Array.from({ length: sizes[group] }, (_, rank) => ({
    id: `${group + 1}-${rank + 1}`, name: `${group + 1}-${rank + 1}`, division: '5',
  })));
test('기존 2개조×6명 배치는 유지한다', () => {
  const slots = buildTournamentSlots('fixture', 1, {}, buildCrossGroupTournamentSeedOrder(pools(2)), 'seed');
  assert.deepEqual(slots.map(slot => slot?.id ?? 'BYE'),
    '1-1 BYE 1-5 2-4 1-3 2-6 BYE 2-2 1-2 BYE 1-6 2-3 1-4 2-5 BYE 2-1'.split(' '));
});

test('아이핑 3개조×6명: 세 번째 경기 2조 3위와 전체 32개 슬롯 일치', () => {
  const reference = require('./ipingDraws.fixture.json').draws.find(draw =>
    draw.groups === 3 && draw.ranks === 6);
  assert.ok(reference);
  const groups = pools(3);
  const slots = buildTournamentSlots('fixture', 1, {}, buildCrossGroupTournamentSeedOrder(groups), 'seed');
  assert.deepEqual(slots.map(slot => slot?.id ?? 'BYE'), reference.slots);
  assert.deepEqual(slots.slice(4, 6).map(slot => slot?.id ?? 'BYE'), ['2-3', 'BYE']);
  assert.deepEqual(slots.slice(6, 8).map(slot => slot?.id ?? 'BYE'), ['BYE', '1-3']);
  assert.equal(new Set(slots.filter(slot => slot?.id).map(slot => slot.id)).size, 18);
});

const configurations = [];
for (const count of [3, 4]) {
  for (const rankCount of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 21, 22, 32, 43, 64, 65, 85]) {
    configurations.push([count, Array(count).fill(rankCount)]);
  }
  configurations.push([count, Array.from({ length: count }, (_, index) => 6 - index)]);
  configurations.push([count, Array.from({ length: count }, (_, index) => index === 0 ? 0 : 5)]);
}
for (const [count, sizes] of configurations) {
  test(`${count}개조 [${sizes}]: 시드 보호·BYE·중복 누락·재생성 안정성`, () => {
    const groups = pools(count, sizes);
    const before = JSON.stringify(groups);
    const seedOrder = buildCrossGroupTournamentSeedOrder(groups);
    const slots = buildTournamentSlots('fixture', 1, {}, seedOrder, 'seed');
    const entrants = slots.filter(slot => slot?.id);
    const total = sizes.reduce((a, b) => a + b, 0);
    assert.equal(slots.length, 2 ** Math.ceil(Math.log2(total)));
    assert.equal(new Set(entrants.map(slot => slot.id)).size, total);
    assert.equal(entrants.length, total);
    assert.equal(slots.filter(slot => !slot?.id).length, slots.length - total);
    const winners = groups.flatMap(group => group.length ? [group[0].id] : []);
    assert.equal(slots[0].id, winners[0]);
    // 아이핑의 3개조×6명에서는 2조 1위가 후반 첫 칸, 3조 1위가 마지막이다.
    assert.equal(slots.at(-1).id,
      count === 3 && sizes.every(size => size === 6) ? winners[2] : winners[1]);
    const winnerSlots = winners.map(id => slots.findIndex(slot => slot.id === id));
    assert.equal(new Set(winnerSlots.map(slot => Math.floor(slot / (slots.length / 4)))).size, winners.length);
    const byeRanks = [], playedRanks = [];
    for (let i = 0; i < slots.length; i += 2) {
      const [a, b] = [slots[i], slots[i + 1]];
      assert.ok(a.id || b.id, 'BYE끼리 경기하지 않는다');
      if (a.id && b.id) {
        assert.notEqual(a.seedLabel.split('-')[0], b.seedLabel.split('-')[0], `같은 조 1회전 재대결 방지: ${slots.map(s => s.id ?? 'BYE').join(' ')}`);
        playedRanks.push(Number(a.seedLabel.split('-')[1]), Number(b.seedLabel.split('-')[1]));
      } else byeRanks.push(Number((a.id ? a : b).seedLabel.split('-')[1]));
    }
    if (byeRanks.length && playedRanks.length) assert.ok(Math.max(...byeRanks) <= Math.min(...playedRanks), '상위 순위 BYE 우선');
    for (let sections = 2; sections <= slots.length / 2; sections *= 2) {
      const size = slots.length / sections;
      const sectionByes = Array.from({ length: sections }, (_, index) =>
        slots.slice(index * size, (index + 1) * size).filter(slot => !slot.id).length);
      assert.ok(Math.max(...sectionByes) - Math.min(...sectionByes) <= 1, 'BYE 각 구역 균등 분산');
    }
    entrants.forEach(slot => assert.equal(slot.seedLabel, slot.id));
    assert.equal(JSON.stringify(groups), before);
    assert.deepEqual(buildCrossGroupTournamentSeedOrder(groups), seedOrder);
  });
}

test('모든 조가 비어 있으면 대진을 생성하지 않는다', () => {
  assert.deepEqual(buildCrossGroupTournamentSeedOrder([[], [], []]), []);
});
