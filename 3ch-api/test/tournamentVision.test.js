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
async function scan({tournament=true,owner=true,badOrder=false,missingRound=false,failure=false}={}){
 const original=pool.query,commands=[];scanCalls=0;credits=[];refunds=[];scanFails=failure;
 pool.query=async(sql)=>{commands.push(sql);
 if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{created_by_id:owner?1:2,status:'open'}]};
 if(sql.includes('FROM subscriptions'))return {rowCount:1};
 if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0};
 if(sql.includes('SELECT r.id'))return {rowCount:missingRound?0:1};
 if(sql.includes('FROM leagues l'))return {rowCount:1,rows:[{billing_owner_id:1,join_permission:'public'}]};
 if(sql.includes('FROM tournament_participants')||sql.includes('FROM league_participants'))return {rows:[{id:'a',name:'A',division:'3'},{id:'b',name:'B',division:'4'}]};
 if(sql.includes('FROM tournament_matches')||sql.includes('FROM league_matches'))return {rows:[{id:'match',participant_a_id:'a',participant_b_id:'b'}]};
 throw Error(sql);};
 const path='/tournaments/:id/divisions/:divisionId/rounds/:roundNo/openai-vision/scan';
 const h=router.stack.find(l=>Array.isArray(l.route?.path)&&l.route.path.includes(path)).route.stack.at(-1).handle;
 const result={status:200};
 try{await h({params:{id,...(tournament?{divisionId:id,roundNo:'1'}:{})},user:{sub:'1'},get(){return 'request'},body:{mode:'star-grid',participant_ids:JSON.stringify(badOrder?['a','foreign']:['a','b'])},file:{mimetype:'image/png',buffer:Buffer.from('fixture')}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return {result,commands,scanCalls,credits:[...credits],refunds:[...refunds]};}finally{pool.query=original;}
}
test('same league scanner maps tournament cells to persisted matches and bills tournament owner',async()=>{const r=await scan();assert.equal(r.result.status,200);assert.equal(r.result.body.cells.length,2);assert.equal(r.result.body.cells[0].matchId,'match');assert.equal(r.credits[0].referenceType,'TOURNAMENT');assert.equal(r.credits[0].userId,1);assert.ok(!r.commands.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));assert.ok(!r.commands.some(s=>s.includes('FROM league_matches')));});
test('permission, round and participant scope errors never invoke OCR or consume credits',async()=>{for(const args of [{owner:false},{missingRound:true},{badOrder:true}]){const r=await scan(args);assert.ok(r.result.status>=400);assert.equal(r.scanCalls,0);assert.equal(r.credits.length,0);}});
test('failed tournament recognition refunds credit and existing league recognition stays on league path',async()=>{const failed=await scan({failure:true});assert.equal(failed.refunds.length,1);const league=await scan({tournament:false});assert.equal(league.result.status,200);assert.equal(league.credits[0].referenceType,'LEAGUE');assert.ok(league.commands.some(s=>s.includes('FROM league_matches')));});
