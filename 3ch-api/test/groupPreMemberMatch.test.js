const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findUniqueExactPreMember } = require('../src/utils/groupPreMemberMatch');

test('one exact name is eligible regardless of division', () => {
  const member = { id: 'one', name: '조행복', division: '5', claim_status: null };
  assert.equal(findUniqueExactPreMember('조행복', [member]), member);
});

test('suffix or partial names never auto-claim', () => {
  assert.equal(findUniqueExactPreMember('조행복', [{ name: '조행복A' }, { name: '조행복B' }]), null);
  assert.equal(findUniqueExactPreMember('행복', [{ name: '조행복' }]), null);
});

test('duplicate exact names and pending claims require manual handling', () => {
  assert.equal(findUniqueExactPreMember('조행복', [{ name: '조행복' }, { name: '조행복' }]), null);
  assert.equal(findUniqueExactPreMember('조행복', [{ name: '조행복', claim_status: 'pending' }]), null);
});
