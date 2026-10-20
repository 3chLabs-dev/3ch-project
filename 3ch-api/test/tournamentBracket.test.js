const test=require('node:test'),assert=require('node:assert/strict');
const {buildKnockoutBracket,projectBracketAdvancement,seedParticipants}=require('../src/services/tournamentBracket');
const players=n=>Array.from({length:n},(_,i)=>({id:String(i+1),source_group_id:i<2?'same-club':`club-${i}`}));
const build=(n,mode='single')=>{let id=0;return buildKnockoutBracket(players(n),{divisionId:'division',roundNo:2,mode,makeId:()=>`match-${++id}`});};
test('knockout stores every winner/loser edge and handles byes without invented scores',()=>{
 for(const n of [2,3,5,6,8,17]){
  const rows=build(n);assert.equal(rows.length,2**Math.ceil(Math.log2(n))-1);
  assert.ok(rows.filter(m=>m.is_bye).every(m=>m.status==='completed'&&m.score_a===null&&m.score_b===null));
  const initial=rows.filter(m=>m.round_no===1).flatMap(m=>[m.participant_a_id,m.participant_b_id]).filter(Boolean);assert.equal(new Set(initial).size,n);
  let current=rows;
  for(let i=0;i<rows.length;i++){
   const pending=current.find(m=>m.status==='pending'&&m.participant_a_id&&m.participant_b_id);if(!pending)break;
   pending.score_a=2;pending.score_b=0;pending.status='completed';current=projectBracketAdvancement(current);
  }
  assert.ok(current.every(m=>m.status==='completed'));const final=current.find(m=>!m.next_match_id);assert.ok(final.participant_a_id&&final.participant_b_id);
 }
});
test('upper/lower puts first-round losers in lower bracket and resolves all rounds',()=>{
 let current=build(6,'upper-lower');assert.ok(current.some(m=>m.bracket==='lower'));
 for(let i=0;i<current.length;i++){
  const m=current.find(m=>m.status==='pending'&&m.participant_a_id&&m.participant_b_id);if(!m)break;m.score_a=2;m.score_b=0;m.status='completed';current=projectBracketAdvancement(current);
 }
 assert.ok(current.every(m=>m.status==='completed'));assert.equal(current.filter(m=>!m.next_match_id).length,2);
});
test('same-club seeds meet late and participants are not mutated',()=>{const people=players(8),before=structuredClone(people);const slots=seedParticipants(people);const a=slots.findIndex(p=>p?.id==='1'),b=slots.findIndex(p=>p?.id==='2');assert.equal(Math.floor(Math.log2(a^b))+1,3);assert.deepEqual(people,before);});
test('manual assignments and started/completed downstream results cannot be replaced',()=>{
 const rows=build(4),source=rows.find(m=>m.round_no===1),target=rows.find(m=>m.id===source.next_match_id);
 source.status='completed';source.score_a=2;source.score_b=0;target[`participant_${source.next_slot}_id`]='manually-assigned';
 const before=structuredClone(rows);assert.throws(()=>projectBracketAdvancement(rows),/이미 저장/);assert.deepEqual(rows,before);
 target[`participant_${source.next_slot}_id`]=null;target.status='playing';target.score_a=0;target.score_b=0;assert.throws(()=>projectBracketAdvancement(rows),/이미 저장/);
});
test('same winner preserves downstream scores; winner changes fail without resets',()=>{
 let rows=build(4);for(const m of rows.filter(m=>m.round_no===1)){m.status='completed';m.score_a=2;m.score_b=0;}rows=projectBracketAdvancement(rows);
 const final=rows.find(m=>!m.next_match_id);final.status='completed';final.score_a=2;final.score_b=1;const before=structuredClone(rows);
 assert.deepEqual(projectBracketAdvancement(rows),before);const source=rows.find(m=>m.round_no===1);source.score_a=0;source.score_b=2;assert.throws(()=>projectBracketAdvancement(rows),/진출자를 변경/);
});
test('cycles, cross-division links and duplicate feeder slots fail safely',()=>{
 const rows=build(4);rows[0].next_match_id=rows[0].id;assert.throws(()=>projectBracketAdvancement(rows));
 const other=build(4);other[2].division_id='other';assert.throws(()=>projectBracketAdvancement(other));
 const duplicate=build(4);duplicate[1].next_slot=duplicate[0].next_slot;assert.throws(()=>projectBracketAdvancement(duplicate));
});
