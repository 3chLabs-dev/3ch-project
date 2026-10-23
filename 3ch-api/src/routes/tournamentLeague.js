const express=require('express');
const {randomUUID}=require('crypto');
const {z}=require('zod');
const pool=require('../db/pool');
const {optionalAuth}=require('../middlewares/auth');
const {tournamentAccess}=require('../utils/tournamentAccess');
const {advancePersistedBracket,guardQualifiedSourceResults}=require('../services/tournamentBracket');
const {keyFor,matchId,leagueParticipants,leagueMatches,programFor,withProgramEstimates,hasResult,validateProgram,generateRound,conflict,statusFor}=require('../services/tournamentLeagueProgram');
const {entryConfig,entryDivisionIds,validateEntryConfig}=require('../services/tournamentEntryConfig');
const router=express.Router();
const uuid=z.string().uuid();
async function insertGenerated(client,divisionId,roundNo,generated) {
  for(const m of generated) await client.query(`INSERT INTO tournament_matches(id,division_id,program_round,phase,pool_name,round_no,match_order,participant_a_id,participant_b_id,score_a,score_b,status,court,bracket,bracket_index,match_label,next_match_id,next_slot,loser_next_match_id,loser_next_slot,is_bye,league_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)`,
    [m.id,divisionId,roundNo,m.phase,m.pool_name,m.round_no,m.match_order,m.participant_a_id,m.participant_b_id,m.score_a??null,m.score_b??null,m.status,m.court??null,m.bracket??null,m.bracket_index,m.match_label??null,m.next_match_id,m.next_slot??null,m.loser_next_match_id,m.loser_next_slot??null,m.is_bye,JSON.stringify(m.league_data)]);
}

router.use('/tournaments/:id/divisions/:divisionId/league',optionalAuth,async(req,res)=>{
  if (![req.params.id,req.params.divisionId].every(id=>uuid.safeParse(id).success)) return res.status(400).json({message:'대회 부문을 확인해주세요.'});
  const client=await pool.connect();
  const write=req.method!=='GET';
  try {
    await client.query('BEGIN');
    const rights=await tournamentAccess(client,req.params.id,req.user?Number(req.user.sub):null);
    if(!rights.allowed||write&&!rights.manage) throw Object.assign(conflict('대회 관리 권한이 필요합니다.'),{statusCode:write?403:404});
    const division=(await client.query(`SELECT * FROM tournament_divisions WHERE id=$1 AND tournament_id=$2${write?' FOR UPDATE':''}`,[req.params.divisionId,req.params.id])).rows[0];
    if(!division) throw Object.assign(conflict('대회 부문을 찾을 수 없습니다.'),{statusCode:404});
    const rounds=(await client.query('SELECT * FROM tournament_division_rounds WHERE division_id=$1 ORDER BY round_no',[division.id])).rows;
    const people=(await client.query("SELECT p.*,COALESCE(g.name,'개인') AS club_name FROM tournament_participants p LEFT JOIN groups g ON g.id=p.source_group_id WHERE p.division_id=ANY($1::uuid[]) ORDER BY p.created_at,p.id",[entryDivisionIds(division)])).rows;
    const raw=(await client.query(`SELECT * FROM tournament_matches WHERE division_id=$1 ORDER BY match_order,created_at,id${write?' FOR UPDATE':''}`,[division.id])).rows;
    const poolRows=(await client.query('SELECT po.*,p.id AS participant_id,p.name,p.member_division,p.source_group_id FROM tournament_pools po JOIN tournament_pool_members pm ON pm.pool_id=po.id JOIN tournament_participants p ON p.id=pm.participant_id WHERE po.division_id=$1 ORDER BY po.round_no,po.pool_no,pm.slot_no',[division.id])).rows;
    const poolMap=new Map();for(const row of poolRows){if(!poolMap.has(row.id))poolMap.set(row.id,{...row,members:[]});poolMap.get(row.id).members.push({...row,id:row.participant_id});}
    const key=keyFor(req.params.id,division.id), program=programFor(division,rounds,[...poolMap.values()],people.filter(p=>p.status==='confirmed'));
    people.push(...(program.byeParticipants??[]));
    const converted=leagueMatches(raw,people,key);
    const path=req.path.replace(/\/$/,'')||'/';
    const audit=async(action,snapshot)=>client.query('INSERT INTO tournament_competition_audit(tournament_id,division_id,actor_id,action,snapshot) VALUES ($1,$2,$3,$4,$5::jsonb)',[req.params.id,division.id,Number(req.user.sub),action,JSON.stringify(snapshot)]);
    let result;
    if(req.method==='GET') {
      if(path==='/') result={league:{id:key,name:`${rights.tournament.title} · ${division.name??'참가 부문'}`,group_id:rights.tournament.host_group_id,
        created_by_id:rights.tournament.created_by_id,can_manage:rights.manage,type:({SINGLES:'단식',DOUBLES:'복식',TEAM:'단체전'}[program.blocks[0]?.type]??'단식'),format:'프로그램별 설정',sport:'탁구',venue_name:rights.tournament.venue_name,venue_address:rights.tournament.venue_address,
        status:rights.tournament.status==='completed'?'completed':'active',start_date:rights.tournament.starts_at,end_date:rights.tournament.ends_at,
        court_count:rights.tournament.court_count,participant_count:people.filter(p=>p.status==='confirmed'&&!p.is_bot).length,join_permission:'club',rules:program.blocks[0]?.matchRule??'3전 2선승제',created_at:rights.tournament.created_at,updated_at:division.updated_at}};
      else if(path==='/participants') result={participants:leagueParticipants(people,key).sort((a,b)=>{const order=program.participantOrder??[];return (order.includes(a.id)?order.indexOf(a.id):Number.MAX_SAFE_INTEGER)-(order.includes(b.id)?order.indexOf(b.id):Number.MAX_SAFE_INTEGER);})};
      else if(path==='/matches') result={matches:converted};
      else if(path==='/program') {const start=new Date(rights.tournament.starts_at);result={program:{id:division.id,league_id:key,program_data:withProgramEstimates(program,people.filter(p=>p.status==='confirmed').length,rights.tournament.court_count,Number.isFinite(start.getTime())?((start.getUTCHours()+9)%24)*60+start.getUTCMinutes():0),updated_at:division.updated_at}};}
      else if(path==='/invited-groups') result={groups:[...new Map(people.filter(p=>p.source_group_id).map(p=>[p.source_group_id,{group_id:p.source_group_id,group_name:p.club_name,status:'accepted'}])).values()]};
      else throw Object.assign(conflict('연결되지 않은 대회 조회입니다.'),{statusCode:404});
    } else if(path==='/participants'&&req.method==='POST') {
      const entries=req.body?.participants;
      if(!Array.isArray(entries)||entries.length!==1||entries[0].is_bot!==true||!/^BYE \d+$/.test(entries[0].name??''))throw conflict('실제 참가자는 대회 참가신청 메뉴에서 등록해주세요.');
      const bye={id:randomUUID(),name:entries[0].name,is_bot:true,status:'confirmed',member_division:'',member_id:null,source_group_id:null,club_name:null};
      if(people.some(p=>p.name===bye.name))throw conflict('같은 이름의 BYE가 있습니다. 새로고침해주세요.');
      const saved={...program,byeParticipants:[...(program.byeParticipants??[]),bye]};
      await audit('ADD_VIRTUAL_BYE',{participant:bye});
      const updated=await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2 RETURNING updated_at',[JSON.stringify(saved),division.id]);
      result={participants:leagueParticipants([bye],key),program:{program_data:saved,updated_at:updated.rows[0].updated_at}};
    } else if(path==='/program'&&req.method==='DELETE') {
      if(req.body?.confirmation_intent!=='DELETE_TOURNAMENT_PROGRAM')throw conflict('프로그램 삭제 확인이 필요합니다.');
      const external=await client.query('SELECT 1 FROM tournament_matches WHERE division_id<>$1 AND (next_match_id=ANY($2::uuid[]) OR loser_next_match_id=ANY($2::uuid[])) LIMIT 1',[division.id,raw.map(m=>m.id)]);
      if(external.rowCount)throw conflict('다른 부문에서 연결한 경기가 있어 삭제할 수 없습니다.');
      await audit('DELETE_PROGRAM',{program:division.league_program,rounds,matches:raw,pools:poolRows});
      await client.query('DELETE FROM tournament_pool_members WHERE pool_id IN (SELECT id FROM tournament_pools WHERE division_id=$1)',[division.id]);
      await client.query('DELETE FROM tournament_matches WHERE division_id=$1',[division.id]);
      await client.query('DELETE FROM tournament_pools WHERE division_id=$1',[division.id]);
      await client.query('DELETE FROM tournament_division_rounds WHERE division_id=$1',[division.id]);
      await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify({deleted:true}),division.id]);
      result={ok:true};
    } else if(path==='/matches'&&req.method==='DELETE'&&raw.length===0) {
      result={ok:true};
    } else if(/^\/program\/rounds\/[1-9]\d*\/rule$/.test(path)&&req.method==='PATCH') {
      const roundNo=Number(path.split('/')[3]),round=rounds.find(r=>r.round_no===roundNo);
      const matchRule=req.body?.match_rule;
      const codes={'3전 2선승제':'BEST_OF_3','5전 3선승제':'BEST_OF_5','3세트제':'THREE_SET'};
      if(!round||!Object.hasOwn(codes,matchRule)||req.body.confirmation_intent!=='CHANGE_TOURNAMENT_ROUND_RULE')throw conflict('라운드 규칙 변경 내용을 확인해주세요.');
      const revision=division.updated_at instanceof Date?division.updated_at.toISOString():String(division.updated_at);
      if(req.body.expected_updated_at!==revision)throw conflict('프로그램이 변경되었습니다. 새로고침 후 다시 시도해주세요.');
      const active=raw.filter(m=>m.status!=='cancelled'),target=active.filter(m=>(m.program_round??1)===roundNo);
      if(target.some(hasResult)||active.some(m=>(m.program_round??1)>roundNo))throw conflict('진행·완료·점수가 있는 경기 또는 후속 라운드는 유지해야 하므로 규칙을 변경할 수 없습니다.');
      const next=structuredClone(program);
      next.blocks[roundNo-1]={...next.blocks[roundNo-1],matchRule};
      next.rounds=next.rounds?.map((r,i)=>i===roundNo-1?{...r,matchRule:codes[matchRule]}:r);
      await audit('CHANGE_UNPLAYED_ROUND_RULE',{round:roundNo,program,roundRules:round.rules,matches:target});
      // Only rule metadata changes: IDs, assignments, ordering, scores and statuses remain intact.
      const rules={...(round.rules??{}),match_rule:codes[matchRule],league_config:{...(round.rules?.league_config??{}),matchRule:codes[matchRule]}};
      await client.query('UPDATE tournament_division_rounds SET rules=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify(rules),round.id]);
      if(roundNo===1)await client.query('UPDATE tournament_divisions SET rules=$1::jsonb WHERE id=$2',[JSON.stringify({...division.rules,...rules}),division.id]);
      for(const m of target)await client.query('UPDATE tournament_matches SET league_data=$1::jsonb WHERE id=$2',[JSON.stringify({...m.league_data,match_rule:matchRule}),m.id]);
      const updated=await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2 RETURNING updated_at',[JSON.stringify(next),division.id]);
      result={program:{id:division.id,league_id:key,program_data:next,updated_at:updated.rows[0].updated_at}};
    } else if(path==='/program'&&req.method==='PUT'||path==='/reconfigure'&&req.method==='POST') {
      const incoming=req.body?.program_data;
      const reconfigure=path==='/reconfigure'?Number(req.body.round_no):null;
      const active=raw.filter(m=>m.status!=='cancelled');
      if(reconfigure) {
        if(!Number.isInteger(reconfigure)||reconfigure<1||req.body.confirmation_intent!=='RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND')throw conflict('미진행 편성 재구성 확인이 필요합니다.');
        if(active.some(m=>((m.program_round??1)===reconfigure&&hasResult(m))||(m.program_round??1)>reconfigure))throw conflict('결과가 있거나 후속 라운드가 생성된 편성은 변경할 수 없습니다.');
      }
      const config=await validateEntryConfig(client,req.params.id,division.id,incoming?.tournamentEntryConfig??entryConfig(division));
      if((config.start_round!==entryConfig(division).start_round || JSON.stringify([...config.source_division_ids].sort())!==JSON.stringify([...(entryConfig(division).source_division_ids??[])].sort())) && (raw.length||poolRows.length||program.blocks.some(b=>b.groupAssignments?.some(g=>g.length)||b.teamAssignments?.some(g=>g.length)||b.doublesAssignments?.some(g=>g.length)))) throw conflict('편성이나 경기가 있는 구성의 참가 대상과 시작 라운드는 변경할 수 없습니다.');
      validateProgram(incoming,program,active.filter(m=>(m.program_round??1)!==reconfigure));
      if(req.body.expected_updated_at!==String(division.updated_at instanceof Date?division.updated_at.toISOString():division.updated_at)) throw conflict('프로그램이 변경되었습니다. 새로고침 후 저장해주세요.');
      if(incoming.blocks.length<rounds.length) {
        if(req.body.confirmation_intent!=='DELETE_EMPTY_PROGRAM_ROUNDS') throw conflict('빈 라운드 삭제 확인이 필요합니다.');
        if(poolRows.some(p=>p.round_no>incoming.blocks.length)||raw.some(m=>(m.program_round??1)>incoming.blocks.length)) throw conflict('편성이나 경기가 있는 라운드는 삭제할 수 없습니다.');
        await audit('DELETE_EMPTY_PROGRAM_ROUNDS',{rounds:rounds.slice(incoming.blocks.length),program:division.league_program});
        await client.query('DELETE FROM tournament_division_rounds WHERE division_id=$1 AND round_no>$2',[division.id,incoming.blocks.length]);
      }
      const saved={...incoming,tournamentEntryConfig:config,tournament_revision:undefined,byeParticipants:program.byeParticipants??[],roundStandings:undefined,generationKeys:{...(program.generationKeys??{})}};
      if(reconfigure) {
        await audit('RECONFIGURE_UNPLAYED_ROUND',{round:reconfigure,matches:active.filter(m=>(m.program_round??1)===reconfigure),program});
        await client.query("UPDATE tournament_matches SET status='cancelled' WHERE division_id=$1 AND COALESCE(program_round,1)=$2 AND status<>'cancelled'",[division.id,reconfigure]);
        saved.generationKeys[reconfigure]=require('crypto').randomUUID();
      }
      // A generated flag or client cache never deletes existing matches/results.
      for(let index=0;index<incoming.blocks.length;index++) {
        const b=incoming.blocks[index],r=incoming.rounds?.[index]??{};
        if(!['SINGLES','DOUBLES','TEAM'].includes(b.type)||!['LEAGUE','GROUP','TOURNAMENT'].includes(b.format)) throw conflict('라운드 유형과 방식을 확인해주세요.');
        const rules={...(rounds[index]?.rules??{}),...(index===0?{entry_config:config}:{}),match_rule:r.matchRule??({'3전 2선승제':'BEST_OF_3','5전 3선승제':'BEST_OF_5','3세트제':'THREE_SET'}[b.matchRule]??b.matchRule),
          round_label:r.option==='PRELIM'?'예선':r.option==='FINAL'?(index>=2?'결선':'본선'):r.option==='UPPER'?'상위':r.option==='LOWER'?'하위':'',tournament_mode:r.tournamentMode??b.tournamentMode??'single',
          half_split_only_matches:r.halfSplitOnlyMatches??b.halfSplitOnlyMatches??false,final_advancement_mode:r.finalAdvancementMode??b.finalAdvancementMode??'all',advance_count:r.advanceCount??b.advanceCount??2,league_config:r};
        if(rounds[index]) await client.query('UPDATE tournament_division_rounds SET league_type=$1,format=$2,rules=$3::jsonb,updated_at=now() WHERE id=$4',[b.type,b.format,JSON.stringify(rules),rounds[index].id]);
        else await client.query('INSERT INTO tournament_division_rounds(division_id,round_no,league_type,format,rules) VALUES ($1,$2,$3,$4,$5::jsonb)',[division.id,index+1,b.type,b.format,JSON.stringify(rules)]);
        if(index===0)await client.query('UPDATE tournament_divisions SET league_type=$1,format=$2,rules=$3::jsonb WHERE id=$4',[b.type,b.format,JSON.stringify(rules),division.id]);
      }
      const updated=await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2 RETURNING updated_at',[JSON.stringify(saved),division.id]);
      if(reconfigure) {
        const generated=generateRound({tournament:rights.tournament,division,roundNo:reconfigure,program:saved,participants:people,matches:raw.filter(m=>(m.program_round??1)!==reconfigure)});
        await insertGenerated(client,division.id,reconfigure,generated);
      }
      result={program:{id:division.id,league_id:key,program_data:saved,updated_at:updated.rows[0].updated_at}};
    } else if(path==='/program/matches/sync'&&req.method==='POST') {
      const incoming=req.body?.matches;
      if(!Array.isArray(incoming)||incoming.length>10000) throw conflict('경기 목록을 확인해주세요.');
      if(new Set(incoming.map(m=>m.id)).size!==incoming.length)throw conflict('경기 목록에 중복된 경기가 있습니다.');
      const requested=[...new Set(incoming.map(m=>Number(m.program_round)).filter(n=>Number.isInteger(n)&&n>0))];
      const supplied=new Set(incoming.map(m=>matchId(division.id,String(m.id))));
      // Whole-request rollback on omission; not a single persisted result is removed.
      if(raw.some(m=>requested.includes(m.program_round??1)&&m.status!=='cancelled'&&!supplied.has(m.id)&&!incoming.some(item=>(m.league_data?.client_id??m.id)===item.id))) throw conflict('기존 경기가 누락되어 동기화를 중단했습니다. 저장된 경기와 결과는 유지됩니다.');
      if(req.body.reset_results) throw conflict('초기화 전용 메뉴를 이용해주세요.');
      if(req.body.assignment_intent==='REASSIGN_UNPLAYED_TOURNAMENT_MATCHES') {
        const expected=req.body.expected_assignments;
        const changes=[];
        for(const item of incoming) {
          const original=raw.find(m=>m.id===item.id);
          if(!original)throw conflict('수동 변경할 경기 명단을 새로고침해주세요.');
          const view=converted.find(m=>m.id===original.id);
          if(['a','b'].every(slot=>(view[`participant_${slot}_id`]??null)===(item[`participant_${slot}_id`]??null)))continue;
          const snapshot=expected?.find(m=>m.id===item.id);
          if(!snapshot||['score_a','score_b','status','participant_a_id','participant_b_id'].some(k=>(snapshot[k]??null)!==(view[k]??null)))throw conflict('경기 또는 참가자 배정이 변경되었습니다. 최신 기록을 확인해주세요.');
          if(hasResult(original))throw conflict('진행·완료 또는 점수가 저장된 경기의 참가자는 변경할 수 없습니다.');
          const data={...(original.league_data??{})};
          const next={...original,league_data:data};
          for(const slot of ['a','b']) {
            const identity=item[`participant_${slot}_id`];
            const ids=identity?String(identity).split('+'):[];
            if(ids.some(id=>!people.some(p=>p.id===id&&p.status==='confirmed')))throw conflict('현재 부문의 확정 참가자만 배정할 수 있습니다.');
            next[`participant_${slot}_id`]=ids.find(id=>!people.find(p=>p.id===id)?.is_bot)??null;
            if((view[`participant_${slot}_id`]??null)!==(identity??null))data.manual_assigned_slots=[...new Set([...(data.manual_assigned_slots??[]),slot])];
            data[`participant_${slot}_id`]=identity??null;
            data[`participant_${slot}_roster_ids`]=ids;
            if((view[`participant_${slot}_id`]??null)!==(identity??null)) {
              for(const field of ['name','division','club_name','roster','roster_details']) delete data[`participant_${slot}_${field}`];
              const members=ids.map(id=>people.find(p=>p.id===id));
              data[`participant_${slot}_name`]=members.length?members.map(p=>p.name).join(' · '):null;
              data[`participant_${slot}_division`]=members.length===1?members[0].member_division:null;
              data[`participant_${slot}_club_name`]=[...new Set(members.map(p=>p.club_name).filter(Boolean))].join(' · ');
            }
          }
          if(data.participant_a_roster_ids.some(id=>data.participant_b_roster_ids.includes(id)))throw conflict('같은 참가자가 양쪽에 포함될 수 없습니다.');
          changes.push({original,next});
        }
        if(changes.length) {
          await audit('REASSIGN_UNPLAYED_MATCHES',changes.map(change=>change.original));
          for(const {next} of changes)await client.query('UPDATE tournament_matches SET participant_a_id=$1,participant_b_id=$2,league_data=$3::jsonb WHERE id=$4',[next.participant_a_id,next.participant_b_id,JSON.stringify(next.league_data),next.id]);
          for(const roundNo of requested)if(program.blocks[roundNo-1]?.format==='TOURNAMENT')await advancePersistedBracket(client,division.id,roundNo);
        }
      }
      let inserted=0;
      for(const roundNo of requested) {
        if(raw.some(m=>(m.program_round??1)===roundNo&&m.status!=='cancelled')) continue;
        const generated=generateRound({tournament:rights.tournament,division,roundNo,program,participants:people,matches:raw});
        await insertGenerated(client,division.id,roundNo,generated);inserted+=generated.length;
      }
      result={ok:true,inserted};
    } else if(/^\/matches\/[a-f\d-]{36}\/notify$/.test(path)&&req.method==='POST') {
      const m=raw.find(m=>m.id===path.split('/')[2]);if(!m)throw conflict('경기를 찾을 수 없습니다.');
      if(!process.env.VAPID_MAILTO||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)throw conflict('앱 알림 설정을 확인해주세요.');
      const webpush=require('web-push');webpush.setVapidDetails(process.env.VAPID_MAILTO,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
      const ids=new Set([m.participant_a_id,m.participant_b_id,...(m.league_data?.participant_a_roster_ids??[]),...(m.league_data?.participant_b_roster_ids??[])].filter(Boolean));
      const memberIds=[...new Set(people.filter(p=>ids.has(p.id)&&p.member_id).map(p=>p.member_id))];
      const subscriptions=await client.query('SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=ANY($1::int[])',[memberIds]);
      // Dispatch only after releasing the database transaction successfully.
      await client.query('COMMIT');
      const outcomes=await Promise.allSettled(subscriptions.rows.map(sub=>webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:`${rights.tournament.title} 경기 안내`,body:`${m.match_order}경기 준비해주세요.`,url:`/tournament/${req.params.id}/divisions/${division.id}/matches?round=${m.program_round??1}`}))));
      return res.json({ok:true,sent:outcomes.filter(outcome=>outcome.status==='fulfilled').length});
    } else if(path==='/participants/reorder'&&req.method==='PATCH') {
      const order=req.body?.order;
      if(!Array.isArray(order)||new Set(order).size!==order.length||order.some(id=>!people.some(p=>p.id===id&&p.status==='confirmed')))throw conflict('참가자 표시 순서를 확인해주세요.');
      const saved={...program,participantOrder:order};
      await audit('REORDER_PARTICIPANT_DISPLAY',{participantOrder:program.participantOrder??[]});
      await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2',[JSON.stringify(saved),division.id]);result={ok:true};
    } else if(path==='/matches/reorder'&&req.method==='PATCH') {
      const order=req.body?.order;
      if(!Array.isArray(order)||new Set(order).size!==order.length||order.some(id=>!raw.some(m=>m.id===id))) throw conflict('경기 순서가 변경되었습니다. 새로고침해주세요.');
      const included=raw.filter(m=>order.includes(m.id)).map(m=>m.match_order).sort((a,b)=>a-b);
      await audit('REORDER_MATCHES',{order:raw.map(m=>({id:m.id,match_order:m.match_order}))});
      for(let i=0;i<order.length;i++) await client.query('UPDATE tournament_matches SET match_order=$1 WHERE id=$2',[included[i],order[i]]);
      result={ok:true};
    } else if(/^\/matches\/[a-f\d-]{36}$/.test(path)&&req.method==='PATCH') {
      const match=raw.find(m=>m.id===path.split('/')[2]);if(!match)throw conflict('경기를 찾을 수 없습니다.');
      const expected=req.body?.expected,updates=req.body?.updates;
      if(!expected||!updates||['score_a','score_b','status','court'].some(k=>(match[k]??null)!==(expected[k]??null))) throw conflict('경기가 변경되었습니다. 최신 기록을 확인해주세요.');
      const allowed=['score_a','score_b','status','court'];
      if(Object.keys(updates).some(k=>!allowed.includes(k))) throw conflict('경기 편성은 점수 저장으로 변경할 수 없습니다.');
      const parsed=z.object({score_a:z.number().int().min(0).max(99).optional(),score_b:z.number().int().min(0).max(99).optional(),status:z.enum(['playing','completed']).optional(),court:z.string().max(40).nullable().optional()}).strict().safeParse(updates);
      if(!parsed.success||match.status==='cancelled'||match.status==='completed'&&updates.status&&updates.status!=='completed')throw conflict('완료 경기를 초기화하거나 잘못된 점수를 저장할 수 없습니다.');
      const next={...match,...updates};
      if(next.status==='completed'&&match.participant_a_id&&match.participant_b_id&&(next.score_a==null||next.score_b==null))throw conflict('양쪽 점수를 입력해주세요.');
      await guardQualifiedSourceResults(client,match,next);
      await client.query('UPDATE tournament_matches SET score_a=$1,score_b=$2,status=$3,court=$4 WHERE id=$5',[next.score_a,next.score_b,next.status,next.court??null,match.id]);
      if(next.phase==='TOURNAMENT')await advancePersistedBracket(client,division.id,next.program_round);
      const refreshed=(await client.query('SELECT * FROM tournament_matches WHERE division_id=$1 ORDER BY match_order,id',[division.id])).rows;
      result={match:leagueMatches(refreshed,people,key).find(m=>m.id===match.id)};
    } else if(/^\/matches\/[a-f\d-]{36}$/.test(path)&&req.method==='DELETE') {
      const m=raw.find(m=>m.id===path.split('/')[2]);
      if(!m||hasResult(m)||req.body?.confirmation_intent!=='CANCEL_UNPLAYED_TOURNAMENT_MATCH')throw conflict('확인한 미진행 경기만 취소할 수 있습니다.');
      if(raw.some(other=>other.next_match_id===m.id||other.loser_next_match_id===m.id)||m.next_match_id||m.loser_next_match_id)throw conflict('진출 관계가 있는 토너먼트 경기는 개별 삭제할 수 없습니다.');
      await audit('CANCEL_UNPLAYED_MATCH',m);
      await client.query("UPDATE tournament_matches SET status='cancelled' WHERE id=$1",[m.id]);result={ok:true};
    } else if(path==='/restore-no-game'&&req.method==='POST') {
      const match=raw.find(m=>m.id===req.body.restore_match_id);
      if(!match||hasResult(match)||match.league_data?.is_no_game!==true||!match.participant_a_id||!match.participant_b_id)throw conflict('양쪽 참가자가 있는 미진행 NO-GAME 경기만 복구할 수 있습니다.');
      await audit('RESTORE_NO_GAME',match);
      await client.query("UPDATE tournament_matches SET league_data=jsonb_set(league_data,'{is_no_game}','false'::jsonb) WHERE id=$1",[match.id]);
      result={ok:true,inserted:0};
    } else if(path==='/reset'&&req.method==='POST') {
      if(req.body?.confirmation_intent!=='RESET_TOURNAMENT_RESULTS')throw conflict('경기 결과 초기화 확인이 필요합니다.');
      await audit('RESET_RESULTS',{matches:raw,program:division.league_program});
      const inherited=new Map();
      for(const m of raw.filter(m=>(m.program_round??1)===1&&m.status!=='cancelled'))for(const [id,slot]of [[m.next_match_id,m.next_slot],[m.loser_next_match_id,m.loser_next_slot]])if(id&&['a','b'].includes(slot)){if(!inherited.has(id))inherited.set(id,[]);inherited.get(id).push(slot);}
      for(const m of raw) {
        if(m.status==='cancelled')continue;
        if((m.program_round??1)>1){await client.query("UPDATE tournament_matches SET status='cancelled' WHERE id=$1",[m.id]);continue;}
        const next={...m,league_data:{...(m.league_data??{})}};
        for(const slot of inherited.get(m.id)??[])if(!next.league_data.manual_assigned_slots?.includes(slot)){
          next[`participant_${slot}_id`]=null;
          for(const suffix of ['id','name','division','roster','roster_ids','roster_details'])delete next.league_data[`participant_${slot}_${suffix}`];
        }
        await client.query("UPDATE tournament_matches SET score_a=NULL,score_b=NULL,status='pending',participant_a_id=$1,participant_b_id=$2,league_data=$3::jsonb,is_bye=$4 WHERE id=$5",[next.participant_a_id,next.participant_b_id,JSON.stringify(next.league_data),inherited.has(m.id)?false:m.is_bye,m.id]);
      }
      if(program.blocks[0]?.format==='TOURNAMENT')await advancePersistedBracket(client,division.id,1);
      const saved={...program,generationKeys:{...(program.generationKeys??{})}};for(let i=2;i<=program.blocks.length;i++)saved.generationKeys[i]=randomUUID();
      const updated=await client.query('UPDATE tournament_divisions SET league_program=$1::jsonb,updated_at=now() WHERE id=$2 RETURNING updated_at',[JSON.stringify(saved),division.id]);
      result={ok:true,inserted:0,program:{program_data:saved,updated_at:updated.rows[0].updated_at}};
    } else throw Object.assign(conflict('이 작업은 대회 전용 메뉴에서 실행해주세요.'),{statusCode:409});
    if(result?.program)result.program.program_data={...result.program.program_data,tournament_revision:result.program.updated_at instanceof Date?result.program.updated_at.toISOString():String(result.program.updated_at)};
    await client.query('COMMIT');return res.json(result);
  } catch(error) {await client.query('ROLLBACK');console.error('tournament league adapter:',error);return res.status(error.statusCode??500).json({message:error.statusCode?error.message:'대회 프로그램 처리에 실패했습니다.'});}
  finally{client.release();}
});
module.exports=router;
