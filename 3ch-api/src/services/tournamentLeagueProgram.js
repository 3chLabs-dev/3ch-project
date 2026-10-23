const { createHash } = require('crypto');
const { generateProgramRoundMatches, generateProgramBlocks } = require('../shared/leagueProgramEngine.cjs');
const { buildTournamentRoundResult } = require('./tournamentResults');
const {entryConfig}=require('./tournamentEntryConfig');
const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
const keyFor = (id, divisionId) => `tournament~${id}~${divisionId}`;
function matchId(divisionId, key) {
  if (/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(key)) return key;
  const hash = createHash('sha256').update(`${divisionId}:${key}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
const statusFor = status => status === 'done' ? 'completed' : status;
const ruleLabel = rule => ({ BEST_OF_3: '3전 2선승제', BEST_OF_5: '5전 3선승제', THREE_SET: '3세트제' }[rule] ?? rule);
function leagueParticipants(rows, key) {
  return rows.filter(p => p.status === 'confirmed').map(p => ({ ...p, league_id: key, division: p.member_division,
    source_group_id: p.source_group_id, source_group_name: p.club_name, paid: true, arrived: false, after: false }));
}
function leagueMatches(rows, participants, key) {
  const people = new Map(participants.map(p => [p.id, p]));
  return rows.filter(m => m.status !== 'cancelled').map(m => {
    const data = m.league_data ?? {};
    const side = slot => {
      const rawId = m[`participant_${slot}_id`];
      const roster = data[`participant_${slot}_roster_ids`] ?? String(data[`participant_${slot}_id`] ?? '').split('+').filter(id=>people.has(id));
      const person = people.get(rawId);
      const members = (roster?.length ? roster : rawId ? [rawId] : []).map(id => people.get(id)).filter(Boolean);
      return {
        [`participant_${slot}_id`]: rawId ? data[`participant_${slot}_id`] ?? rawId : roster.length&&roster.every(id=>people.get(id)?.is_bot) ? data[`participant_${slot}_id`] : null,
        [`participant_${slot}_name`]: data[`participant_${slot}_name`]??(members.length ? members.map(p => p.name).join(' · ') : person?.name ?? null),
        [`participant_${slot}_division`]: members.length>1?String(members.reduce((sum,p)=>sum+(parseInt(p.member_division)||0),0)):members[0]?.member_division??null,
        [`participant_${slot}_club_name`]: [...new Set(members.map(p => p.club_name).filter(Boolean))].join(' · '),
        ...(roster?.length>1 ? { [`participant_${slot}_roster`]: members.map(p=>p.name), [`participant_${slot}_roster_details`]: members.map(p => ({id:p.id,name:p.name,division:p.member_division})) } : {}),
      };
    };
    return { ...data, ...m, id: m.id, league_id: key, ...side('a'), ...side('b'),
      status: m.status === 'completed' ? 'done' : m.status, round_number: m.round_no,
      tournament_bracket_index: m.bracket_index ?? 1, is_program: true,
      program_round: m.program_round ?? 1, match_label: m.phase === 'GROUP' && m.pool_name ? `${m.pool_name}조` : m.match_label,
      court: m.court ?? null, is_no_game: data.is_no_game === true };
  });
}
function programFor(division, rounds, pools, people) {
  if (division.league_program?.deleted) return {title:'직접 구성',compositionMode:'custom',rounds:[],blocks:[],groupSizes:[people.length],matchRule:'3전 2선승제',matchCount:0,expectedMinutes:0,recommendationScore:0,description:'',totalBlockMatchCount:0,totalProgramMinutes:0,isOverTime:false};
  if (division.league_program) return {...structuredClone(division.league_program),tournamentEntryConfig:entryConfig(division)};
  const config = rounds.map((r,index) => ({
    ...(r.rules?.league_config ?? {}), id: index+1, expanded: true, program:r.league_type,
    format:r.format === 'GROUP_TOURNAMENT' ? 'GROUP' : r.format,
    option:r.rules?.league_config?.option??(r.rules?.round_label === '예선' ? 'PRELIM' : index ? 'FINAL' : 'NONE'),
    matchRule:r.rules?.match_rule ?? 'BEST_OF_3', teamPlayerCount:r.rules?.teamPlayerCount ?? 3,
    teamMatchType:r.rules?.teamMatchType ?? 'SSS', teamSinglesCount:r.rules?.teamSinglesCount ?? 3,
    teamDoublesCount:r.rules?.teamDoublesCount ?? 0, tournamentMode:r.rules?.tournament_mode ?? 'single',
    finalAdvancementMode:r.rules?.final_advancement_mode ?? 'all', advanceCount:r.rules?.advance_count ?? 2,
    halfSplitOnlyMatches:r.rules?.half_split_only_matches === true, sourceRoundId:index || undefined,
    crossClubGrouping:true,
  }));
  const blocks = config.map((r,index) => {
    const groups = pools.filter(p => p.round_no === index+1);
    return { ...r, type:r.program, title:`${index+1}라운드`, roundOption:r.option, matchRule:ruleLabel(r.matchRule),
      matchCount:0,expectedMinutes:0, groupSizes:groups.length ? groups.map(p => p.members.length) : [people.length],
      ...(groups.length ? { groupFormationPublished:true, groupFormationCustomized:true,groupFormationSchemaVersion:2,
        groupAssignments:groups.map(p => p.members.map(person => ({id:person.id,name:person.name,level:parseInt(person.member_division)||0,sourceGroupId:person.source_group_id}))) } : {}),
    };
  });
  return { tournamentEntryConfig:entryConfig(division), title:'직접 구성',compositionMode:'custom',rounds:config,blocks,groupSizes:[people.length],matchRule:'3전 2선승제',
    matchCount:0,expectedMinutes:0,recommendationScore:0,description:'',totalBlockMatchCount:0,totalProgramMinutes:0,isOverTime:false };
}
function hasResult(m) { return m.status === 'completed' || m.status === 'playing' || m.score_a != null || m.score_b != null; }
function clearedProgramFormation(program) {
  const clean=structuredClone(program),stamp=new Date().toISOString();
  const fields=['groupAssignments','groupFormationCustomized','groupFormationSchemaVersion','teamAssignments','teamAssignmentModes','teamAssignmentLocks','doublesAssignments','doublesAssignmentModes','doublesAssignmentLocks','participantOrder','participantOrderCustomized','halfSplitMatchOrder','restoredMatchIds','deletedMatchIds'];
  for(const field of fields)delete clean[field];
  delete clean.blueWhiteTeams;
  for(const item of [...clean.blocks,...(clean.rounds??[])]) {
    for(const field of fields)delete item[field];
    item.groupFormationPublished=false;
    item.matchStateResetAt=stamp;
  }
  delete clean.roundStandings;delete clean.roundTieBreaks;
  clean.byeParticipants=[];
  return clean;
}
function validateProgram(program, previous, matches) {
  if (!Array.isArray(program?.blocks) || !program.blocks.length || program.blocks.length>30) throw conflict('라운드 구성을 확인해주세요.');
  if(program.blocks.some(b=>!['SINGLES','DOUBLES','TEAM'].includes(b.type)||!['LEAGUE','GROUP','TOURNAMENT'].includes(b.format)))throw conflict('라운드 유형과 방식을 확인해주세요.');
  for (const m of matches) {
    const index=(m.program_round ?? 1)-1, old=previous.blocks[index], next=program.blocks[index];
    if (!next) throw conflict('기존 경기가 있는 라운드를 삭제할 수 없습니다.');
    // Existing rounds are immutable through ordinary configuration/formation saves.
    const fields=['type','format','matchRule','nextMatchRule','ruleSwitchSize','lateMatchRule','lowerMatchRule','lowerRuleSwitchSize','lowerLateMatchRule','teamPlayerCount','teamFormationSizes','teamSinglesCount','teamDoublesCount','tournamentMode','groupAssignments','teamAssignments','doublesAssignments','groupSizes','teamGroupSizes','halfSplitOnlyMatches','halfSplitMatchOrder','competitionMode','blueWhiteTournamentPlacement','tournamentBracketCount','thirdPlaceMatch'];
    if (fields.some(field => JSON.stringify(old?.[field] ?? null)!==JSON.stringify(next[field] ?? null))) {
      const canReconfigure=!matches.some(row=>(row.program_round??1)>index+1||((row.program_round??1)===index+1&&hasResult(row)));
      throw Object.assign(conflict(canReconfigure
        ? '기존 경기를 유지해야 하므로 미진행 편성을 확인 후 다시 구성해야 합니다.'
        : '진행·완료·점수 또는 후속 라운드가 있는 편성은 유지해야 합니다. 경기 없는 후속 라운드는 수정할 수 있습니다.'),
        {code:'PROGRAM_RECONFIGURATION_REQUIRED',reconfigureRound:index+1,canReconfigure});
    }
  }
}
function generateRound({ tournament, division, roundNo, program, participants, matches }) {
  const previous=matches.filter(m => (m.program_round??1)===roundNo-1 && m.status!=='cancelled');
  if (roundNo>1 && (!previous.length || previous.some(m => m.status!=='completed' && m.status!=='cancelled' && !(m.league_data?.is_no_game && !hasResult(m))))) throw conflict('이전 라운드를 먼저 완료해주세요.');
  let people=leagueParticipants(participants,keyFor(tournament.id,division.id));
  const source=leagueMatches(matches,participants,keyFor(tournament.id,division.id));
  // Persisted matches alone determine later-round qualifications; client snapshots are discarded.
  let authoritative={...program,roundStandings:undefined,roundTieBreaks:program.roundTieBreaks};
  const block=program.blocks[roundNo-1],sourceIndex=program.rounds?.findIndex(r=>r.id===block.sourceRoundId)??-1,sourceRound=block.sourceRoundId?(sourceIndex>=0?sourceIndex+1:block.sourceRoundId):roundNo-1,sourceBlock=program.blocks[sourceRound-1];
  if(roundNo>1&&(!sourceBlock||sourceRound>=roundNo))throw conflict('이전 라운드에서 진출자를 선택해주세요.');
  // A singles ranking cannot be looked up using a newly-created doubles/team key.
  // Qualify the persisted people first, then form the new event's units with the same league engine.
  if(roundNo>1&&sourceBlock?.type!==block.type) {
    const sourceRows=matches.filter(m=>(m.program_round??1)===sourceRound&&m.status!=='cancelled');
    const result=buildTournamentRoundResult({format:sourceBlock.format,rules:{match_rule:({'3세트제':'THREE_SET','3전 2선승제':'BEST_OF_3','5전 3선승제':'BEST_OF_5'}[sourceBlock.matchRule]??sourceBlock.matchRule)}},sourceRows,participants);
    if(!result.complete)throw conflict('진출 기준 라운드의 실제 경기 결과를 먼저 확정해주세요.');
    const pools=result.pools.length?result.pools:result.brackets.length?result.brackets:[result];
    const selected=[];
    for(const pool of pools) {
      const count=block.finalAdvancementMode==='top-n'?Math.max(1,Number(block.advanceCount)||2):pool.standings.length;
      if(pool.standings[count]&&pool.standings[count-1]?.rank===pool.standings[count].rank)throw conflict('진출 경계의 동점 순위를 먼저 확정해주세요.');
      for(const row of pool.standings.slice(0,count))selected.push(...(row.roster?.map(p=>p.id)??[row.id]));
    }
    const qualified=new Set(selected);people=people.filter(p=>qualified.has(p.id));
    const independent={...block,roundOption:'NONE',title:`${roundNo}라운드`};
    authoritative={...authoritative,blocks:program.blocks.map((b,index)=>index===roundNo-1?independent:b),rounds:program.rounds?.map((r,index)=>index===roundNo-1?{...r,option:'NONE'}:r)};
  }
  const generated=generateProgramRoundMatches(keyFor(tournament.id,division.id),authoritative,people,roundNo,source);
  if (!generated.length) throw conflict('편성을 확정하고 진출 인원과 참가자를 확인해주세요.');
  if(generated.some(m=>['a','b'].some(slot=>String(m[`participant_${slot}_id`]??'').startsWith('placeholder'))))throw conflict('이전 라운드의 실제 진출자가 아직 확정되지 않았습니다.');
  const byId=new Map(participants.map(p=>[p.id,p]));
  const persistedId = key => matchId(division.id, program.generationKeys?.[roundNo] ? `${program.generationKeys[roundNo]}:${key}` : key);
  return generated.map((m,index)=>{
    const side=slot=>{
      const id=m[`participant_${slot}_id`];
      const ids=typeof id==='string'?id.split('+').filter(Boolean):[];
      if(ids.some(personId=>!byId.has(personId))&&String(id).startsWith('placeholder'))return null;
      if (ids.some(personId=>!byId.has(personId)||byId.get(personId).status!=='confirmed')) throw conflict('편성에 다른 부문 또는 미확정 참가자가 있습니다.');
      return ids.find(id=>!byId.get(id)?.is_bot)??null;
    };
    return { ...m,id:persistedId(m.id),division_id:division.id,participant_a_id:side('a'),participant_b_id:side('b'),
      phase:program.blocks[roundNo-1].format==='TOURNAMENT'?'TOURNAMENT':'GROUP',
      pool_name:program.blocks[roundNo-1].format==='GROUP' ? String(m.match_label??'').replace(/조.*$/,'') : null,
      program_round:roundNo,round_no:m.round_number??1,match_order:index+1,bracket_index:m.tournament_bracket_index??1,
      next_match_id:m.next_match_id?persistedId(m.next_match_id):null,
      loser_next_match_id:m.loser_next_match_id?persistedId(m.loser_next_match_id):null,
      status:statusFor(m.status),is_bye:m.status==='done'&&(!side('a')||!side('b')),league_data:{...m,client_id:m.id,
        participant_a_roster_ids:String(m.participant_a_id??'').split('+').filter(id=>byId.has(id)),
        participant_b_roster_ids:String(m.participant_b_id??'').split('+').filter(id=>byId.has(id))},
    };
  });
}
function withProgramEstimates(program, peopleCount, courts, startMinutes=0) {
  if(!program.blocks.length)return program;
  const rounds=program.blocks.map((b,i)=>({...b,...program.rounds?.[i],id:program.rounds?.[i]?.id??i+1,program:b.type,format:b.format,option:b.roundOption,matchRule:({'3전 2선승제':'BEST_OF_3','5전 3선승제':'BEST_OF_5','3세트제':'THREE_SET'}[b.matchRule]??b.matchRule)}));
  const estimates=generateProgramBlocks({rounds,singlesEnabled:true,doublesEnabled:true,teamEnabled:true,teamPlayerCount:3,teamMatchRounds:3,programOrder:['SINGLES','DOUBLES','TEAM']},peopleCount,Math.max(1,courts??1),program.groupSizes??[peopleCount]);
  let elapsed=0;
  const blocks=program.blocks.map((b,i)=>{const minutes=estimates[i]?.expectedMinutes??0;const result={...b,matchCount:estimates[i]?.matchCount??0,expectedMinutes:minutes,startMinutes:startMinutes+elapsed,endMinutes:startMinutes+elapsed+minutes};elapsed+=minutes;return result;});
  const count=blocks.reduce((sum,b)=>sum+b.matchCount,0);
  return {...program,blocks,matchCount:count,totalBlockMatchCount:count,expectedMinutes:elapsed,totalProgramMinutes:elapsed};
}
module.exports={matchId,keyFor,statusFor,ruleLabel,leagueParticipants,leagueMatches,programFor,withProgramEstimates,hasResult,validateProgram,generateRound,conflict,clearedProgramFormation};
