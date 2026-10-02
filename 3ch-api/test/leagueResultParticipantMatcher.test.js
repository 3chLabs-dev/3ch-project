const test = require('node:test');
const assert = require('node:assert/strict');
const { matchResultParticipant } = require('../src/services/leagueResultParticipantMatcher');

const participant = { name: '조현진', division: '', member_id: null, needsReview: false };
const preMember = { name: '조현진', division: '8', pre_member_id: 'pre-1', group_id: 'club-1' };

test('사전등록 회원의 정식 이름과 부수 및 클럽을 인식 결과에 연결한다', () => {
  const result = matchResultParticipant({ ...participant, name: '조 현진' }, [preMember]);
  assert.equal(result.name, '조현진');
  assert.equal(result.division, '8');
  assert.equal(result.pre_member_id, 'pre-1');
  assert.equal(result.source_group_id, 'club-1');
  assert.equal(result.member_id, null);
});

test('실제 회원도 연결하며 이미 입력된 부수는 보존한다', () => {
  const result = matchResultParticipant({ ...participant, division: '7' }, [{ ...preMember, member_id: 12, pre_member_id: null }]);
  assert.equal(result.member_id, 12);
  assert.equal(result.division, '7');
});

test('동명이인이나 계정 회원과 사전등록 이름 중복은 자동 연결하지 않는다', () => {
  const result = matchResultParticipant(participant, [preMember, { ...preMember, member_id: 12, pre_member_id: null }]);
  assert.equal(result.member_id, null);
  assert.equal(result.pre_member_id, undefined);
  assert.equal(result.division, '');
  assert.equal(result.needsReview, true);
});

test('다른 클럽의 동명이인을 임의 선택하지 않는다', () => {
  const result = matchResultParticipant(participant, [preMember, { ...preMember, group_id: 'club-2' }]);
  assert.equal(result.needsReview, true);
  assert.equal(result.source_group_id, undefined);
});

test('매칭되지 않는 이름과 기존 후보 데이터는 변경하지 않는다', () => {
  const result = matchResultParticipant({ ...participant, name: '태현우' }, [preMember]);
  assert.equal(result.division, '');
  assert.deepEqual(preMember, { name: '조현진', division: '8', pre_member_id: 'pre-1', group_id: 'club-1' });
});
