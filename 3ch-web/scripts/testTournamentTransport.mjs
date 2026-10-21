import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const source=await readFile(new URL('../src/features/tournament/leagueTransport.ts',import.meta.url),'utf8');
const {code}=await transform(source,{loader:'ts',format:'esm'});
const {tournamentLeagueRequest:request}=await import(`data:text/javascript;base64,${Buffer.from(code+'\n//# sourceURL=tournament-transport-under-test.mjs').toString('base64')}`);
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope=n=>`tournament~${uuid(100)}~${uuid(n)}`;
const win={confirm:()=>true,location:{search:'?round=1'}};
globalThis.window=win;

test('program saves keep the editor revision even after a newer background read',async()=>{
 const key=scope(1),url=`/league/${key}/program`;
 let revision='old';const writes=[];
 const execute=async input=>{
   if(typeof input==='string'||!input.method)return {data:{program:{updated_at:revision,program_data:{blocks:[{}],tournament_revision:revision}}}};
   writes.push(input);return {error:{status:409}};
 };
 await request(url,execute,()=>{});revision='new';await request(url,execute,()=>{});
 await request({url,method:'PUT',body:{program_data:{blocks:[{}],tournament_revision:'old'}}},execute,()=>{});
 assert.equal(writes[0].body.expected_updated_at,'old');
});

test('concurrent score writes serialize against persisted responses and never send client slot propagation',async()=>{
 const key=scope(2),id=uuid(20);let saved={id,score_a:0,score_b:0,status:'playing',court:null,participant_a_id:uuid(30)};
 const expected=[];let invalidated=0;
 const execute=async input=>{
   if(typeof input==='string'||!input.method)return {data:{matches:[saved]}};
   await Promise.resolve();expected.push(input.body.expected.score_a);
   assert.equal(input.body.expected.score_a,saved.score_a);assert.equal(input.body.updates.participant_a_id,undefined);
   saved={...saved,...input.body.updates};return {data:{match:saved}};
 };
 await request(`/league/${key}/matches`,execute,()=>{});
 const edit=score=>request({url:`/league/${key}/matches/${id}`,method:'PATCH',body:{score_a:score,participant_a_id:uuid(99)}},execute,()=>invalidated++);
 await Promise.all([edit(1),edit(2)]);assert.deepEqual(expected,[0,1]);assert.equal(saved.score_a,2);assert.equal(saved.participant_a_id,uuid(30));assert.equal(invalidated,2);
});

test('cancelled program deletion never reaches the server',async()=>{
 win.confirm=()=>false;let calls=0;
 try {const result=await request({url:`/league/${scope(3)}/program`,method:'DELETE'},async()=>{calls++;return {data:{ok:true}}},()=>{});assert.ok(result.error);assert.equal(calls,0);}
 finally {win.confirm=()=>true;}
});

test('confirmed reset uses only the dedicated reset endpoint, without regenerating from stale client matches',async()=>{
 const writes=[];let invalidated=0;
 const result=await request({url:`/league/${scope(4)}/program/matches/sync`,method:'POST',body:{reset_results:true,matches:[{id:'stale',score_a:99}]}},async input=>{writes.push(input);return {data:{ok:true,inserted:0}}},()=>invalidated++);
 assert.equal(writes.length,1);assert.ok(writes[0].url.endsWith('/reset'));assert.deepEqual(writes[0].body,{confirmation_intent:'RESET_TOURNAMENT_RESULTS'});assert.equal(invalidated,1);assert.equal(result.data.ok,true);
});

test('photo-result batches cannot mix different rounds',async()=>{
 const key=scope(5),a=uuid(51),b=uuid(52);let writes=0;
 await request(`/league/${key}/matches`,async()=>({data:{matches:[{id:a,program_round:1},{id:b,program_round:2}]}}),()=>{});
 const result=await request({url:`/league/${key}/matches/batch-results`,method:'PATCH',body:{matches:[{match_id:a,score_a:2},{match_id:b,score_a:2}]}},async()=>{writes++;return {data:{updated:2}}},()=>{});
 assert.ok(result.error);assert.equal(writes,0);
});
