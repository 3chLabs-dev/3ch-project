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
const { buildCrossGroupTournamentSeedOrder, buildTournamentSlots, swapProgramTournamentSlots, generateProgramRoundMatches } =
  loadTypeScript(path.resolve(__dirname, '../src/utils/programMatchGenerator.ts'));
const { buildIpingSlotLabels } = loadTypeScript(path.resolve(__dirname, '../src/utils/ipingTournamentDraw.ts'));
const ipingReferences = require('./ipingDraws.fixture.json').draws;
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

assert.equal(ipingReferences.length, 96);
// 사용자가 제공한 1개조 캡처 11장. 기존 웹 수집 fixture와 독립된 승인 기준.
// 좌측 위→아래 다음 우측 위→아래이며, 우측을 역순으로 읽지 않는다.
const singleGroupScreenshotSlots = {
  2: '1-1 BYE BYE 1-2',
  3: '1-1 BYE 1-3 1-2',
  4: '1-1 1-4 1-2 1-3',
  5: '1-1 BYE 1-5 1-4 1-3 BYE BYE 1-2',
  6: '1-1 BYE 1-5 1-4 1-3 1-6 BYE 1-2',
  7: '1-1 BYE 1-5 1-4 1-3 1-6 1-7 1-2',
  8: '1-1 1-8 1-5 1-4 1-3 1-6 1-7 1-2',
  9: '1-1 BYE 1-9 1-8 1-5 BYE BYE 1-4 1-3 BYE BYE 1-6 1-7 BYE BYE 1-2',
  10: '1-1 BYE 1-9 1-8 1-5 BYE BYE 1-4 1-3 BYE BYE 1-6 1-7 1-10 BYE 1-2',
  11: '1-1 BYE 1-9 1-8 1-5 BYE BYE 1-4 1-3 BYE 1-11 1-6 1-7 1-10 BYE 1-2',
  12: '1-1 BYE 1-9 1-8 1-5 1-12 BYE 1-4 1-3 BYE 1-11 1-6 1-7 1-10 BYE 1-2',
};
for (const [count, labels] of Object.entries(singleGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 1개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·미완료 예선`, () => {
    assert.deepEqual(buildIpingSlotLabels(1, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const participants = pools(1, [rankCount]).flat();
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: [rankCount] },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'all', tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: [{
            label: '1조', complete: true, participantIds: participants.map(unit => unit.id),
          }] }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot', option, participants, 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const slots = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(slots, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(slots.filter(label => label !== 'BYE').length, rankCount);
      }
    }
  });
}
// 사용자가 제공한 2개조 캡처 12장. 원본 라벨은 임의로 정규화하지 않는다.
const twoGroupScreenshotSlots = {
  1: '1-1 2-2 2-1 1-2',
  2: '1-1 2-2 1-2 2-1',
  3: '1-1 BYE 2-2 1-3 1-2 2-3 2-1 BYE',
  4: '1-1 2-4 1-3 2-2 1-2 2-3 1-4 2-1',
  5: '1-1 BYE 1-5 2-4 1-3 BYE BYE 2-2 1-2 BYE BYE 2-3 1-4 2-5 BYE 2-1',
  6: '1-1 BYE 1-5 2-4 1-3 2-6 BYE 2-2 1-2 BYE 1-6 2-3 1-4 2-5 BYE 2-1',
  7: '1-1 BYE 1-5 2-4 1-3 2-6 1-7 2-2 1-2 2-7 1-6 2-3 1-4 2-5 BYE 2-1',
  8: '1-1 2-8 1-5 2-4 1-3 2-6 1-7 2-2 1-2 2-7 1-6 2-3 1-4 2-5 1-8 2-1',
  9: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE BYE 2-6 1-7 BYE BYE 2-2 1-2 BYE BYE 2-7 1-6 BYE BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  10: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE BYE 2-6 1-7 2-10 BYE 2-2 1-2 BYE 1-10 2-7 1-6 BYE BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  11: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE 1-11 2-6 1-7 2-10 BYE 2-2 1-2 BYE 1-10 2-7 1-6 2-11 BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  12: '1-1 BYE 1-9 2-8 1-5 2-12 BYE 2-4 1-3 BYE 1-11 2-6 1-7 2-10 BYE 2-2 1-2 BYE 1-10 2-7 1-6 2-11 BYE 2-3 1-4 BYE 1-12 2-5 1-8 2-9 BYE 2-1',
};
for (const [count, labels] of Object.entries(twoGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 2개조×${rankCount}명: 원본·실제 선수·일반/상하위·미완료 예선`, () => {
    assert.deepEqual(buildIpingSlotLabels(2, rankCount), expected);
    // 1명 진출 원본에 있는 2위 라벨은 실제 진출자로 생성하지 않는다.
    const safeExpected = rankCount === 1 ? ['1-1', 'BYE', '2-1', 'BYE'] : expected;
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        // 실제 예선에는 탈락자도 포함된다. 1명 진출에서도 2위가 섞이지 않는지 검사한다.
        const groupSize = Math.max(2, rankCount);
        const groups = pools(2, [groupSize, groupSize]);
        const participants = groups.flat();
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: [groupSize, groupSize] },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-two', option, participants, 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const slots = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(slots, safeExpected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(slots.filter(label => label !== 'BYE')).size, rankCount * 2);
        assert.equal(slots.filter(label => label !== 'BYE').length, rankCount * 2);
      }
    }
  });
}
// 사용자가 제공한 3개조 캡처 12장: 좌측 위→아래, 우측 위→아래.
const threeGroupScreenshotSlots = {
  1: '1-1 BYE 2-1 3-1',
  2: '1-1 BYE 2-2 3-2 3-1 1-2 BYE 2-1',
  3: '1-1 BYE 2-3 3-3 3-2 BYE BYE 2-2 3-1 BYE BYE 1-2 1-3 BYE BYE 2-1',
  4: '1-1 BYE 2-3 3-3 3-2 1-4 BYE 2-2 3-1 BYE 2-4 1-2 1-3 3-4 BYE 2-1',
  5: '1-1 BYE 2-3 3-3 3-2 1-4 3-5 2-2 3-1 2-5 2-4 1-2 1-3 3-4 1-5 2-1',
  6: '1-1 BYE 2-6 3-6 2-3 BYE BYE 1-3 3-2 BYE BYE 2-4 1-5 BYE BYE 2-2 2-1 BYE BYE 3-5 3-4 BYE BYE 1-2 3-3 BYE BYE 1-4 2-5 1-6 BYE 3-1',
  7: '1-1 BYE 2-6 3-6 2-3 BYE BYE 1-3 3-2 BYE 3-7 1-5 3-4 2-7 BYE 2-2 2-1 BYE 1-7 3-5 2-4 BYE BYE 1-2 3-3 BYE BYE 1-4 2-5 1-6 BYE 3-1',
  8: '1-1 BYE 2-6 3-6 2-3 1-8 BYE 1-3 3-2 BYE 3-7 1-5 3-4 2-7 BYE 2-2 2-1 BYE 1-7 3-5 2-4 3-8 BYE 1-2 3-3 BYE 2-8 1-4 2-5 1-6 BYE 3-1',
  9: '1-1 BYE 2-6 3-6 2-3 1-8 3-9 1-3 3-2 BYE 3-7 1-5 3-4 2-7 BYE 2-2 2-1 BYE 1-7 3-5 2-4 3-8 2-9 1-2 3-3 1-9 2-8 1-4 2-5 1-6 BYE 3-1',
  10: '1-1 BYE 1-6 3-6 2-3 1-8 3-9 1-3 3-2 1-10 3-7 3-4 2-5 2-7 2-10 2-2 3-1 3-10 1-7 3-5 2-4 2-8 2-9 1-2 3-3 1-9 3-8 1-4 1-5 2-6 BYE 2-1',
  11: '1-1 BYE 1-11 3-11 1-6 BYE BYE 3-6 2-3 BYE BYE 1-8 3-9 BYE BYE 1-3 3-2 BYE BYE 1-10 3-7 BYE BYE 3-4 2-5 BYE BYE 2-7 2-10 BYE BYE 2-2 3-1 BYE BYE 3-10 1-7 BYE BYE 3-5 2-4 BYE BYE 2-8 2-9 BYE BYE 1-2 3-3 BYE BYE 1-9 3-8 BYE BYE 1-4 1-5 BYE BYE 2-6 2-11 BYE BYE 2-1',
  12: '1-1 BYE 1-11 3-11 1-6 BYE BYE 3-6 2-3 BYE BYE 1-8 3-9 BYE BYE 1-3 3-2 BYE BYE 1-10 3-7 BYE BYE 3-4 2-5 BYE BYE 2-7 2-10 2-12 BYE 2-2 3-1 BYE 1-12 3-10 1-7 BYE BYE 3-5 2-4 BYE BYE 2-8 2-9 BYE BYE 1-2 3-3 BYE BYE 1-9 3-8 BYE BYE 1-4 1-5 BYE BYE 2-6 2-11 3-12 BYE 2-1',
};
for (const [count, labels] of Object.entries(threeGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 3개조×${rankCount}명: 全슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(3, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(3, Array(3).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(3).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-three', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 3);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 3);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 3);
      }
    }
  });
}
// 사용자가 제공한 4개조 캡처 12장. 기존 웹 fixture와 독립된 전체 슬롯 기준.
const fourGroupScreenshotSlots = {
  1: '1-1 3-1 2-1 4-1',
  2: '1-1 4-2 3-1 2-2 1-2 4-1 3-2 2-1',
  3: '1-1 BYE 3-3 2-2 3-2 2-3 BYE 4-1 3-1 BYE 1-3 4-2 1-2 4-3 BYE 2-1',
  4: '1-1 2-4 3-3 4-2 1-2 2-3 3-4 4-1 3-1 4-4 1-3 2-2 3-2 4-3 1-4 2-1',
  5: '1-1 BYE 3-5 2-4 1-3 BYE BYE 4-2 1-2 BYE BYE 4-3 3-4 2-5 BYE 4-1 3-1 BYE 1-5 4-4 3-3 BYE BYE 2-2 3-2 BYE BYE 2-3 1-4 4-5 BYE 2-1',
  6: '1-1 BYE 3-5 2-4 1-3 2-6 BYE 4-2 1-2 BYE 3-6 4-3 3-4 2-5 BYE 4-1 3-1 BYE 1-5 4-4 3-3 4-6 BYE 2-2 3-2 BYE 1-6 2-3 1-4 4-5 BYE 2-1',
  7: '1-1 BYE 3-5 2-4 1-3 4-6 3-7 2-2 3-2 4-7 1-6 2-3 3-4 4-5 BYE 2-1 3-1 BYE 1-5 4-4 3-3 2-6 1-7 4-2 1-2 2-7 3-6 4-3 1-4 2-5 BYE 4-1',
  8: '1-1 4-8 3-5 2-4 3-3 4-6 1-7 2-2 3-2 4-7 1-6 2-3 3-4 4-5 1-8 2-1 3-1 2-8 1-5 4-4 1-3 2-6 3-7 4-2 1-2 2-7 3-6 4-3 1-4 2-5 3-8 4-1',
  9: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE BYE 2-6 1-7 BYE BYE 2-2 3-2 BYE BYE 4-7 3-6 BYE BYE 4-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1 3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 3-3 BYE BYE 4-6 3-7 BYE BYE 4-2 1-2 BYE BYE 2-7 1-6 BYE BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  10: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE BYE 2-6 1-7 2-10 BYE 2-2 3-2 BYE 3-10 4-7 3-6 BYE BYE 4-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1 3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 3-3 BYE BYE 4-6 3-7 4-10 BYE 4-2 1-2 BYE 1-10 2-7 1-6 BYE BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  11: '1-1 BYE 1-9 2-8 1-5 BYE BYE 2-4 1-3 BYE 1-11 2-6 1-7 2-10 BYE 2-2 3-2 BYE 3-10 4-7 3-6 4-11 BYE 4-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1 3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 3-3 BYE 3-11 4-6 3-7 4-10 BYE 4-2 1-2 BYE 1-10 2-7 1-6 2-11 BYE 2-3 1-4 BYE BYE 2-5 1-8 2-9 BYE 2-1',
  12: '1-1 BYE 1-9 2-8 1-5 2-12 BYE 2-4 1-3 BYE 1-11 2-6 1-7 2-10 BYE 2-2 3-2 BYE 3-10 4-7 3-6 4-11 BYE 4-3 3-4 BYE 3-12 4-5 3-8 4-9 BYE 4-1 3-1 BYE 3-9 4-8 3-5 4-12 BYE 4-4 3-3 BYE 3-11 4-6 3-7 4-10 BYE 4-2 1-2 BYE 1-10 2-7 1-6 2-11 BYE 2-3 1-4 BYE 1-12 2-5 1-8 2-9 BYE 2-1',
};
for (const [count, labels] of Object.entries(fourGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 4개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(4, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(4, Array(4).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(4).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-four', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 4);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 4);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 4);
      }
    }
  });
}
// 사용자가 제공한 5개조 캡처 12장: 각 열을 위→아래로 읽는다.
const fiveGroupScreenshotSlots = {
  1: '1-1 BYE 3-1 BYE 2-1 BYE 4-1 5-1',
  2: '1-1 BYE 2-2 3-2 5-1 BYE BYE 4-1 3-1 BYE BYE 4-2 5-2 1-2 BYE 2-1',
  3: '1-1 BYE 2-2 4-2 5-1 3-3 1-3 4-1 3-1 5-3 2-3 1-2 5-2 3-2 4-3 2-1',
  4: '1-1 BYE 3-4 4-4 2-2 BYE BYE 5-2 5-1 BYE BYE 3-3 1-3 2-4 BYE 4-1 3-1 BYE 1-4 5-3 2-3 BYE BYE 4-2 1-2 BYE BYE 3-2 4-3 5-4 BYE 2-1',
  5: '1-1 BYE 4-2 5-5 5-1 BYE 3-3 2-4 3-1 BYE 1-3 2-5 2-2 BYE 5-3 4-4 2-1 BYE 5-2 1-5 1-2 BYE 4-3 3-4 4-1 BYE 2-3 3-5 3-2 4-5 1-4 5-4',
  6: '1-1 BYE 3-4 5-4 5-2 1-5 2-5 4-2 5-1 1-6 3-5 4-3 2-3 1-4 5-6 4-1 3-1 4-6 2-4 5-3 3-3 4-5 2-6 1-2 2-2 3-6 5-5 3-2 1-3 4-4 BYE 2-1',
  7: '1-1 BYE 3-7 5-7 1-4 BYE BYE 5-4 2-2 BYE BYE 1-5 3-5 BYE BYE 4-2 5-1 BYE BYE 2-6 5-5 BYE BYE 3-3 4-3 BYE BYE 2-4 4-6 BYE BYE 2-1 3-1 BYE 4-7 5-6 3-4 BYE BYE 5-3 2-3 BYE BYE 4-5 3-6 BYE BYE 1-2 5-2 BYE BYE 1-6 2-5 BYE BYE 3-2 1-3 BYE BYE 4-4 1-7 2-7 BYE 4-1',
  8: '1-1 BYE 1-7 5-7 1-4 BYE BYE 5-4 2-2 BYE BYE 1-5 2-5 1-8 BYE 1-2 5-1 BYE 3-8 3-6 3-5 BYE BYE 3-3 4-3 BYE BYE 4-4 4-6 2-8 BYE 4-1 3-1 BYE 3-7 5-6 3-4 BYE BYE 5-3 2-3 BYE BYE 4-5 2-6 4-8 BYE 4-2 5-2 BYE 5-8 1-6 5-5 BYE BYE 3-2 1-3 BYE BYE 2-4 4-7 2-7 BYE 2-1',
  9: '1-1 BYE 1-7 5-7 1-4 BYE BYE 5-4 2-2 BYE 5-9 1-5 2-5 1-8 BYE 1-2 5-1 BYE 3-8 3-6 3-5 3-9 BYE 3-3 4-3 BYE 4-9 4-4 4-6 2-8 BYE 4-1 3-1 BYE 3-7 5-6 3-4 BYE BYE 5-3 2-3 BYE 2-9 4-5 2-6 4-8 BYE 4-2 5-2 BYE 5-8 1-6 5-5 1-9 BYE 3-2 1-3 BYE BYE 2-4 4-7 2-7 BYE 2-1',
  10: '1-1 BYE 1-7 5-7 1-4 5-10 1-10 5-4 2-2 BYE 5-9 1-5 2-5 1-8 BYE 1-2 5-1 BYE 3-8 3-6 3-5 3-9 BYE 3-3 4-3 BYE 4-9 4-4 4-6 2-8 BYE 4-1 3-1 BYE 3-7 5-6 3-4 3-10 BYE 5-3 2-3 BYE 2-9 4-5 2-6 4-8 BYE 4-2 5-2 BYE 5-8 1-6 5-5 1-9 BYE 3-2 1-3 2-10 4-10 2-4 4-7 2-7 BYE 2-1',
  11: '1-1 BYE 1-7 5-7 1-4 5-10 1-10 5-4 2-2 BYE 5-9 1-5 2-5 1-8 BYE 1-2 5-1 BYE 3-8 3-6 3-5 3-9 3-11 3-3 4-3 2-11 4-9 4-4 4-6 2-8 BYE 4-1 3-1 BYE 3-7 5-6 3-4 3-10 1-11 5-3 2-3 4-11 2-9 4-5 2-6 4-8 BYE 4-2 5-2 BYE 5-8 1-6 5-5 1-9 5-11 3-2 1-3 2-10 4-10 2-4 4-7 2-7 BYE 2-1',
  12: '1-1 BYE 1-7 5-7 1-4 5-10 1-10 5-4 2-2 4-12 5-9 1-5 2-5 1-8 5-12 1-2 5-1 3-12 3-8 3-6 3-5 3-9 3-11 3-3 4-3 2-11 4-9 4-4 4-6 2-8 BYE 4-1 3-1 BYE 3-7 5-6 3-4 3-10 1-11 5-3 2-3 4-11 2-9 4-5 2-6 4-8 2-12 4-2 5-2 1-12 5-8 1-6 5-5 1-9 5-11 3-2 1-3 2-10 4-10 2-4 4-7 2-7 BYE 2-1',
};
for (const [count, labels] of Object.entries(fiveGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 5개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(5, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(5, Array(5).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(5).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-five', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 5);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 5);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 5);
      }
    }
  });
}
// 사용자 제공 6개조 1~12명 캡처. 11명은 3장, 12명은 2장을 이어 기록했다.
const sixGroupScreenshotSlots = {
  11: [
    '1-1 BYE 5-11 4-11 3-6 BYE BYE 2-6 5-3 BYE BYE 6-8 1-9 BYE BYE 4-3',
    '3-2 BYE BYE 2-10 5-7 BYE BYE 6-4 1-5 BYE BYE 4-7 3-10 BYE BYE 2-2',
    '5-1 BYE BYE 6-10 1-7 BYE BYE 4-5 3-4 BYE BYE 2-8 5-9 BYE BYE 6-2',
    '1-3 BYE BYE 4-9 3-8 BYE BYE 2-4 5-5 BYE BYE 6-6 1-11 BYE BYE 4-1',
    '3-1 BYE BYE 2-11 5-6 BYE BYE 6-5 1-4 BYE BYE 4-8 3-9 BYE BYE 2-3',
    '5-2 BYE BYE 6-9 1-8 BYE BYE 4-4 3-5 BYE BYE 2-7 5-10 BYE BYE 6-1',
    '1-2 BYE BYE 4-10 3-7 BYE BYE 2-5 5-4 BYE BYE 6-7 1-10 BYE BYE 4-2',
    '3-3 BYE BYE 2-9 5-8 BYE BYE 6-3 1-6 BYE BYE 4-6 3-11 6-11 BYE 2-1',
  ].join(' '),
  12: [
    '1-1 BYE 5-11 4-11 3-6 BYE BYE 2-6 5-3 BYE BYE 6-8 1-9 BYE BYE 4-3',
    '3-2 BYE BYE 2-10 5-7 BYE BYE 6-4 1-5 BYE BYE 4-7 3-10 6-12 BYE 2-2',
    '5-1 BYE 3-12 6-10 1-7 BYE BYE 4-5 3-4 BYE BYE 2-8 5-9 BYE BYE 6-2',
    '1-3 BYE BYE 4-9 3-8 BYE BYE 2-4 5-5 BYE BYE 6-6 1-11 2-12 BYE 4-1',
    '3-1 BYE 1-12 2-11 5-6 BYE BYE 6-5 1-4 BYE BYE 4-8 3-9 BYE BYE 2-3',
    '5-2 BYE BYE 6-9 1-8 BYE BYE 4-4 3-5 BYE BYE 2-7 5-10 4-12 BYE 6-1',
    '1-2 BYE 5-12 4-10 3-7 BYE BYE 2-5 5-4 BYE BYE 6-7 1-10 BYE BYE 4-2',
    '3-3 BYE BYE 2-9 5-8 BYE BYE 6-3 1-6 BYE BYE 4-6 3-11 6-11 BYE 2-1',
  ].join(' '),
  1: '1-1 BYE 3-1 6-1 2-1 BYE 4-1 5-1',
  2: '1-1 BYE 2-2 6-2 5-1 3-2 BYE 4-1 3-1 BYE 4-2 6-1 5-2 1-2 BYE 2-1',
  3: '1-1 BYE 5-3 4-3 3-2 BYE BYE 2-2 5-1 BYE BYE 6-2 1-3 BYE BYE 4-1 3-1 BYE BYE 2-3 5-2 BYE BYE 6-1 1-2 BYE BYE 4-2 3-3 6-3 BYE 2-1',
  4: '1-1 BYE 5-3 4-3 3-2 6-4 BYE 2-2 5-1 BYE 3-4 6-2 1-3 2-4 BYE 4-1 3-1 BYE 1-4 2-3 5-2 4-4 BYE 6-1 1-2 BYE 5-4 4-2 3-3 6-3 BYE 2-1',
  5: '1-1 BYE 5-3 4-3 3-2 6-4 1-5 2-2 5-1 4-5 3-4 6-2 1-3 2-4 5-5 4-1 3-1 6-5 1-4 2-3 5-2 4-4 3-5 6-1 1-2 2-5 5-4 4-2 3-3 6-3 BYE 2-1',
  6: '1-1 BYE 3-6 2-6 5-3 BYE BYE 4-3 3-2 BYE BYE 6-4 1-5 BYE BYE 2-2 5-1 BYE BYE 4-5 3-4 BYE BYE 6-2 1-3 BYE BYE 2-4 5-5 6-6 BYE 4-1 3-1 BYE 5-6 6-5 1-4 BYE BYE 2-3 5-2 BYE BYE 4-4 3-5 BYE BYE 6-1 1-2 BYE BYE 2-5 5-4 BYE BYE 4-2 3-3 BYE BYE 6-3 1-6 4-6 BYE 2-1',
  7: '1-1 BYE 3-6 2-6 5-3 BYE BYE 4-3 3-2 BYE 5-7 6-4 1-5 4-7 BYE 2-2 5-1 BYE 1-7 4-5 3-4 BYE BYE 6-2 1-3 BYE BYE 2-4 5-5 6-6 BYE 4-1 3-1 BYE 5-6 6-5 1-4 BYE BYE 2-3 5-2 BYE BYE 4-4 3-5 2-7 BYE 6-1 1-2 BYE 3-7 2-5 5-4 6-7 BYE 4-2 3-3 BYE BYE 6-3 1-6 4-6 BYE 2-1',
  8: '1-1 BYE 3-6 2-6 5-3 6-8 BYE 4-3 3-2 BYE 5-7 6-4 1-5 4-7 BYE 2-2 5-1 BYE 1-7 4-5 3-4 2-8 BYE 6-2 1-3 BYE 3-8 2-4 5-5 6-6 BYE 4-1 3-1 BYE 5-6 6-5 1-4 4-8 BYE 2-3 5-2 BYE 1-8 4-4 3-5 2-7 BYE 6-1 1-2 BYE 3-7 2-5 5-4 6-7 BYE 4-2 3-3 BYE 5-8 6-3 1-6 4-6 BYE 2-1',
  9: '1-1 BYE 3-6 2-6 5-3 6-8 1-9 4-3 3-2 BYE 5-7 6-4 1-5 4-7 BYE 2-2 5-1 BYE 1-7 4-5 3-4 2-8 5-9 6-2 1-3 4-9 3-8 2-4 5-5 6-6 BYE 4-1 3-1 BYE 5-6 6-5 1-4 4-8 3-9 2-3 5-2 6-9 1-8 4-4 3-5 2-7 BYE 6-1 1-2 BYE 3-7 2-5 5-4 6-7 BYE 4-2 3-3 2-9 5-8 6-3 1-6 4-6 BYE 2-1',
  10: '1-1 BYE 3-6 2-6 5-3 6-8 1-9 4-3 3-2 2-10 5-7 6-4 1-5 4-7 3-10 2-2 5-1 6-10 1-7 4-5 3-4 2-8 5-9 6-2 1-3 4-9 3-8 2-4 5-5 6-6 BYE 4-1 3-1 BYE 5-6 6-5 1-4 4-8 3-9 2-3 5-2 6-9 1-8 4-4 3-5 2-7 5-10 6-1 1-2 4-10 3-7 2-5 5-4 6-7 1-10 4-2 3-3 2-9 5-8 6-3 1-6 4-6 BYE 2-1',
};
for (const [count, labels] of Object.entries(sixGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 6개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(6, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(6, Array(6).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(6).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-six', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 6);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 6);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 6);
      }
    }
  });
}
// 사용자 제공 7개조 1~12명 캡처. 10~12명은 각각 2장을 이어 기록했다.
const sevenGroupScreenshotSlots = {
  10: [
    '1-1 BYE 4-10 3-10 2-5 BYE BYE 1-5 5-3 BYE BYE 5-7 6-7 BYE BYE 4-3',
    '3-2 BYE BYE 7-8 4-6 BYE BYE 6-4 7-4 BYE BYE 3-6 2-9 BYE BYE 2-2',
    '5-1 BYE 1-10 5-9 7-6 BYE BYE 3-4 2-3 BYE BYE 1-7 4-8 BYE BYE 6-2',
    '7-2 BYE BYE 3-8 2-7 BYE BYE 1-3 5-5 BYE BYE 6-6 6-9 7-10 BYE 4-1',
    '3-1 BYE 6-10 7-9 4-5 BYE BYE 6-5 7-3 BYE BYE 3-7 2-8 BYE BYE 1-2',
    '5-2 BYE BYE 5-8 7-7 BYE BYE 4-4 2-4 BYE BYE 1-6 4-9 2-10 BYE 6-1',
    '7-1 BYE BYE 3-9 2-6 BYE BYE 1-4 5-4 BYE BYE 5-6 6-8 BYE BYE 4-2',
    '3-3 BYE BYE 1-8 4-7 BYE BYE 6-3 7-5 BYE BYE 3-5 1-9 5-10 BYE 2-1',
  ].join(' '),
  11: [
    '1-1 BYE 4-10 3-10 2-5 BYE BYE 1-5 5-3 BYE BYE 5-7 6-7 BYE BYE 4-3',
    '3-2 BYE 6-11 7-8 4-6 BYE BYE 6-4 7-4 BYE BYE 3-6 2-9 5-11 BYE 2-2',
    '5-1 BYE 1-10 5-9 7-6 BYE BYE 3-4 2-3 BYE BYE 1-7 4-8 2-11 BYE 6-2',
    '7-2 BYE 3-11 3-8 2-7 BYE BYE 1-3 5-5 BYE BYE 6-6 6-9 7-10 BYE 4-1',
    '3-1 BYE 6-10 7-9 4-5 BYE BYE 6-5 7-3 BYE BYE 3-7 2-8 BYE BYE 1-2',
    '5-2 BYE 1-11 5-8 7-7 BYE BYE 4-4 2-4 BYE BYE 1-6 4-9 2-10 BYE 6-1',
    '7-1 BYE 4-11 3-9 2-6 BYE BYE 1-4 5-4 BYE BYE 5-6 6-8 7-11 BYE 4-2',
    '3-3 BYE BYE 1-8 4-7 BYE BYE 6-3 7-5 BYE BYE 3-5 1-9 5-10 BYE 2-1',
  ].join(' '),
  12: [
    '1-1 BYE 4-10 3-10 2-5 BYE BYE 1-5 5-3 BYE 1-12 5-7 6-7 7-12 BYE 4-3',
    '3-2 BYE 6-11 7-8 4-6 BYE BYE 6-4 7-4 BYE BYE 3-6 2-9 5-11 BYE 2-2',
    '5-1 BYE 1-10 5-9 7-6 BYE BYE 3-4 2-3 BYE BYE 1-7 4-8 2-11 BYE 6-2',
    '7-2 BYE 3-11 3-8 2-7 4-12 BYE 1-3 5-5 BYE BYE 6-6 6-9 7-10 BYE 4-1',
    '3-1 BYE 6-10 7-9 4-5 BYE BYE 6-5 7-3 BYE 3-12 3-7 2-8 5-12 BYE 1-2',
    '5-2 BYE 1-11 5-8 7-7 BYE BYE 4-4 2-4 BYE BYE 1-6 4-9 2-10 BYE 6-1',
    '7-1 BYE 4-11 3-9 2-6 BYE BYE 1-4 5-4 BYE BYE 5-6 6-8 7-11 BYE 4-2',
    '3-3 BYE 6-12 1-8 4-7 2-12 BYE 6-3 7-5 BYE BYE 3-5 1-9 5-10 BYE 2-1',
  ].join(' '),
  1: '1-1 BYE 3-1 6-1 2-1 7-1 4-1 5-1',
  2: '1-1 BYE 2-2 7-2 5-1 6-2 3-2 4-1 3-1 4-2 5-2 6-1 7-1 1-2 BYE 2-1',
  3: '1-1 BYE 5-3 4-3 3-2 BYE BYE 2-2 5-1 BYE 2-3 6-2 7-2 1-3 BYE 4-1 3-1 BYE 7-3 1-2 5-2 BYE BYE 6-1 7-1 BYE BYE 4-2 3-3 6-3 BYE 2-1',
  4: '1-1 BYE 5-3 4-3 3-2 6-4 7-4 2-2 5-1 3-4 2-3 6-2 7-2 1-3 BYE 4-1 3-1 BYE 7-3 1-2 5-2 4-4 2-4 6-1 7-1 1-4 5-4 4-2 3-3 6-3 BYE 2-1',
  5: '1-1 BYE 2-5 3-5 5-3 BYE BYE 4-3 3-2 BYE BYE 6-4 7-4 BYE BYE 2-2 5-1 BYE BYE 3-4 2-3 BYE BYE 6-2 7-2 BYE BYE 1-3 5-5 BYE BYE 4-1 3-1 BYE 4-5 6-5 7-3 BYE BYE 1-2 5-2 BYE BYE 4-4 2-4 BYE BYE 6-1 7-1 BYE BYE 1-4 5-4 BYE BYE 4-2 3-3 BYE BYE 6-3 7-5 1-5 BYE 2-1',
  6: '1-1 BYE 2-5 6-5 5-3 BYE BYE 4-3 3-2 BYE 4-6 6-4 7-4 3-6 BYE 2-2 5-1 BYE 7-6 3-4 2-3 BYE BYE 6-2 7-2 BYE BYE 1-3 5-5 6-6 BYE 4-1 3-1 BYE 4-5 1-5 7-3 BYE BYE 1-2 5-2 BYE BYE 4-4 2-4 1-6 BYE 6-1 7-1 BYE 2-6 1-4 5-4 3-5 BYE 4-2 3-3 BYE BYE 6-3 7-5 5-6 BYE 2-1',
  7: '1-1 BYE 2-5 6-5 5-3 3-7 6-7 4-3 3-2 BYE 4-6 6-4 7-4 5-6 BYE 2-2 5-1 BYE 7-6 3-4 2-3 1-7 BYE 6-2 7-2 BYE 2-7 1-3 5-5 6-6 BYE 4-1 3-1 BYE 4-5 1-5 7-3 5-7 BYE 1-2 5-2 BYE 7-7 4-4 2-4 1-6 BYE 6-1 7-1 BYE 2-6 1-4 5-4 3-6 BYE 4-2 3-3 BYE 4-7 6-3 7-5 3-5 BYE 2-1',
  8: '1-1 BYE 2-5 6-5 3-3 5-7 6-7 4-3 5-2 7-8 4-6 6-4 7-4 3-6 BYE 2-2 2-1 BYE 7-6 5-4 2-3 1-7 4-8 6-2 7-2 3-8 2-7 1-3 5-5 6-6 BYE 4-1 3-1 BYE 4-5 1-5 7-3 3-7 2-8 1-2 3-2 5-8 7-7 4-4 2-4 1-6 BYE 6-1 7-1 BYE 2-6 1-4 3-4 5-6 6-8 4-2 5-3 1-8 4-7 6-3 7-5 3-5 BYE 5-1',
  9: '1-1 BYE 2-5 1-5 5-3 5-7 6-7 4-3 3-2 7-8 4-6 6-4 7-4 3-6 2-9 2-2 5-1 5-9 7-6 3-4 2-3 1-7 4-8 6-2 7-2 3-8 2-7 1-3 5-5 6-6 6-9 4-1 3-1 7-9 4-5 6-5 7-3 3-7 2-8 1-2 5-2 5-8 7-7 4-4 2-4 1-6 4-9 6-1 7-1 3-9 2-6 1-4 5-4 5-6 6-8 4-2 3-3 1-8 4-7 6-3 7-5 3-5 1-9 2-1',
};
for (const [count, labels] of Object.entries(sevenGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 7개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(7, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(7, Array(7).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(7).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-seven', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 7);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 7);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 7);
      }
    }
  });
}
// 사용자 제공 8개조 1~12명 캡처. 9~12명은 각각 2장을 이어 기록했다.
const eightGroupScreenshotSlots = {
  9: [
    '1-1 BYE 1-9 6-8 1-5 BYE BYE 6-4 5-3 BYE BYE 2-6 5-7 BYE BYE 2-2',
    '3-2 BYE BYE 4-7 3-6 BYE BYE 4-3 7-4 BYE BYE 8-5 7-8 8-9 BYE 8-1',
    '5-1 BYE 5-9 2-8 5-5 BYE BYE 2-4 1-3 BYE BYE 6-6 1-7 BYE BYE 6-2',
    '7-2 BYE BYE 8-7 7-6 BYE BYE 8-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1',
    '3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 7-3 BYE BYE 8-6 7-7 BYE BYE 8-2',
    '5-2 BYE BYE 2-7 5-6 BYE BYE 2-3 1-4 BYE BYE 6-5 1-8 6-9 BYE 6-1',
    '7-1 BYE 7-9 8-8 7-5 BYE BYE 8-4 3-3 BYE BYE 4-6 3-7 BYE BYE 4-2',
    '1-2 BYE BYE 6-7 1-6 BYE BYE 6-3 5-4 BYE BYE 2-5 5-8 2-9 BYE 2-1',
  ].join(' '),
  10: [
    '1-1 BYE 1-9 6-8 1-5 BYE BYE 6-4 5-3 BYE BYE 2-6 5-7 2-10 BYE 2-2',
    '3-2 BYE 3-10 4-7 3-6 BYE BYE 4-3 7-4 BYE BYE 8-5 7-8 8-9 BYE 8-1',
    '5-1 BYE 5-9 2-8 5-5 BYE BYE 2-4 1-3 BYE BYE 6-6 1-7 6-10 BYE 6-2',
    '7-2 BYE 7-10 8-7 7-6 BYE BYE 8-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1',
    '3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 7-3 BYE BYE 8-6 7-7 8-10 BYE 8-2',
    '5-2 BYE 5-10 2-7 5-6 BYE BYE 2-3 1-4 BYE BYE 6-5 1-8 6-9 BYE 6-1',
    '7-1 BYE 7-9 8-8 7-5 BYE BYE 8-4 3-3 BYE BYE 4-6 3-7 4-10 BYE 4-2',
    '1-2 BYE 1-10 6-7 1-6 BYE BYE 6-3 5-4 BYE BYE 2-5 5-8 2-9 BYE 2-1',
  ].join(' '),
  11: [
    '1-1 BYE 1-9 6-8 1-5 BYE BYE 6-4 5-3 BYE 5-11 2-6 5-7 2-10 BYE 2-2',
    '3-2 BYE 3-10 4-7 3-6 4-11 BYE 4-3 7-4 BYE BYE 8-5 7-8 8-9 BYE 8-1',
    '5-1 BYE 5-9 2-8 5-5 BYE BYE 2-4 1-3 BYE 1-11 6-6 1-7 6-10 BYE 6-2',
    '7-2 BYE 7-10 8-7 7-6 8-11 BYE 8-3 3-4 BYE BYE 4-5 3-8 4-9 BYE 4-1',
    '3-1 BYE 3-9 4-8 3-5 BYE BYE 4-4 7-3 BYE 7-11 8-6 7-7 8-10 BYE 8-2',
    '5-2 BYE 5-10 2-7 5-6 2-11 BYE 2-3 1-4 BYE BYE 6-5 1-8 6-9 BYE 6-1',
    '7-1 BYE 7-9 8-8 7-5 BYE BYE 8-4 3-3 BYE 3-11 4-6 3-7 4-10 BYE 4-2',
    '1-2 BYE 1-10 6-7 1-6 6-11 BYE 6-3 5-4 BYE BYE 2-5 5-8 2-9 BYE 2-1',
  ].join(' '),
  12: [
    '1-1 BYE 1-9 6-8 1-5 6-12 BYE 6-4 5-3 BYE 5-11 2-6 5-7 2-10 BYE 2-2',
    '3-2 BYE 3-10 4-7 3-6 4-11 BYE 4-3 7-4 BYE 7-12 8-5 7-8 8-9 BYE 8-1',
    '5-1 BYE 5-9 2-8 5-5 2-12 BYE 2-4 1-3 BYE 1-11 6-6 1-7 6-10 BYE 6-2',
    '7-2 BYE 7-10 8-7 7-6 8-11 BYE 8-3 3-4 BYE 3-12 4-5 3-8 4-9 BYE 4-1',
    '3-1 BYE 3-9 4-8 3-5 4-12 BYE 4-4 7-3 BYE 7-11 8-6 7-7 8-10 BYE 8-2',
    '5-2 BYE 5-10 2-7 5-6 2-11 BYE 2-3 1-4 BYE 1-12 6-5 1-8 6-9 BYE 6-1',
    '7-1 BYE 7-9 8-8 7-5 8-12 BYE 8-4 3-3 BYE 3-11 4-6 3-7 4-10 BYE 4-2',
    '1-2 BYE 1-10 6-7 1-6 6-11 BYE 6-3 5-4 BYE 5-12 2-5 5-8 2-9 BYE 2-1',
  ].join(' '),
  1: '1-1 8-1 3-1 6-1 2-1 7-1 4-1 5-1',
  2: '1-1 2-2 7-2 8-1 5-1 6-2 3-2 4-1 3-1 4-2 5-2 6-1 7-1 8-2 1-2 2-1',
  3: '1-1 BYE 5-3 2-2 3-2 4-3 BYE 8-1 5-1 BYE 1-3 6-2 7-2 8-3 BYE 4-1 3-1 BYE 7-3 8-2 5-2 2-3 BYE 6-1 7-1 BYE 3-3 4-2 1-2 6-3 BYE 2-1',
  4: '1-1 6-4 5-3 2-2 3-2 4-3 7-4 8-1 5-1 2-4 1-3 6-2 7-2 8-3 3-4 4-1 3-1 4-4 7-3 8-2 5-2 2-3 1-4 6-1 7-1 8-4 3-3 4-2 1-2 6-3 5-4 2-1',
  5: '1-1 BYE 8-5 6-4 5-3 BYE BYE 2-2 3-2 BYE BYE 4-3 7-4 1-5 BYE 8-1 5-1 BYE 4-5 2-4 1-3 BYE BYE 6-2 7-2 BYE BYE 8-3 3-4 5-5 BYE 4-1 3-1 BYE 6-5 4-4 7-3 BYE BYE 8-2 5-2 BYE BYE 2-3 1-4 3-5 BYE 6-1 7-1 BYE 2-5 8-4 3-3 BYE BYE 4-2 1-2 BYE BYE 6-3 5-4 7-5 BYE 2-1',
  6: '1-1 BYE 3-5 6-4 5-3 2-6 BYE 8-2 3-2 BYE 5-6 4-3 7-4 6-5 BYE 8-1 5-1 BYE 7-5 2-4 1-3 6-6 BYE 4-2 1-2 BYE 7-6 8-3 3-4 2-5 BYE 4-1 3-1 BYE 1-5 4-4 7-3 8-6 BYE 2-2 5-2 BYE 3-6 2-3 1-4 8-5 BYE 6-1 7-1 BYE 5-5 8-4 3-3 4-6 BYE 6-2 7-2 BYE 1-6 6-3 5-4 4-5 BYE 2-1',
  7: '1-1 BYE 3-5 4-4 7-3 2-6 5-7 8-2 3-2 2-7 5-6 4-3 7-4 8-5 BYE 6-1 5-1 BYE 7-5 2-4 1-3 4-6 3-7 6-2 7-2 6-7 1-6 8-3 5-4 2-5 BYE 4-1 3-1 BYE 1-5 6-4 5-3 8-6 7-7 2-2 5-2 4-7 3-6 2-3 1-4 6-5 BYE 8-1 7-1 BYE 5-5 8-4 3-3 6-6 1-7 4-2 1-2 8-7 7-6 6-3 3-4 4-5 BYE 2-1',
  8: '1-1 6-8 3-5 4-4 7-3 2-6 5-7 8-2 3-2 2-7 5-6 4-3 7-4 8-5 1-8 6-1 5-1 8-8 7-5 2-4 1-3 4-6 3-7 6-2 7-2 6-7 1-6 8-3 5-4 2-5 3-8 4-1 3-1 4-8 1-5 6-4 5-3 8-6 7-7 2-2 5-2 4-7 3-6 2-3 1-4 6-5 7-8 8-1 7-1 2-8 5-5 8-4 3-3 6-6 1-7 4-2 1-2 8-7 7-6 6-3 3-4 4-5 5-8 2-1',
};
for (const [count, labels] of Object.entries(eightGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 8개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(8, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(8, Array(8).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(8).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-eight', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 8);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 8);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 8);
      }
    }
  });
}
const nineGroupScreenshotSlots = {
  8: '1-1 BYE 5-8 4-8 8-4 BYE BYE 5-4 2-2 BYE BYE 7-6 1-6 BYE BYE 8-2 9-1 BYE BYE 2-7 1-5 BYE BYE 3-3 4-3 BYE BYE 7-5 5-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 BYE BYE 6-2 7-2 BYE BYE 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 6-4 BYE BYE 3-4 7-3 BYE BYE 9-6 3-6 BYE BYE 1-2 5-2 BYE BYE 6-6 8-5 BYE BYE 1-3 6-3 BYE BYE 5-5 3-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 BYE BYE 4-2 9-2 BYE BYE 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
  9: '1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 BYE BYE 3-3 4-3 BYE BYE 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE BYE 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 BYE BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE BYE 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 BYE BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 BYE BYE 5-3 2-3 BYE BYE 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 BYE BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
  10: '1-1 BYE 5-8 4-8 6-4 BYE BYE 5-4 2-2 BYE 6-9 9-6 1-6 5-9 BYE 1-2 9-1 BYE 7-9 2-7 8-5 7-10 BYE 3-3 4-3 BYE 8-10 7-5 3-7 3-8 BYE 8-1 5-1 BYE 9-8 6-7 4-5 BYE BYE 1-4 9-3 BYE 4-10 2-5 5-6 1-9 BYE 6-2 7-2 BYE 2-9 4-6 3-5 3-10 BYE 8-3 2-4 BYE BYE 9-4 7-7 8-8 BYE 4-1 3-1 BYE 7-8 8-7 8-4 BYE BYE 3-4 7-3 BYE 2-10 7-6 3-6 3-9 BYE 8-2 5-2 BYE 9-9 6-6 1-5 5-10 BYE 1-3 6-3 BYE BYE 5-5 5-7 1-8 BYE 6-1 7-1 BYE 2-8 4-7 6-5 9-10 BYE 5-3 2-3 BYE 6-10 9-5 1-7 8-9 BYE 4-2 9-2 BYE 4-9 2-6 8-6 1-10 BYE 3-2 4-4 BYE BYE 7-4 9-7 6-8 BYE 2-1',
  1: '1-1 BYE 8-1 BYE 3-1 BYE 6-1 BYE 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1',
  2: '1-1 BYE 2-2 7-2 9-1 BYE BYE 8-1 5-1 BYE BYE 6-2 3-2 BYE BYE 4-1 3-1 BYE BYE 4-2 5-2 BYE BYE 6-1 7-1 BYE BYE 8-2 9-2 1-2 BYE 2-1',
  3: '1-1 BYE 2-2 6-2 9-1 3-3 4-3 8-1 5-1 BYE 9-3 1-2 7-2 8-3 BYE 4-1 3-1 BYE 7-3 8-2 5-2 1-3 6-3 7-1 6-1 5-3 2-3 4-2 9-2 3-2 BYE 2-1',
  4: '1-1 BYE 6-4 5-4 2-2 BYE BYE 7-2 9-1 BYE BYE 3-3 4-3 BYE BYE 8-1 5-1 BYE BYE 1-4 9-3 BYE BYE 6-2 1-2 BYE BYE 8-3 3-4 9-4 BYE 4-1 3-1 BYE 4-4 2-4 6-3 BYE BYE 8-2 5-2 BYE BYE 1-3 7-3 BYE BYE 6-1 7-1 BYE BYE 5-3 2-3 BYE BYE 4-2 9-2 BYE BYE 3-2 8-4 7-4 BYE 2-1',
  5: '1-1 BYE 6-4 5-4 2-2 BYE BYE 1-2 9-1 BYE 8-5 3-3 4-3 7-5 BYE 5-1 8-1 BYE 4-5 1-4 9-3 2-5 BYE 6-2 7-2 BYE 3-5 8-3 2-4 9-4 BYE 4-1 3-1 BYE 8-4 2-3 6-3 BYE BYE 8-2 5-2 BYE 1-5 3-4 7-3 5-5 BYE 6-1 7-1 BYE 6-5 5-3 1-3 9-5 BYE 4-2 9-2 BYE BYE 3-2 4-4 7-4 BYE 2-1',
  6: '1-1 BYE 8-4 3-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 6-3 5-5 BYE 8-1 7-1 BYE 6-5 5-3 2-3 9-5 BYE 4-2 9-2 2-6 8-6 3-2 4-4 7-4 BYE 2-1 3-1 BYE 6-4 5-4 2-2 7-6 3-6 1-2 9-1 BYE 1-5 3-3 4-3 7-5 BYE 6-1 5-1 BYE 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 BYE 4-1',
  7: '1-1 BYE 8-4 3-4 2-2 7-6 3-6 1-2 9-1 2-7 1-5 6-3 4-3 5-5 3-7 8-1 5-1 6-7 4-5 1-4 9-3 2-5 5-6 6-2 7-2 4-6 3-5 8-3 2-4 9-4 7-7 4-1 3-1 8-7 6-4 5-4 7-3 9-6 1-6 8-2 5-2 6-6 8-5 1-3 3-3 7-5 5-7 6-1 7-1 4-7 6-5 5-3 2-3 9-5 1-7 4-2 9-2 2-6 8-6 3-2 4-4 7-4 9-7 2-1',
};
for (const [count, labels] of Object.entries(nineGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 9개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(9, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(9, Array(9).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(9).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-nine', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 9);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 9);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 9);
      }
    }
  });
}

const tenGroupScreenshotSlots = {
  7: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 BYE BYE 6-2 9-1 BYE BYE 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 BYE BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 BYE BYE 2-2 3-2 BYE BYE 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 BYE BYE 4-2 1-2 BYE BYE 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE BYE 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 BYE BYE 10-1 5-2 BYE BYE 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  8: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE BYE 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 BYE BYE 4-3 5-3 BYE BYE 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE BYE 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 BYE BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE BYE 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 BYE BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 BYE BYE 6-3 3-3 BYE BYE 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 BYE BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  9: '1-1 BYE 5-7 4-7 3-4 BYE BYE 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 BYE BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 BYE BYE 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 BYE BYE 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE BYE 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 BYE BYE 4-4 3-7 6-7 BYE 2-1',
  10: '1-1 BYE 5-7 4-7 3-4 6-10 7-10 2-4 7-2 BYE 1-9 8-5 9-5 10-8 BYE 6-2 9-1 BYE 3-8 6-6 1-5 8-9 BYE 4-3 5-3 BYE 9-9 10-4 7-6 2-8 BYE 8-1 5-1 BYE 9-7 10-6 7-4 2-10 BYE 8-3 1-3 BYE 5-9 4-5 3-6 6-8 BYE 2-2 3-2 BYE 7-8 2-6 5-5 4-9 BYE 10-2 9-3 10-10 3-10 6-4 1-7 8-7 BYE 4-1 3-1 BYE 7-7 2-7 5-4 4-10 9-10 10-3 9-2 BYE 3-9 6-5 1-6 8-8 BYE 4-2 1-2 BYE 5-8 4-6 3-5 6-9 BYE 2-3 7-3 BYE 1-10 8-4 9-6 10-7 BYE 6-1 7-1 BYE 1-8 8-6 9-4 10-9 BYE 6-3 3-3 BYE 7-9 2-5 5-6 4-8 BYE 10-1 5-2 BYE 9-8 10-5 7-5 2-9 BYE 8-2 1-4 8-10 5-10 4-4 3-7 6-7 BYE 2-1',
  1: '1-1 BYE 8-1 BYE 3-1 BYE 6-1 10-1 2-1 BYE 7-1 BYE 4-1 BYE 5-1 9-1',
  2: '1-1 BYE 2-2 10-2 9-1 BYE BYE 8-1 5-1 BYE BYE 7-2 6-2 3-2 BYE 4-1 3-1 BYE 4-2 5-2 8-2 BYE BYE 6-1 7-1 BYE BYE 10-1 9-2 1-2 BYE 2-1',
  3: '1-1 BYE 7-2 6-2 9-1 4-3 5-3 8-1 5-1 8-3 1-3 2-2 3-2 10-2 9-3 4-1 3-1 10-3 9-2 4-2 1-2 2-3 7-3 6-1 7-1 6-3 3-3 10-1 5-2 8-2 BYE 2-1',
  4: '1-1 BYE 3-4 2-4 7-2 BYE BYE 6-2 9-1 BYE BYE 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 BYE BYE 2-2 3-2 BYE BYE 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 BYE BYE 4-2 1-2 BYE BYE 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 BYE BYE 10-1 5-2 BYE BYE 8-2 1-4 4-4 BYE 2-1',
  5: '1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 BYE 1-5 4-3 5-3 10-4 BYE 8-1 5-1 BYE 7-4 8-3 1-3 4-5 BYE 2-2 3-2 BYE 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 BYE 4-2 1-2 BYE 3-5 2-3 7-3 8-4 BYE 6-1 7-1 BYE 9-4 6-3 3-3 2-5 BYE 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1',
  6: '1-1 BYE 3-4 2-4 7-2 8-5 9-5 6-2 9-1 6-6 1-5 4-3 5-3 10-4 7-6 8-1 5-1 10-6 7-4 8-3 1-3 4-5 3-6 2-2 3-2 2-6 5-5 10-2 9-3 6-4 BYE 4-1 3-1 BYE 5-4 10-3 9-2 6-5 1-6 4-2 1-2 4-6 3-5 2-3 7-3 8-4 9-6 6-1 7-1 8-6 9-4 6-3 3-3 2-5 5-6 10-1 5-2 10-5 7-5 8-2 1-4 4-4 BYE 2-1',
};
for (const [count, labels] of Object.entries(tenGroupScreenshotSlots)) {
  const rankCount = Number(count);
  const expected = labels.split(' ');
  test(`사용자 캡처 10개조×${rankCount}명: 전체 슬롯·BYE·일반/상하위·예선 전후`, () => {
    assert.deepEqual(buildIpingSlotLabels(10, rankCount), expected);
    for (const tournamentMode of ['single', 'upper-lower']) {
      for (const complete of [false, true]) {
        const groupSize = rankCount + 1;
        const groups = pools(10, Array(10).fill(groupSize));
        const option = {
          blocks: [
            { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(10).fill(groupSize) },
            { type: 'SINGLES', title: '본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
              finalAdvancementMode: 'top-n', advanceCount: rankCount, tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
          ],
          roundStandings: complete ? [{ round: 1, complete: true, pools: groups.map((group, index) => ({
            label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
          })) }] : undefined,
        };
        const matches = generateProgramRoundMatches('screenshot-ten', option, groups.flat(), 2);
        const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
          .sort((a, b) => a.match_order - b.match_order);
        const actual = firstRound.flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
        assert.deepEqual(actual, expected, `${tournamentMode}, 예선 완료=${complete}`);
        assert.equal(new Set(actual.filter(label => label !== 'BYE')).size, rankCount * 10);
        assert.equal(actual.filter(label => label !== 'BYE').length, rankCount * 10);
        assert.equal(actual.filter(label => label === 'BYE').length, expected.length - rankCount * 10);
      }
    }
  });

}

test('10개조 후속 캡처 대기 범위는 호환 배치를 제공하지 않는다', () => {
  for (let rank = 11; rank <= 12; rank++) assert.equal(buildIpingSlotLabels(10, rank), null);
});

test('9개조 제공되지 않는 11~12명은 호환 배치를 제공하지 않는다', () => {
  for (let rank = 11; rank <= 12; rank++) assert.equal(buildIpingSlotLabels(9, rank), null);
});

test('사용자 캡처 4개조×3명: 1조·3조 우승자 인접 경기까지 그대로 일치', () => {
  const expected = '1-1 BYE 3-3 2-2 3-2 2-3 BYE 4-1 3-1 BYE 1-3 4-2 1-2 4-3 BYE 2-1'.split(' ');
  assert.deepEqual(buildIpingSlotLabels(4, 3), expected);
  const slots = buildTournamentSlots('fixture', 1, {}, buildCrossGroupTournamentSeedOrder(pools(4, [3, 3, 3, 3])), 'seed');
  assert.deepEqual(slots.map(slot => slot?.id ?? 'BYE'), expected);
});
for (const reference of ipingReferences) {
  const { groups: groupCount, ranks: rankCount, slots: expected } = reference;
  test(`아이핑 전체 비교 ${groupCount}개조×${rankCount}명: 원본 모든 슬롯과 BYE 일치`, () => {
    assert.deepEqual(buildIpingSlotLabels(groupCount, rankCount), expected);
  });
  test(`아이핑 선수 적용 ${groupCount}개조×${rankCount}명: 출처·유일성·안전한 퇴화 입력`, () => {
    const groups = pools(groupCount, Array(groupCount).fill(rankCount));
    const before = JSON.stringify(groups);
    const seedOrder = buildCrossGroupTournamentSeedOrder(groups);
    const slots = buildTournamentSlots('fixture', 1, {}, seedOrder, 'seed');
    const ids = new Set(groups.flat().map(unit => unit.id));
    const safeExpected = expected.length ? expected.map(label => ids.has(label) ? label : 'BYE') : ['1-1', 'BYE'];
    assert.deepEqual(slots.map(slot => slot?.id ?? 'BYE'), safeExpected);
    assert.equal(slots.filter(slot => slot?.id).length, groupCount * rankCount);
    assert.equal(new Set(slots.filter(slot => slot?.id).map(slot => slot.id)).size, groupCount * rankCount);
    slots.filter(slot => slot?.id).forEach(slot => assert.equal(slot.seedLabel, slot.id));
    assert.equal(JSON.stringify(groups), before);
    assert.deepEqual(buildCrossGroupTournamentSeedOrder(groups), seedOrder);
  });
  for (const tournamentMode of ['single', 'upper-lower']) {
    test(`실제 생성 ${tournamentMode} ${groupCount}개조×${rankCount}명: 아이핑 배치 유지`, () => {
      const groups = pools(groupCount, Array(groupCount).fill(rankCount));
      const participants = groups.flat();
      // 리그 생성의 최소 참가 인원은 2명. 비진출자는 대진에 포함하지 않는다.
      if (participants.length === 1) participants.push({ id: 'non-qualifier', name: '비진출자', division: '1' });
      const option = {
        blocks: [
          { type: 'SINGLES', title: '예선', format: 'GROUP', groupSizes: Array(groupCount).fill(rankCount) },
          { type: 'SINGLES', title: '2라운드 본선', format: 'TOURNAMENT', roundOption: 'FINAL', sourceRoundId: 1,
            finalAdvancementMode: 'all', tournamentSeeding: 'seed', tournamentMode, tournamentBracketCount: 1 },
        ],
        roundStandings: [{ round: 1, complete: true, pools: groups.map((group, index) => ({
          label: `${index + 1}조`, complete: true, participantIds: group.map(unit => unit.id),
        })) }],
      };
      const before = JSON.stringify(option);
      const matches = generateProgramRoundMatches('fixture', option, participants, 2);
      const firstRound = matches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
        .sort((a, b) => a.match_order - b.match_order);
      const actual = firstRound.flatMap(match => [match.participant_a_id ?? 'BYE', match.participant_b_id ?? 'BYE']);
      const ids = new Set(groups.flat().map(unit => unit.id));
      const safeExpected = expected.length ? expected.map(label => ids.has(label) ? label : 'BYE') : ['1-1', 'BYE'];
      assert.deepEqual(actual, safeExpected);
      assert.equal(new Set(matches.map(match => match.id)).size, matches.length);
      assert.equal(JSON.stringify(option), before);
      assert.deepEqual(generateProgramRoundMatches('fixture', option, participants, 2), matches);
      const previewOption = { ...option, roundStandings: undefined };
      const previewMatches = generateProgramRoundMatches('fixture', previewOption, participants, 2);
      const preview = previewMatches.filter(match => match.round_number === 1 && match.bracket !== 'lower')
        .sort((a, b) => a.match_order - b.match_order)
        .flatMap(match => [match.participant_a_seed_label ?? 'BYE', match.participant_b_seed_label ?? 'BYE']);
      assert.deepEqual(preview, safeExpected, '예선 미완료 가상 순위도 같은 슬롯을 사용한다');
    });
  }
}

const configurations = [];
for (const count of [3, 4]) {
  // 아이핑 지원 범위 안에서는 공식 규정 추정 조건보다 원본 슬롯 일치가 기준이다.
  // 지원 범위 밖과 조별 인원이 다른 입력은 기존 일반 분산 정책을 계속 검사한다.
  for (const rankCount of [16, 17, 21, 22, 32, 43, 64, 65, 85]) {
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

const swapFixture = () => [
  { id: 'bye-a', bracket: 'upper', status: 'done', participant_a_id: 'a', participant_a_name: 'A', participant_a_seed_label: '2-3', participant_b_id: null, participant_b_name: null, score_a: 0, score_b: 0, next_match_id: 'next', next_slot: 'a', round_number: 1 },
  { id: 'bye-b', bracket: 'upper', status: 'done', participant_a_id: null, participant_a_name: null, participant_b_id: 'b', participant_b_name: 'B', participant_b_seed_label: '1-3', score_a: 0, score_b: 0, next_match_id: 'next', next_slot: 'b', round_number: 1 },
  { id: 'next', bracket: 'upper', status: 'pending', participant_a_id: 'a', participant_a_name: 'A', participant_a_seed_label: '2-3', participant_b_id: 'b', participant_b_name: 'B', participant_b_seed_label: '1-3', score_a: 0, score_b: 0, round_number: 2 },
];
test('선수 교환: BYE 슬롯 교환을 다음 경기에도 반영하고 입력 객체는 보존한다', () => {
  const original = swapFixture();
  const before = JSON.stringify(original);
  const result = swapProgramTournamentSlots(original, { matchId: 'bye-a', slot: 'a' }, { matchId: 'bye-b', slot: 'b' });
  assert.deepEqual(result.map(match => [match.participant_a_id, match.participant_b_id]), [['b', null], [null, 'a'], ['b', 'a']]);
  assert.equal(result[2].participant_a_seed_label, '1-3');
  assert.equal(JSON.stringify(original), before);
});
test('선수 교환: 부전승 다음 경기에서 클릭해도 원래 BYE와 함께 교환된다', () => {
  const result = swapProgramTournamentSlots(swapFixture(), { matchId: 'next', slot: 'a' }, { matchId: 'next', slot: 'b' });
  assert.deepEqual(result.map(match => [match.participant_a_id, match.participant_b_id]), [['b', null], [null, 'a'], ['b', 'a']]);
});
test('선수 교환: 뒤 경기의 실제 결과를 손상시키는 교환은 전체 거부한다', () => {
  const original = swapFixture();
  Object.assign(original[2], { status: 'done', score_a: 3, score_b: 1 });
  const before = JSON.stringify(original);
  assert.throws(() => swapProgramTournamentSlots(original, { matchId: 'bye-a', slot: 'a' }, { matchId: 'bye-b', slot: 'b' }), /결과가 입력/);
  assert.equal(JSON.stringify(original), before);
});
test('선수 교환: 같은 선수의 BYE 전후 슬롯은 교환 대상이 아니다', () => {
  assert.throws(() => swapProgramTournamentSlots(swapFixture(), { matchId: 'bye-a', slot: 'a' }, { matchId: 'next', slot: 'a' }), /같은 선수/);
});
test('선수 교환: 미정 슬롯 복사는 원본 선수를 삭제하지 않는다', () => {
  const original = swapFixture();
  original.push({ id: 'empty', bracket: 'lower', status: 'pending', participant_a_id: null, participant_b_id: null, score_a: null, score_b: null });
  const result = swapProgramTournamentSlots(original, { matchId: 'bye-a', slot: 'a' }, { matchId: 'empty', slot: 'a' });
  assert.equal(result[0].participant_a_id, 'a');
  assert.equal(result[3].participant_a_id, 'a');
  assert.equal(result[3].status, 'pending');
});

test('선수 교환: 여러 BYE 라운드를 거슬러 교환해도 모든 진출 슬롯이 일치한다', () => {
  const original = swapFixture();
  original[0].next_match_id = 'middle';
  original.push({ ...original[0], id: 'middle', round_number: 2, next_match_id: 'next', next_slot: 'a' });
  original[2].round_number = 3;
  const result = swapProgramTournamentSlots(original, { matchId: 'next', slot: 'a' }, { matchId: 'next', slot: 'b' });
  assert.equal(result[0].participant_a_id, 'b');
  assert.equal(result[3].participant_a_id, 'b');
  assert.equal(result[2].participant_a_id, 'b');
  assert.equal(result[2].participant_b_id, 'a');
});
