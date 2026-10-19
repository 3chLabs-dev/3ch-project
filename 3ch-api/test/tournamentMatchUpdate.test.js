const test=require('node:test'); const assert=require('node:assert/strict');
const pool=require('../src/db/pool');const router=require('../src/routes/tournamentExtras');
const id='3cd5278f-c2b0-416b-b543-2074e3f1601c';
async function invoke({owner=true,status='playing',stale=false,updates={score_a:2},fail=false}={}){
 const original=pool.connect;const commands=[];const persisted={id,score_a:1,score_b:0,status,court:null,participant_a_id:'a',participant_b_id:'b',match_order:7};let working;
 pool.connect=async()=>({async query(sql,values){commands.push(sql);if(sql==='BEGIN'){working=structuredClone(persisted);return {};}
 if(sql==='ROLLBACK')return {};if(sql==='COMMIT'){Object.assign(persisted,working);return {};}
 if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:owner?1:2,status:'open'}]};
 if(sql.includes('FROM subscriptions'))return {rowCount:1};if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
 if(sql.includes('SELECT m.*'))return {rows:[working]};
 if(sql.startsWith('UPDATE tournament_matches')){if(fail)throw Error('injected');[working.score_a,working.score_b,working.status,working.court]=values;return {rows:[working]};}
 throw Error(sql);},release(){}});
 const result={};const h=router.stack.find(l=>l.route?.path==='/tournaments/:id/matches/:matchId').route.stack.at(-1).handle;
 try{await h({params:{id,matchId:id},user:{sub:'1'},body:{expected:{score_a:stale?0:1,score_b:0,status,court:null},updates}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,persisted,commands};}finally{pool.connect=original;}
}
test('tournament score writes preserve participants, ordering and unrelated state',async()=>{const r=await invoke();assert.equal(r.result.body.match.score_a,2);assert.equal(r.persisted.match_order,7);assert.equal(r.persisted.participant_a_id,'a');assert.ok(r.commands.includes('COMMIT'));});
test('stale writes, non-managers and resets of completed matches cannot overwrite results',async()=>{for(const options of [{stale:true},{owner:false},{status:'completed',updates:{status:'playing'}},{status:'completed',updates:{status:'pending'}},{updates:{participant_a_id:'replacement'}}]){const r=await invoke(options);assert.ok(r.result.status>=400);assert.equal(r.persisted.score_a,1);assert.ok(!r.commands.some(s=>s.startsWith('UPDATE')));}});
test('failed score writes roll back; explicit completion stores persisted scores',async()=>{const bad=await invoke({fail:true});assert.equal(bad.result.status,500);assert.equal(bad.persisted.score_a,1);assert.ok(bad.commands.includes('ROLLBACK'));const done=await invoke({updates:{status:'completed',score_a:2,score_b:1}});assert.equal(done.persisted.status,'completed');assert.equal(done.persisted.score_a,2);});
