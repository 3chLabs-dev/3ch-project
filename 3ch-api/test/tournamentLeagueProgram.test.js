const test=require('node:test'),assert=require('node:assert/strict');
const {generateRound,keyFor,leagueMatches,validateProgram,withProgramEstimates}=require('../src/services/tournamentLeagueProgram');

test('unplayed edits request confirmed reconfiguration; scored, playing, completed and later rounds remain protected',()=>{
 const before={blocks:[{type:'SINGLES',format:'LEAGUE',matchRule:'3전 2선승제'}]};
 const after={blocks:[{type:'SINGLES',format:'GROUP',matchRule:'3전 2선승제'}]};
 const pending={program_round:1,status:'pending',score_a:null,score_b:null};
 assert.throws(()=>validateProgram(after,before,[pending]),error=>error.code==='PROGRAM_RECONFIGURATION_REQUIRED'&&error.reconfigureRound===1&&error.canReconfigure===true);
 for(const matches of [[{...pending,status:'playing'}],[{...pending,status:'completed'}],[{...pending,score_a:0}],[pending,{...pending,program_round:2}]]) {
  assert.throws(()=>validateProgram(after,before,matches),error=>error.code==='PROGRAM_RECONFIGURATION_REQUIRED'&&error.canReconfigure===false);
 }
});
const {buildTournamentRoundResult}=require('../src/services/tournamentResults');
const {projectBracketAdvancement}=require('../src/services/tournamentBracket');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tournament={id:uuid(100),application_deadline_at:'2020-01-01'},division={id:uuid(101)};
const participants=Array.from({length:12},(_,i)=>({id:uuid(i+1),name:`선수${i+1}`,member_division:String(i%6+1),club_name:`클럽${i%3}`,source_group_id:uuid(200+i%3),status:'confirmed'}));
const block=(type,format)=>({type,format,title:'1라운드',matchRule:'3전 2선승제',teamPlayerCount:3,teamSinglesCount:3,teamDoublesCount:0,crossClubGrouping:true,
 groupSizes:type==='SINGLES'?[4,4,4]:type==='DOUBLES'?[3,3]:[2,2]});
test('program exports use actual league match/time estimates without mutating persisted configuration',()=>{
 const program={blocks:[block('SINGLES','LEAGUE')],groupSizes:[12]},snapshot=structuredClone(program);
 const result=withProgramEstimates(program,12,3,540);
 assert.equal(result.matchCount,66);assert.ok(result.totalProgramMinutes>0);assert.equal(result.blocks[0].startMinutes,540);assert.deepEqual(program,snapshot);
});
test('virtual BYE participates in league formation without becoming a real participant foreign key',()=>{
 const bye={id:uuid(999),name:'BYE 1',member_division:'',is_bot:true,status:'confirmed'},people=[...participants,bye];
 const rows=generateRound({tournament,division,roundNo:1,program:{blocks:[block('SINGLES','LEAGUE')]},participants:people,matches:[]});
 const real=new Set(participants.map(p=>p.id));assert.ok(rows.length>0);
 assert.ok(rows.every(m=>(!m.participant_a_id||real.has(m.participant_a_id))&&(!m.participant_b_id||real.has(m.participant_b_id))));
});
for(const type of ['SINGLES','DOUBLES','TEAM'])for(const format of ['LEAGUE','GROUP','TOURNAMENT'])test(`${type} ${format}: actual league generator, canonical participants and graph`,()=>{
 const program={blocks:[block(type,format)]};
 const rows=generateRound({tournament,division,roundNo:1,program,participants,matches:[]});
 assert.ok(rows.length);assert.equal(new Set(rows.map(m=>m.id)).size,rows.length);
 assert.ok(rows.every(m=>m.participant_a_id===null||participants.some(p=>p.id===m.participant_a_id)));
 const ids=new Set(rows.map(m=>m.id));assert.ok(rows.every(m=>!m.next_match_id||ids.has(m.next_match_id)));
 const converted=leagueMatches(rows,participants,keyFor(tournament.id,division.id));
 if(type!=='SINGLES')assert.ok(converted.some(m=>m.participant_a_roster?.length>1));
 assert.ok(converted.every(m=>m.participant_a_name===null||m.participant_a_name.includes('선수')));
});
test('upper/lower, first-round settings and half-split use persisted program configuration',()=>{
 const order=participants.map(p=>p.id);
 const split={blocks:[{...block('SINGLES','LEAGUE'),halfSplitOnlyMatches:true,halfSplitMatchOrder:order}]};
 const rows=generateRound({tournament,division,roundNo:1,program:split,participants,matches:[]});
 const half=new Set(order.slice(0,6));
 assert.equal(rows.filter(m=>!m.league_data.is_no_game).length,36);
 assert.ok(rows.filter(m=>!m.league_data.is_no_game).every(m=>half.has(m.participant_a_id)!==half.has(m.participant_b_id)));
 const upperLower=generateRound({tournament,division,roundNo:1,program:{blocks:[{...block('SINGLES','TOURNAMENT'),tournamentMode:'upper-lower'}]},participants,matches:[]});
 assert.ok(upperLower.some(m=>m.bracket==='lower'));assert.ok(upperLower.some(m=>m.loser_next_match_id));
});
test('display/results use the persisted doubles roster and completed scores',()=>{
 const program={blocks:[block('DOUBLES','LEAGUE')]};
 const rows=generateRound({tournament,division,roundNo:1,program,participants,matches:[]}).map(m=>({...m,status:'completed',score_a:2,score_b:0}));
 const original=structuredClone(rows);
 const result=buildTournamentRoundResult({format:'LEAGUE',rules:{match_rule:'BEST_OF_3'}},rows,participants);
 assert.ok(result.complete);assert.equal(result.standings.length,6);assert.ok(result.standings.every(p=>p.name.includes(' · ')));
 assert.deepEqual(rows,original);
});
test('future-round configuration can change without changing persisted completed rounds',()=>{
 const before={blocks:[block('SINGLES','LEAGUE'),block('DOUBLES','GROUP')]};
 const after=structuredClone(before);after.blocks[1].format='TOURNAMENT';
 const saved=[{id:uuid(400),program_round:1,status:'completed',score_a:2,score_b:0}];
 assert.doesNotThrow(()=>validateProgram(after,before,saved));
 after.blocks[0].format='GROUP';assert.throws(()=>validateProgram(after,before,saved),/유지해야/);
});
for(const type of ['SINGLES','DOUBLES','TEAM'])test(`${type} upper/lower progression preserves canonical rosters and resolves persisted edges`,()=>{
 let rows=generateRound({tournament,division,roundNo:1,program:{blocks:[{...block(type,'TOURNAMENT'),tournamentMode:'upper-lower'}]},participants,matches:[]});
 for(let step=0;step<100;step++){
   const match=rows.find(m=>m.status==='pending'&&m.participant_a_id&&m.participant_b_id);
   if(!match)break;
   match.score_a=2;match.score_b=0;match.status='completed';rows=projectBracketAdvancement(rows);
 }
 assert.ok(rows.every(m=>m.status==='completed'),JSON.stringify(rows.filter(m=>m.status!=='completed').map(m=>({id:m.id,a:m.participant_a_id,b:m.participant_b_id}))));
 if(type!=='SINGLES')assert.ok(rows.filter(m=>m.match_label?.includes('결승')).every(m=>m.league_data.participant_a_roster_ids.length>1));
});
test('singles → doubles → team rounds qualify real people from persisted results before forming new units',()=>{
 const program={blocks:[block('SINGLES','GROUP'),{...block('DOUBLES','LEAGUE'),roundOption:'FINAL',finalAdvancementMode:'all'},
   {...block('TEAM','TOURNAMENT'),roundOption:'FINAL',finalAdvancementMode:'all'}]};
 const matches=[];
 for(let roundNo=1;roundNo<=3;roundNo++) {
   const rows=generateRound({tournament,division,roundNo,program,participants,matches});
   assert.ok(rows.some(m=>m.participant_a_id&&m.participant_b_id));
   assert.ok(rows.every(m=>!m.league_data.participant_a_id||!m.league_data.participant_a_id.startsWith('placeholder')));
   matches.push(...rows.map(m=>({...m,status:'completed',score_a:2,score_b:0})));
 }
});
