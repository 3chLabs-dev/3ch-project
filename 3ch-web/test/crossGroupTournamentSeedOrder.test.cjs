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
