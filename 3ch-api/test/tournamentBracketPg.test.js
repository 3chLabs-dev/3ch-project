const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pool=require('../src/db/pool'),router=require('../src/routes/tournamentExtras');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('PostgreSQL: qualification, bracket creation, winner/loser advancement and rollback preserve persisted results',{skip:!process.env.TOURNAMENT_PGLITE_MODULE,timeout:60000},async()=>{
 const {PGlite}=require(process.env.TOURNAMENT_PGLITE_MODULE);const db=new PGlite();const original=pool.connect;
 const id=uuid(100),division=uuid(101);
 try{
 await db.exec(`CREATE TABLE tournaments(id uuid PRIMARY KEY,created_by_id int,host_group_id uuid,application_deadline_at timestamptz,status text);
 CREATE TABLE tournament_divisions(id uuid PRIMARY KEY,tournament_id uuid,status text,updated_at timestamptz DEFAULT now());
 CREATE TABLE tournament_division_rounds(id uuid PRIMARY KEY,division_id uuid,round_no int,league_type text,format text,rules jsonb);
 CREATE TABLE tournament_participants(id uuid PRIMARY KEY,division_id uuid,name text,member_division text,source_group_id uuid,status text,created_at timestamptz DEFAULT now());
 CREATE TABLE tournament_pools(id uuid PRIMARY KEY,division_id uuid,round_no int,pool_no int);
 CREATE TABLE tournament_pool_members(pool_id uuid,participant_id uuid,slot_no int);
 CREATE TABLE tournament_matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),division_id uuid,program_round int,phase text,round_no int,match_order int,participant_a_id uuid,participant_b_id uuid,score_a int,score_b int,status text DEFAULT 'pending' CONSTRAINT tournament_matches_status_check CHECK (status IN ('pending','completed','cancelled')),court varchar(40),pool_name text,created_at timestamptz DEFAULT now());`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../prisma/migrations/20261019170000_tournament_bracket_links/migration.sql'),'utf8'));
 await db.query("INSERT INTO tournaments VALUES ($1,1,$2,now()-interval '1 day','open')",[id,uuid(200)]);
 await db.query("INSERT INTO tournament_divisions(id,tournament_id,status) VALUES ($1,$2,'locked')",[division,id]);
 await db.query("INSERT INTO tournament_division_rounds VALUES ($1,$2,1,'SINGLES','GROUP','{\"match_rule\":\"BEST_OF_3\"}'),($3,$2,2,'SINGLES','TOURNAMENT','{\"match_rule\":\"BEST_OF_3\",\"tournament_mode\":\"upper-lower\",\"final_advancement_mode\":\"all\"}')",[uuid(201),division,uuid(202)]);
 for(let n=1;n<=4;n++)await db.query("INSERT INTO tournament_participants(id,division_id,name,member_division,status) VALUES ($1,$2,$3,'4','confirmed')",[uuid(n),division,`선수${n}`]);
 for(let n=1;n<=2;n++){
  await db.query('INSERT INTO tournament_pools VALUES ($1,$2,1,$3)',[uuid(300+n),division,n]);
  for(let slot=1;slot<=2;slot++)await db.query('INSERT INTO tournament_pool_members VALUES ($1,$2,$3)',[uuid(300+n),uuid((n-1)*2+slot),slot]);
  await db.query("INSERT INTO tournament_matches(id,division_id,program_round,phase,round_no,match_order,participant_a_id,participant_b_id,score_a,score_b,status,pool_name) VALUES ($1,$2,1,'GROUP',1,$3,$4,$5,2,$6,'completed',$7)",[uuid(400+n),division,n,uuid(n*2-1),uuid(n*2),n-1,String(n)]);
 }
 const previous=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows;
 // Reproduce the production constraint before applying the additive status change.
 await assert.rejects(db.query("UPDATE tournament_matches SET status='playing' WHERE id=$1",[uuid(401)]), /tournament_matches_status_check/);
 await db.exec(fs.readFileSync(path.join(__dirname,'../prisma/migrations/20261020090000_tournament_match_playing_status/migration.sql'),'utf8'));
 assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,previous);
 await assert.rejects(db.query("UPDATE tournament_matches SET status='invalid' WHERE id=$1",[uuid(401)]), /tournament_matches_status_check/);

 pool.connect=async()=>({async query(sql,values){if(sql.includes('FROM tournaments t LEFT JOIN'))return {rows:[{id,created_by_id:1,status:'open'}],rowCount:1};if(sql.includes('FROM subscriptions'))return {rows:[{}],rowCount:1};if(sql.includes('JOIN group_members gm ON gm.group_id=p.source_group_id'))return {rows:[],rowCount:0};const r=await db.query(sql,values);return {...r,rowCount:r.rows?.length??0};},release(){}});
 async function invoke(route,params,body={},userId='1'){const out={status:200};const h=router.stack.find(l=>l.route?.path===route).route.stack.at(-1).handle;await h({params:{id,...params},body,user:{sub:userId}},{status(n){out.status=n;return this},json(body){out.body=body;return this}});return out;}
 const generate=(userId='1')=>invoke('/tournaments/:id/divisions/:divisionId/rounds/:roundNo/bracket',{divisionId:division,roundNo:'2'},{},userId);
 const denied=await generate('2');assert.equal(denied.status,403);assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,previous);
 await db.query("UPDATE tournament_matches SET status='pending' WHERE id=$1",[uuid(401)]);const premature=await generate();assert.equal(premature.status,409);await db.query("UPDATE tournament_matches SET status='completed' WHERE id=$1",[uuid(401)]);
 const created=await generate();assert.equal(created.status,201);assert.equal(created.body.match_count,4);
 assert.deepEqual((await db.query('SELECT * FROM tournament_matches WHERE program_round=1 ORDER BY id')).rows,previous);
 const first=(await db.query("SELECT * FROM tournament_matches WHERE program_round=2 AND round_no=1 ORDER BY match_order LIMIT 1")).rows[0];
 const expected=m=>({score_a:m.score_a,score_b:m.score_b,status:m.status,court:m.court});
 for(let step=0;step<10;step++){
  const m=(await db.query("SELECT * FROM tournament_matches WHERE program_round=2 AND status='pending' AND participant_a_id IS NOT NULL AND participant_b_id IS NOT NULL ORDER BY round_no,match_order LIMIT 1")).rows[0];if(!m)break;
  const started=await invoke('/tournaments/:id/matches/:matchId',{matchId:m.id},{expected:expected(m),updates:{score_a:0,score_b:0,status:'playing'}});assert.equal(started.status,200,started.body.message);assert.equal(started.body.match.status,'playing');
  const done=await invoke('/tournaments/:id/matches/:matchId',{matchId:m.id},{expected:expected(started.body.match),updates:{score_a:2,score_b:0,status:'completed'}});assert.equal(done.status,200,done.body.message);
 }
 const finished=(await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows;
 assert.ok(finished.filter(m=>m.program_round===2).every(m=>m.status==='completed'));assert.equal(finished.filter(m=>m.program_round===2&&!m.next_match_id).length,2);
 assert.deepEqual(finished.filter(m=>m.program_round===1),previous);
 const duplicate=await generate();assert.equal(duplicate.status,409);assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,finished);
 const source=finished.find(m=>m.id===first.id);
 const correction=await invoke('/tournaments/:id/matches/:matchId',{matchId:source.id},{expected:expected(source),updates:{score_a:0,score_b:2}});assert.equal(correction.status,409);assert.deepEqual((await db.query('SELECT * FROM tournament_matches ORDER BY id')).rows,finished);
 const old=previous[0];const priorEdit=await invoke('/tournaments/:id/matches/:matchId',{matchId:old.id},{expected:expected(old),updates:{score_a:1,score_b:2}});assert.equal(priorEdit.status,409);assert.deepEqual((await db.query('SELECT * FROM tournament_matches WHERE program_round=1 ORDER BY id')).rows,previous);
 const reset=await invoke('/tournaments/:id/matches/:matchId',{matchId:source.id},{expected:expected(source),updates:{status:'playing'}});assert.equal(reset.status,409);
 }finally{pool.connect=original;await db.close();}
});
