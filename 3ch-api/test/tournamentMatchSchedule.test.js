const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPoolMatchSchedule } = require('../src/services/tournamentMatchSchedule');
const pool = require('../src/db/pool');
const router = require('../src/routes/tournamentExtras');
const id = '6f40f553-e218-4679-a654-f8b635d28060';
const assignments = [1,2,3,4,5].map((n) => ({pool_id:'p', pool_no:1,participant_id:String(n)}));
test('saved pool slots yield every pair exactly once without mutating assignments', () => {
  const before=structuredClone(assignments); const schedule=buildPoolMatchSchedule(assignments);
  assert.equal(schedule.length,10); assert.equal(new Set(schedule.map(m=>[m.a,m.b].sort().join(':'))).size,10);
  assert.deepEqual(assignments,before); assert.throws(()=>buildPoolMatchSchedule([...assignments,assignments[0]]));
});
async function invoke(existing=false, fail=false) {
 const original=pool.connect; const commands=[]; const persisted=[{id:'completed',score_a:3,score_b:1,status:'completed',match_order:8}]; let staged=[];
 pool.connect=async()=>({async query(sql, values) {
  commands.push(sql);
  if(sql==='BEGIN'||sql==='ROLLBACK')return {};
  if(sql==='COMMIT'){persisted.push(...staged);return {};}
  if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:1,status:'open'}]};
  if(sql.includes('FROM subscriptions'))return {rowCount:1};
  if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
  if(sql.includes('SELECT id FROM tournaments'))return {rows:[{id}]};
  if(sql.includes('SELECT r.*'))return {rows:[{round_no:1,league_type:'SINGLES',format:'GROUP'}]};
  if(sql.includes('SELECT id FROM tournament_matches'))return {rowCount:existing?1:0,rows:existing?persisted:[]};
  if(sql.includes('SELECT po.id'))return {rows:assignments};
  if(sql.startsWith('INSERT INTO tournament_matches')){if(fail&&staged.length===2)throw Error('injected');staged.push({a:values[3],b:values[4]});return {};}
  throw Error(sql);
 },release(){}});
 const result={};const handle=router.stack.find(l=>l.route?.path==='/tournaments/:id/divisions/:divisionId/matches/generate').route.stack.at(-1).handle;
 try{await handle({params:{id,divisionId:id},user:{sub:'1'}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,commands,persisted};}finally{pool.connect=original;}
}
test('existing matches including completed results block regeneration unchanged',async()=>{const {result,commands,persisted}=await invoke(true);assert.equal(result.status,409);assert.equal(persisted.length,1);assert.equal(persisted[0].score_a,3);assert.ok(commands.includes('ROLLBACK'));assert.ok(!commands.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));});
test('creation appends only, failed inserts roll back atomically',async()=>{const ok=await invoke();assert.equal(ok.result.status,201);assert.equal(ok.persisted.length,11);assert.equal(ok.persisted[0].score_a,3);const failed=await invoke(false,true);assert.equal(failed.result.status,500);assert.equal(failed.persisted.length,1);assert.ok(failed.commands.includes('ROLLBACK'));assert.ok(!failed.commands.includes('COMMIT'));});

const groupingRouter = require('../src/routes/tournament');
async function confirmGroups({existing=false,fail=false}={}) {
 const original=pool.connect; const commands=[]; const people=[1,2,3,4].map(n=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,name:String(n),member_division:'4',source_group_id:null}));
 let inserted=0; let committed=false;
 pool.connect=async()=>({async query(sql){
  commands.push(sql);
  if(sql==='BEGIN'||sql==='ROLLBACK')return {};
  if(sql==='COMMIT'){committed=true;return {};}
  if(sql.includes('SELECT * FROM tournaments'))return {rowCount:1,rows:[{host_group_id:id}]};
  if(sql.includes('SELECT d.*'))return {rowCount:1,rows:[{id,format:'GROUP',league_type:'SINGLES',status:'open'}]};
  if(sql.includes('FROM subscriptions'))return {rowCount:1};
  if(sql.includes('SELECT role, management_permissions'))return {rows:[{role:'owner'}]};
  if(sql.includes('SELECT 1 FROM tournament_pools')||sql.includes('SELECT 1 FROM tournament_matches'))return {rowCount:existing?1:0};
  if(sql.includes("status = 'applied'"))return {rowCount:0};
  if(sql.includes("status = 'confirmed'"))return {rowCount:4,rows:people};
  if(sql.startsWith('INSERT INTO tournament_pools'))return {rows:[{id:'pool'}]};
  if(sql.startsWith('INSERT INTO tournament_pool_members')||sql.startsWith('UPDATE tournament_divisions'))return {};
  if(sql.startsWith('INSERT INTO tournament_matches')){inserted++;if(fail&&inserted===2)throw Error('injected match failure');return {};}
  throw Error(sql);
 },release(){}});
 const result={};const handler=groupingRouter.stack.find(l=>l.route?.path==='/tournaments/:id/divisions/:divisionId/pools/generate').route.stack.at(-1).handle;
 try{await handler({params:{id,divisionId:id},user:{sub:'1'},body:{group_count:1,participant_ids:people.map(p=>p.id)}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,commands,inserted,committed};}finally{pool.connect=original;}
}
test('confirming groups also saves all matches in the same transaction',async()=>{const r=await confirmGroups();assert.equal(r.result.status,201);assert.equal(r.result.body.match_count,6);assert.equal(r.inserted,6);assert.ok(r.committed);});
test('existing competition is preserved; match failure rolls back group confirmation too',async()=>{const existing=await confirmGroups({existing:true});assert.equal(existing.result.status,409);assert.equal(existing.inserted,0);assert.ok(!existing.committed);const failure=await confirmGroups({fail:true});assert.equal(failure.result.status,500);assert.ok(!failure.committed);assert.equal(failure.commands.at(-1),'ROLLBACK');});
