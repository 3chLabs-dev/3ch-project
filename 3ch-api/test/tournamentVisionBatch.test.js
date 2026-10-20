const test=require('node:test'),assert=require('node:assert/strict');
const pool=require('../src/db/pool'),router=require('../src/routes/tournamentExtras');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function invoke({stale=false,owner=true,missing=false,fail=false,reset=false}={}){
 const original=pool.connect,commands=[];
 const saved=[1,2,3].map(n=>({id:uuid(n),score_a:n===3?3:null,score_b:n===3?1:null,status:n===3?'completed':'pending',court:null,match_order:n,participant_a_id:'a',participant_b_id:'b'}));let working;
 pool.connect=async()=>({async query(sql,values){commands.push(sql);if(sql==='BEGIN'){working=structuredClone(saved);return {};};if(sql==='ROLLBACK')return {};if(sql==='COMMIT'){saved.splice(0,saved.length,...working);return {};}
 if(sql.includes('FOR UPDATE OF d')||sql.startsWith('SELECT id FROM tournament_divisions'))return {rowCount:1,rows:[]};
 if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:owner?1:2,status:'open'}]};if(sql.includes('FROM subscriptions'))return {rowCount:1};if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
 if(sql.startsWith('SELECT m.*'))return {rows:working.filter(m=>(reset?[uuid(3)]:[uuid(1),uuid(2)]).includes(m.id)).slice(0,missing?1:3)};
 if(sql.startsWith('UPDATE tournament_matches')){if(fail&&values[3]===uuid(2))throw Error('injected batch failure');const m=working.find(m=>m.id===values[3]);[m.score_a,m.score_b,m.status]=values;return {};}
 throw Error(sql);},release(){}});
 const matches=(reset?[saved[2]]:saved.slice(0,2)).map((m,i)=>({match_id:m.id,score_a:2,score_b:1,status:reset?'playing':'done',expected:{score_a:stale&&i===1?0:m.score_a,score_b:m.score_b,status:m.status,court:null}}));
 const result={status:200},h=router.stack.find(l=>l.route?.path==='/tournaments/:id/divisions/:divisionId/rounds/:roundNo/matches/batch-results').route.stack.at(-1).handle;
 try{await h({params:{id:uuid(5),divisionId:uuid(6),roundNo:'1'},user:{sub:'1'},body:{matches}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,saved,commands};}finally{pool.connect=original;}
}
test('photo batch commits selected results atomically and preserves omitted completed scores and ordering',async()=>{const r=await invoke();assert.equal(r.result.body.updated,2);assert.equal(r.saved[0].status,'completed');assert.equal(r.saved[2].score_a,3);assert.equal(r.saved[2].match_order,3);assert.ok(!r.commands.some(s=>s.startsWith('DELETE')));});
test('stale result, wrong scope, non-manager and completed reset reject the whole batch',async()=>{for(const opts of [{stale:true},{missing:true},{owner:false},{reset:true}]){const r=await invoke(opts);assert.ok(r.result.status>=400);assert.equal(r.saved[0].score_a,null);assert.equal(r.saved[2].status,'completed');assert.equal(r.saved[2].score_a,3);assert.ok(!r.commands.some(s=>s.startsWith('UPDATE')));}});
test('failure after first update rolls back every score',async()=>{const r=await invoke({fail:true});assert.equal(r.result.status,500);assert.equal(r.saved[0].score_a,null);assert.equal(r.commands.at(-1),'ROLLBACK');});
