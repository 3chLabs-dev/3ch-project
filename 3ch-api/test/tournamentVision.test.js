const test=require('node:test'),assert=require('node:assert/strict');
const pool=require('../src/db/pool');
const scanner=require('../src/services/openaiVisionScanner');
const usage=require('../src/services/featureUsageService');
let scanCalls=0,credits=[],refunds=[],scanFails=false;
scanner.scanLeagueSheetWithOpenAIVision=async(options)=>{scanCalls++;if(scanFails)throw Error('injected scan failure');return {engine:'test',result:{cells:[{rowPlayerName:'A',columnPlayerName:'B',rowIndex:0,columnIndex:1,score:2,confidence:1,needsReview:false},{rowPlayerName:'B',columnPlayerName:'A',rowIndex:1,columnIndex:0,score:1,confidence:1,needsReview:false}]}};};
usage.consumeFeatureCredit=async(args)=>{credits.push(args);return {allowed:true,remaining:2};};
usage.refundFeatureCredit=async(args)=>{refunds.push(args);};
const router=require('../src/routes/league');
const id='3cd5278f-c2b0-416b-b543-2074e3f1601c';
async function scan({tournament=true,owner=true,badOrder=false,missingRound=false,failure=false,linked=false,noMatches=false,legacy=false,composite=false}={}){
 const original=pool.query,commands=[];scanCalls=0;credits=[];refunds=[];scanFails=failure;
 pool.query=async(sql)=>{commands.push(sql);
 if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:99,role:owner?'owner':null,status:'open'}]};
 if(sql.includes('FROM subscriptions'))throw Error('must not check premium');
 if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
 if(sql.includes('SELECT r.id'))return {rowCount:missingRound?0:1,rows:[{rules:linked?{entry_config:{source_division_ids:[id,'11111111-1111-4111-8111-111111111111']}}:{}}]};
 if(sql.includes('FROM leagues l'))return {rowCount:1,rows:[{billing_owner_id:1,join_permission:'public'}]};
 if(sql.includes('FROM tournament_participants')||sql.includes('FROM league_participants'))return {rows:[{id:'a',name:'A',member_division:'3',division:'3'},{id:'b',name:'B',member_division:'4',division:'4'}]};
 if(sql.includes('FROM tournament_matches')||sql.includes('FROM league_matches')){
  if(legacy)assert.match(sql,/COALESCE\(m.program_round,1\)=\$2/);
  return {rows:noMatches?[]:[{id:'match',participant_a_id:'a',participant_b_id:'b',status:'completed',score_a:2,score_b:1,program_round:legacy?null:1,league_data:composite?{participant_a_id:'b+a',participant_b_id:'b',participant_a_roster_ids:['b','a'],participant_b_roster_ids:['b']}:{}}]};
 }
 throw Error(sql);};
 const path='/tournaments/:id/divisions/:divisionId/rounds/:roundNo/openai-vision/scan';
 const h=router.stack.find(l=>Array.isArray(l.route?.path)&&l.route.path.includes(path)).route.stack.at(-1).handle;
 const result={status:200};
 try{await h({params:{id,...(tournament?{divisionId:id,roundNo:'1'}:{})},user:{sub:'1'},get(){return 'request'},body:{mode:'star-grid',participant_ids:JSON.stringify(badOrder?['a','foreign']:composite?['a+b','b']:['a','b'])},file:{mimetype:'image/png',buffer:Buffer.from('fixture')}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,commands,scanCalls,credits:[...credits],refunds:[...refunds]};}finally{pool.query=original;}
}
test('same league scanner maps tournament cells to persisted matches and bills requesting nonpremium host leader',async()=>{const r=await scan();assert.equal(r.result.status,200);assert.equal(r.result.body.cells.length,2);assert.equal(r.result.body.cells[0].matchId,'match');assert.equal(r.credits[0].referenceType,'TOURNAMENT');assert.equal(r.credits[0].userId,1);assert.ok(!r.commands.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));assert.ok(!r.commands.some(s=>s.includes('FROM league_matches')));});
test('permission, round and participant scope errors never invoke OCR or consume credits',async()=>{for(const args of [{owner:false},{missingRound:true},{badOrder:true}]){const r=await scan(args);assert.ok(r.result.status>=400);assert.equal(r.scanCalls,0);assert.equal(r.credits.length,0);}});
test('failed tournament recognition refunds credit and existing league recognition stays on league path',async()=>{const failed=await scan({failure:true});assert.equal(failed.refunds.length,1);const league=await scan({tournament:false});assert.equal(league.result.status,200);assert.equal(league.credits[0].referenceType,'LEAGUE');assert.ok(league.commands.some(s=>s.includes('FROM league_matches')));});

test('legacy first-round singles remain readable alongside later program rounds',async()=>{
 const r=await scan({legacy:true});assert.equal(r.result.status,200);assert.equal(r.result.body.cells[0].matchId,'match');
 assert.ok(!r.commands.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));
});

test('linked entry participants are read from allowed source divisions within the same tournament',async()=>{
 const r=await scan({linked:true});assert.equal(r.result.status,200);
 const query=r.commands.find(s=>s.startsWith('SELECT p.id,p.name,p.member_division'));
 assert.match(query,/ANY\(\$1::uuid\[\]\)/);assert.match(query,/d.tournament_id=\$2/);
});

test('composite rosters use the same canonical mapping as the tournament bracket',async()=>{
 const r=await scan({composite:true});assert.equal(r.result.status,200);assert.equal(r.result.body.cells[0].matchId,'match');
});

test('missing matches give a neutral error without regeneration, OCR or billing',async()=>{
 const r=await scan({noMatches:true});assert.equal(r.result.status,409);assert.equal(r.result.body.code,'VISION_MATCH_SCOPE_MISMATCH');
 assert.doesNotMatch(r.result.body.message,/복식|다시 생성/);assert.equal(r.scanCalls,0);assert.equal(r.credits.length,0);
 assert.ok(!r.commands.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));
});

test('PostgreSQL: multi-round legacy singles are recognized without altering persisted results', {skip:!process.env.TOURNAMENT_PGLITE_MODULE,timeout:90000}, async()=>{
 const {PGlite}=require(process.env.TOURNAMENT_PGLITE_MODULE),db=new PGlite(),original=pool.query;
 const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const division=uuid(10),a=uuid(1),b=uuid(2),matchId=uuid(20);
 try {
  await db.exec(`CREATE TABLE tournament_divisions(id uuid PRIMARY KEY,tournament_id uuid,rules jsonb,league_program jsonb);
   CREATE TABLE tournament_division_rounds(id uuid,division_id uuid,round_no int);
   CREATE TABLE tournament_participants(id uuid,division_id uuid,name text,member_division text,created_at timestamptz DEFAULT now());
   CREATE TABLE tournament_matches(id uuid,division_id uuid,program_round int,participant_a_id uuid,participant_b_id uuid,status text,score_a int,score_b int,league_data jsonb);`);
  await db.query('INSERT INTO tournament_divisions VALUES ($1,$2,$3,NULL)',[division,id,'{}']);
  for(const n of [1,2])await db.query('INSERT INTO tournament_division_rounds VALUES ($1,$2,$3)',[uuid(30+n),division,n]);
  for(const [person,name]of [[a,'A'],[b,'B']])await db.query('INSERT INTO tournament_participants(id,division_id,name,member_division) VALUES ($1,$2,$3,$4)',[person,division,name,'7']);
  await db.query("INSERT INTO tournament_matches VALUES ($1,$2,NULL,$3,$4,'completed',2,1,'{}')",[matchId,division,a,b]);
  await db.query("INSERT INTO tournament_matches VALUES ($1,$2,2,$3,$4,'pending',NULL,NULL,'{}')",[uuid(21),division,a,b]);
  const snapshot=async()=>JSON.stringify((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows);
  const before=await snapshot(),commands=[];
  pool.query=async(sql,params)=>{
   commands.push(sql);
   if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:1,status:'open'}]};
   if(sql.includes('FROM subscriptions'))return {rowCount:1};
   if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
   const result=await db.query(sql,params);return {...result,rowCount:result.rows.length};
  };
  scanFails=false;credits=[];refunds=[];
  const h=router.stack.find(l=>Array.isArray(l.route?.path)&&l.route.path.includes('/tournaments/:id/divisions/:divisionId/rounds/:roundNo/openai-vision/scan')).route.stack.at(-1).handle;
  const result={status:200};
  await h({params:{id,divisionId:division,roundNo:'1'},user:{sub:'1'},get(){return 'pg-request'},body:{mode:'star-grid',participant_ids:JSON.stringify([a,b])},file:{mimetype:'image/png',buffer:Buffer.from('fixture')}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});
  assert.equal(result.status,200);assert.equal(result.body.cells[0].matchId,matchId);
  assert.equal(await snapshot(),before);assert.ok(commands.every(sql=>sql.trim().startsWith('SELECT')));
 } finally {pool.query=original;await db.close();}
});
