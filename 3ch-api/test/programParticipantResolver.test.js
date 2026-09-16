const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProgramParticipantId } = require('../src/utils/programParticipantResolver');

test('순위별 본선은 현재 시드 라벨을 예선 순위 스냅샷의 참가자로 복원한다', () => {
  const programData = {
    blocks: [
      { format: 'GROUP' },
      { format: 'GROUP', finalAdvancementMode: 'rank-groups', sourceRoundId: 1 },
    ],
    roundStandings: [{
      round: 1,
      complete: true,
      pools: [
        { label: '2조', participantIds: ['group-2-first', 'group-2-second'] },
        { label: '1조', participantIds: ['group-1-first', 'group-1-second'] },
      ],
    }],
  };

  assert.equal(resolveProgramParticipantId(programData, 2, '1-1'), 'group-1-first');
  assert.equal(resolveProgramParticipantId(programData, 2, '2-2'), 'group-2-second');
});

test('순위별 본선이 아니거나 시드 라벨이 없으면 저장된 참가자 ID를 사용하도록 null을 반환한다', () => {
  assert.equal(resolveProgramParticipantId({ blocks: [{ format: 'GROUP' }] }, 1, '1-1'), null);
  assert.equal(resolveProgramParticipantId({ blocks: [{}, { finalAdvancementMode: 'rank-groups' }] }, 2, null), null);
});
