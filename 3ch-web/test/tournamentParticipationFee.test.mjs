import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTournamentFee } from '../src/features/tournament/participationFee.ts';

test('부문별 라운드 수가 다른 클럽 참가비를 합산한다', () => {
  const participants = [{ division_id: 'a' }, { division_id: 'a' }, { division_id: 'b' }];
  const divisions = [{ id: 'a', rounds: [1, 2] }, { id: 'b', rounds: [1, 2, 3] }];
  assert.deepEqual(calculateTournamentFee(participants, divisions, 10000), { roundCount: 7, amount: 70000 });
});
test('미설정 참가비와 무료 참가비를 구별한다', () => {
  const participants = [{ division_id: 'a' }];
  const divisions = [{ id: 'a', rounds: [1] }];
  assert.equal(calculateTournamentFee(participants, divisions, null).amount, null);
  assert.equal(calculateTournamentFee(participants, divisions, 0).amount, 0);
  assert.deepEqual(calculateTournamentFee([], divisions, 10000), { roundCount: 0, amount: 0 });
});
