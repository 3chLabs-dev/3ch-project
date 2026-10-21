const test=require('node:test'),assert=require('node:assert/strict');
const pool=require('../src/db/pool'),router=require('../src/routes/tournamentLeague');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('shared league program: singles/doubles/teams, later rounds and protected persisted results',{skip:!process.env.TOURNAMENT_PGLITE_MODULE,timeout:90000},async()=>{
 const {PGlite}=require(process.env.TOURNAMENT_PGLITE_MODULE),db=new PGlite(),original=pool.connect;
 const id=uuid(100),division=uuid(101);
 try{
 await db.exec(`CREATE TABLE tournament_divisions(id uuid PRIMARY KEY,tournament_id uuid,league_type text,format text,rules jsonb,league_program jsonb,updated_at timestamptz DEFAULT now());
 CREATE TABLE tournament_division_rounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),division_id uuid,round_no int,league_type text,format text,rules jsonb,updated_at timestamptz DEFAULT now());
 CREATE TABLE groups(id uuid PRIMARY KEY,name text);
 CREATE TABLE tournament_participants(id uuid PRIMARY KEY,division_id uuid,name text,member_division text,source_group_id uuid,status text,created_at timestamptz DEFAULT now());
 CREATE TABLE tournament_pools(id uuid PRIMARY KEY,division_id uuid,round_no int,pool_no int);
 CREATE TABLE tournament_pool_members(pool_id uuid,participant_id uuid,slot_no int);
 CREATE TABLE tournament_matches(id uuid PRIMARY KEY,division_id uuid,program_round int,phase text,round_no int,match_order int,participant_a_id uuid,participant_b_id uuid,score_a int,score_b int,status text DEFAULT 'pending' CHECK(status IN ('pending','playing','completed','cancelled')),court varchar(40),pool_name text,created_at timestamptz DEFAULT now(),next_match_id uuid,next_slot text,loser_next_match_id uuid,loser_next_slot text,is_bye bool DEFAULT false,bracket text,bracket_index int,match_label text,league_data jsonb DEFAULT '{}');
 CREATE TABLE tournament_competition_audit(id bigserial PRIMARY KEY,tournament_id uuid,division_id uuid,actor_id int,action text,snapshot jsonb);`);
 await db.query('INSERT INTO tournament_divisions(id,tournament_id) VALUES ($1,$2)',[division,id]);
 for(let n=1;n<=12;n++)await db.query("INSERT INTO tournament_participants(id,division_id,name,member_division,status) VALUES ($1,$2,$3,$4,'confirmed')",[uuid(n),division,`선수${n}`,String(n%6+1)]);
 const tournament={id,created_by_id:1,status:'open',starts_at:'2099-01-01',application_deadline_at:'2020-01-01'};
 let failInsert=false;
 pool.connect=async()=>({async query(sql,values){
  if(failInsert&&sql.startsWith('INSERT INTO tournament_matches'))throw new Error('simulated insert failure after archiving unplayed matches');
  if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[tournament],rowCount:1};
  if(sql.startsWith('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE'))return {rowCount:1,rows:[tournament]};
  if(sql.includes('SELECT role, management_permissions FROM group_members'))return {rowCount:1,rows:[{role:'owner'}]};
  if(sql.includes('FROM subscriptions'))return {rowCount:1,rows:[{}]};
  if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rowCount:0,rows:[]};
  const result=await db.query(sql,values);return {...result,rowCount:result.rows?.length??0};
 },release(){}});
 // Middleware is its own layer: call the final registered handler directly.
 const layer=router.stack.at(-1);
 assert.ok(layer);
 let targetDivision=division;
 const call=async(method,requestPath,body,user='1')=>{const result={status:200};await layer.handle({params:{id,divisionId:targetDivision},path:requestPath,method,body,user:{sub:user}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return result;};
 for(const [i,type] of ['SINGLES','DOUBLES','TEAM'].entries()) {
  const roundNo=i+1;
  await db.query("INSERT INTO tournament_division_rounds(division_id,round_no,league_type,format,rules) VALUES ($1,$2,$3,'LEAGUE','{\"match_rule\":\"BEST_OF_3\"}')",[division,roundNo,type]);
  const before=(await call('GET','/program')).body.program;
  const program=before.program_data;
  if(program.blocks.length<roundNo){program.blocks.push({type,format:'LEAGUE',title:`${roundNo}라운드`,matchRule:'3전 2선승제',teamPlayerCount:3,groupSizes:[12]});}
  await db.query('UPDATE tournament_divisions SET league_program=$1::jsonb WHERE id=$2',[JSON.stringify(program),division]);
  const sync=await call('POST','/program/matches/sync',{matches:[{id:`request-${roundNo}`,program_round:roundNo,score_a:99,status:'done'}]});
  assert.equal(sync.status,200,JSON.stringify(sync.body));assert.ok(sync.body.inserted>0);
  if(roundNo===1) {
    const editable=(await call('GET','/program')).body.program;
    const revised=structuredClone(editable.program_data);revised.blocks[0].halfSplitOnlyMatches=true;
    const beforeFailure=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,divisionBefore=(await db.query('SELECT * FROM tournament_divisions')).rows;
    failInsert=true;
    const failed=await call('POST','/reconfigure',{program_data:revised,round_no:1,expected_updated_at:editable.updated_at instanceof Date?editable.updated_at.toISOString():editable.updated_at,confirmation_intent:'RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND'});
    failInsert=false;assert.equal(failed.status,500);
    assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,beforeFailure);assert.deepEqual((await db.query('SELECT * FROM tournament_divisions')).rows,divisionBefore);
    const rebuilt=await call('POST','/reconfigure',{program_data:revised,round_no:1,expected_updated_at:editable.updated_at instanceof Date?editable.updated_at.toISOString():editable.updated_at,confirmation_intent:'RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND'});
    assert.equal(rebuilt.status,200,JSON.stringify(rebuilt.body));
    assert.ok((await db.query("SELECT * FROM tournament_matches WHERE status='cancelled'")).rows.length>0);
  }

  const created=(await db.query("SELECT * FROM tournament_matches WHERE program_round=$1 AND status<>'cancelled' ORDER BY id",[roundNo])).rows;
  assert.ok(created.every(m=>m.score_a===null&&m.score_b===null&&m.status==='pending'));
  if(type!=='SINGLES')assert.ok(created.every(m=>m.league_data.participant_a_roster_ids.length>1));
  await db.query("UPDATE tournament_matches SET score_a=2,score_b=0,status='completed' WHERE program_round=$1 AND status<>'cancelled'",[roundNo]);
 }
 const saved=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows;
 const currentProgram=(await call('GET','/program')).body.program;
 const edit=structuredClone(currentProgram.program_data);edit.blocks[0].format='GROUP';
 const blockedEdit=await call('PUT','/program',{program_data:edit,expected_updated_at:currentProgram.updated_at instanceof Date?currentProgram.updated_at.toISOString():currentProgram.updated_at});assert.equal(blockedEdit.status,409);
 const blockedReconfigure=await call('POST','/reconfigure',{program_data:edit,round_no:1,expected_updated_at:currentProgram.updated_at instanceof Date?currentProgram.updated_at.toISOString():currentProgram.updated_at,confirmation_intent:'RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND'});assert.equal(blockedReconfigure.status,409);

 const omissions=await call('POST','/program/matches/sync',{matches:[{id:saved[0].id,program_round:1}]});assert.equal(omissions.status,409);assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,saved);
 const all=await call('POST','/program/matches/sync',{matches:saved.map(m=>({id:m.id,program_round:m.program_round,score_a:0,score_b:0,status:'pending'}))});assert.equal(all.status,200);assert.equal(all.body.inserted,0);assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,saved);
 const target=saved.find(m=>m.status==='completed'),expected={score_a:target.score_a,score_b:target.score_b,status:target.status,court:null};
 const resetDenied=await call('PATCH',`/matches/${target.id}`,{expected,updates:{status:'playing'}});assert.equal(resetDenied.status,409);
 const deleteDenied=await call('DELETE',`/matches/${target.id}`,{confirmation_intent:'CANCEL_UNPLAYED_TOURNAMENT_MATCH'});assert.equal(deleteDenied.status,409);
 const denied=await call('PATCH',`/matches/${target.id}`,{expected,updates:{score_a:1}},'2');assert.equal(denied.status,403);
 assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,saved);
 const withoutIntent=await call('POST','/reset',{});assert.equal(withoutIntent.status,409);
 const reset=await call('POST','/reset',{confirmation_intent:'RESET_TOURNAMENT_RESULTS'});assert.equal(reset.status,200);
 assert.ok((await db.query('SELECT COUNT(*)::int AS count FROM tournament_competition_audit')).rows[0].count>=2);
 const after=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows;
 assert.equal(after.length,saved.length);assert.ok(after.filter(m=>(m.program_round??1)===1).every(m=>m.score_a===null&&['pending','cancelled'].includes(m.status)));
 assert.ok(after.filter(m=>m.program_round>1).every(m=>m.status==='cancelled'&&m.score_a===saved.find(old=>old.id===m.id).score_a));
 assert.deepEqual(after.map(m=>[m.id,m.participant_a_id,m.participant_b_id,m.match_order]),saved.map(m=>[m.id,m.participant_a_id,m.participant_b_id,m.match_order]));
 const resetProgram=(await call('GET','/program')).body.program,knockout=structuredClone(resetProgram.program_data);knockout.blocks[0].format='TOURNAMENT';knockout.blocks[0].halfSplitOnlyMatches=false;
 if(knockout.rounds?.[0]){knockout.rounds[0].format='TOURNAMENT';knockout.rounds[0].halfSplitOnlyMatches=false;}
 assert.equal((await call('POST','/reconfigure',{program_data:knockout,round_no:1,expected_updated_at:resetProgram.updated_at instanceof Date?resetProgram.updated_at.toISOString():resetProgram.updated_at,confirmation_intent:'RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND'})).status,200);
 const first=(await db.query("SELECT * FROM tournament_matches WHERE status='pending' AND participant_a_id IS NOT NULL AND participant_b_id IS NOT NULL AND next_match_id IS NOT NULL ORDER BY match_order LIMIT 1")).rows[0];assert.ok(first);
 assert.equal((await call('PATCH',`/matches/${first.id}`,{expected:{score_a:null,score_b:null,status:'pending',court:null},updates:{score_a:2,score_b:0,status:'completed'}})).status,200);
 assert.equal((await call('POST','/reset',{confirmation_intent:'RESET_TOURNAMENT_RESULTS'})).status,200);
 assert.equal((await call('PATCH',`/matches/${first.id}`,{expected:{score_a:null,score_b:null,status:'pending',court:null},updates:{score_a:0,score_b:2,status:'completed'}})).status,200);
 assert.equal((await db.query('SELECT * FROM tournament_matches WHERE id=$1',[first.next_match_id])).rows[0][`participant_${first.next_slot}_id`],first.participant_b_id);
 const countBefore=(await db.query('SELECT COUNT(*)::int AS count FROM tournament_participants')).rows[0].count;
 const bye=await call('POST','/participants',{participants:[{name:'BYE 1',is_bot:true}]});assert.equal(bye.status,200);assert.equal(bye.body.participants[0].is_bot,true);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tournament_participants')).rows[0].count,countBefore);
 const beforeDelete=(await db.query('SELECT COUNT(*)::int AS count FROM tournament_matches')).rows[0].count;
 assert.equal((await call('DELETE','/program',{})).status,409);assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tournament_matches')).rows[0].count,beforeDelete);
 const deletion=await call('DELETE','/program',{confirmation_intent:'DELETE_TOURNAMENT_PROGRAM'});assert.equal(deletion.status,200);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tournament_matches')).rows[0].count,0);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tournament_participants')).rows[0].count,countBefore);
 // A new preliminary competition reuses the entry identities across two divisions.
 const other=uuid(801),combined=uuid(802);
 await db.query('INSERT INTO tournament_divisions(id,tournament_id,rules) VALUES ($1,$2,$3::jsonb)',[other,id,'{}']);
 await db.query('UPDATE tournament_participants SET division_id=$1 WHERE id=ANY($2::uuid[])',[other,[1,2,3,4,5,6].map(uuid)]);
 const config={source_division_ids:[division,other],start_round:2};
 await db.query('INSERT INTO tournament_divisions(id,tournament_id,league_type,format,rules) VALUES ($1,$2,\'SINGLES\',\'TOURNAMENT\',$3::jsonb)',[combined,id,JSON.stringify({entry_config:config})]);
 await db.query(`INSERT INTO tournament_division_rounds(division_id,round_no,league_type,format,rules) VALUES ($1,1,'SINGLES','TOURNAMENT','{"match_rule":"BEST_OF_3","round_label":"예선"}')`,[combined]);
 await db.query(`INSERT INTO tournament_matches(id,division_id,program_round,phase,status,score_a,score_b,participant_a_id,participant_b_id) VALUES ($1,$2,1,'GROUP','completed',2,0,$3,$4)`,[uuid(803),division,uuid(7),uuid(8)]);
 const sourceResults=(await db.query('SELECT * FROM tournament_matches WHERE division_id=$1',[division])).rows;
 const originalPeople=(await db.query('SELECT * FROM tournament_participants ORDER BY id')).rows;
 targetDivision=combined;
 const combinedProgram=(await call('GET','/program')).body.program;
 assert.deepEqual(combinedProgram.program_data.tournamentEntryConfig,config);
 const mergedPeople=await call('GET','/participants');assert.equal(mergedPeople.status,200);
 assert.equal(mergedPeople.body.participants.length,12);
 assert.deepEqual(new Set(mergedPeople.body.participants.map(p=>p.id)),new Set(originalPeople.map(p=>p.id)));
 const generated=await call('POST','/program/matches/sync',{matches:[{id:'combined-request',program_round:1}]});assert.equal(generated.status,200,JSON.stringify(generated.body));assert.ok(generated.body.inserted>0);
 assert.deepEqual((await db.query('SELECT * FROM tournament_matches WHERE division_id=$1',[division])).rows,sourceResults);
 assert.deepEqual((await db.query('SELECT * FROM tournament_participants ORDER BY id')).rows,originalPeople);
 const latest=(await call('GET','/program')).body.program;
 const revisedEntry=structuredClone(latest.program_data);revisedEntry.tournamentEntryConfig.start_round=3;
 const protectedRows=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows;
 const failedConfig=await call('PUT','/program',{program_data:revisedEntry,expected_updated_at:latest.updated_at instanceof Date?latest.updated_at.toISOString():latest.updated_at});
 assert.equal(failedConfig.status,409);
 assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,protectedRows);
 // Initial creation and adding a combined competition persist the links atomically.
 await db.exec(`ALTER TABLE tournament_divisions ALTER COLUMN id SET DEFAULT gen_random_uuid();
 ALTER TABLE tournament_divisions ADD COLUMN name text;
 ALTER TABLE tournament_divisions ADD COLUMN sort_order int DEFAULT 0;
 ALTER TABLE tournament_divisions ADD COLUMN recruit_count int;
 CREATE TABLE tournaments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text,description text,sport text,venue_name text,venue_address text,notice text,court_count int,recruit_count int,starts_at timestamptz,ends_at timestamptz,application_deadline_at timestamptz,host_group_id uuid,created_by_id int,premium_visible boolean,status text);`);
 const eventRouter=require('../src/routes/tournament');
 const invoke=async(path,body)=>{const result={status:200};const handle=eventRouter.stack.find(l=>l.route?.path===path&&l.route.methods.post).route.stack.at(-1).handle;
 await handle({params:{id},body,user:{sub:'1'}},{status(n){result.status=n;return this},json(body){result.body=body;return this}});return result;};
 const template={league_type:'SINGLES',format:'TOURNAMENT',rules:{match_rule:'BEST_OF_3',round_label:'예선'}};
 const appended=await invoke('/tournaments/:id/competitions',{name:'통합 예선',entry_config:config,rounds:[template]});
 assert.equal(appended.status,201,JSON.stringify(appended.body));
 assert.deepEqual((await db.query('SELECT rules FROM tournament_divisions WHERE id=$1',[appended.body.division.id])).rows[0].rules.entry_config,config);
 const createdEvent=await invoke('/tournaments',{title:'부문 통합 테스트',host_group_id:uuid(880),starts_at:'2099-01-01T00:00:00Z',divisions:[
  {name:'3부',rounds:[{...template,format:'LEAGUE'}]}, {name:'4부',rounds:[{...template,format:'LEAGUE'}]},
  {name:'3~4부',source_division_indices:[0,1],start_round:2,rounds:[template]},
 ]});
 assert.equal(createdEvent.status,201,JSON.stringify(createdEvent.body));
 const savedDivisions=(await db.query('SELECT * FROM tournament_divisions WHERE tournament_id=$1 ORDER BY sort_order',[createdEvent.body.tournament.id])).rows;
 assert.deepEqual(savedDivisions[2].rules.entry_config,{source_division_ids:savedDivisions.slice(0,2).map(d=>d.id),start_round:2});
 const invalidEvent=await invoke('/tournaments',{title:'잘못된 대상 테스트',host_group_id:uuid(880),starts_at:'2099-01-01T00:00:00Z',divisions:[{name:'통합',source_division_indices:[0,1],start_round:2,rounds:[template]}]});
 assert.equal(invalidEvent.status,400);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM tournaments')).rows[0].count,1);
 const {validateEntryConfig}=require('../src/services/tournamentEntryConfig');
 const client=await pool.connect();
 await assert.rejects(()=>validateEntryConfig(client,id,combined,{source_division_ids:[division,uuid(999)],start_round:2}),/같은 대회/);
 await assert.rejects(()=>validateEntryConfig(client,id,combined,{source_division_ids:[division,combined],start_round:2}),/자기 자신/);
 }finally{pool.connect=original;await db.close();}
});
