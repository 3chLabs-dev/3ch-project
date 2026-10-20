const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { tournamentAccess } = require('../utils/tournamentAccess');
const { buildKnockoutBracket, advancePersistedBracket, guardQualifiedSourceResults } = require('../services/tournamentBracket');
const { buildTournamentRoundResult } = require('../services/tournamentResults');
const router = express.Router();

router.get('/tournaments/:id/results', optionalAuth, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: '대회 ID를 확인해주세요.' });
  try {
    const rights = await tournamentAccess(pool, req.params.id, req.user ? Number(req.user.sub) : null);
    if (!rights.allowed) return res.status(404).json({ message: '대회를 찾을 수 없습니다.' });
    const divisions = await pool.query('SELECT * FROM tournament_divisions WHERE tournament_id=$1 ORDER BY sort_order', [req.params.id]);
    const rounds = await pool.query('SELECT r.* FROM tournament_division_rounds r JOIN tournament_divisions d ON d.id=r.division_id WHERE d.tournament_id=$1 ORDER BY r.round_no', [req.params.id]);
    const matches = await pool.query('SELECT m.* FROM tournament_matches m JOIN tournament_divisions d ON d.id=m.division_id WHERE d.tournament_id=$1 ORDER BY m.match_order,m.created_at,m.id', [req.params.id]);
    const participants = await pool.query(`SELECT p.*,COALESCE(g.name,'개인') AS club_name FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id LEFT JOIN groups g ON g.id=p.source_group_id WHERE d.tournament_id=$1`, [req.params.id]);
    return res.json({ divisions: divisions.rows.map((division) => {
      const program = rounds.rows.filter((round) => round.division_id === division.id);
      const divisionMatches = matches.rows.filter((match) => match.division_id === division.id);
      return { ...division, unassigned_match_count: program.length > 1 ? divisionMatches.filter((match) => match.program_round === null).length : 0,
        rounds: program.map((round) => ({ ...round, ...buildTournamentRoundResult(round, divisionMatches.filter((match) => match.program_round === round.round_no || (match.program_round === null && program.length === 1)), participants.rows.filter((person) => person.division_id === division.id)) })) };
    }) });
  } catch (error) { console.error(error); return res.status(500).json({ message: '경기 결과를 불러오지 못했습니다.' }); }
});

router.post('/tournaments/:id/divisions/:divisionId/rounds/:roundNo/bracket', requireAuth, async (req,res) => {
  if (![req.params.id,req.params.divisionId].every((id)=>z.string().uuid().safeParse(id).success) || !/^[1-9]\d*$/.test(req.params.roundNo)) return res.status(400).json({message:'대회 부문과 라운드를 확인해주세요.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const tournament=await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE',[req.params.id]);
    const rights=await tournamentAccess(client,req.params.id,Number(req.user.sub));
    if (!rights.manage) {await client.query('ROLLBACK');return res.status(403).json({message:'대회 관리 권한이 필요합니다.'});}
    const division=await client.query('SELECT id FROM tournament_divisions WHERE id=$1 AND tournament_id=$2 FOR UPDATE',[req.params.divisionId,req.params.id]);
    if (!division.rowCount) {await client.query('ROLLBACK');return res.status(404).json({message:'대회 부문을 찾을 수 없습니다.'});}
    const rounds=await client.query('SELECT * FROM tournament_division_rounds WHERE division_id=$1 ORDER BY round_no',[req.params.divisionId]);
    const roundNo=Number(req.params.roundNo), round=rounds.rows.find((r)=>r.round_no===roundNo);
    if (!round || round.format!=='TOURNAMENT' || round.league_type!=='SINGLES') {await client.query('ROLLBACK');return res.status(409).json({message:'현재 토너먼트 생성은 단식 토너먼트에서 지원합니다.'});}
    const existing=await client.query('SELECT * FROM tournament_matches WHERE division_id=$1 ORDER BY program_round,match_order FOR UPDATE',[req.params.divisionId]);
    if (existing.rows.some((m)=>m.program_round===roundNo || m.program_round===null)) {await client.query('ROLLBACK');return res.status(409).json({message:'기존 대진표가 있어 재생성하지 않습니다. 경기와 결과는 유지됩니다.'});}
    const participants=await client.query("SELECT * FROM tournament_participants WHERE division_id=$1 AND status='confirmed' ORDER BY created_at,id FOR UPDATE",[req.params.divisionId]);
    let entrants=participants.rows;
    if (roundNo===1) {
      if (tournament.rows[0].application_deadline_at && new Date()<new Date(tournament.rows[0].application_deadline_at)) {await client.query('ROLLBACK');return res.status(409).json({message:'참가 신청 마감 후 토너먼트를 생성해주세요.'});}
      const pending=await client.query("SELECT 1 FROM tournament_participants WHERE division_id=$1 AND status='applied' LIMIT 1",[req.params.divisionId]);
      if (pending.rowCount) {await client.query('ROLLBACK');return res.status(409).json({message:'신청 대기자를 모두 처리해주세요.'});}
    } else {
      const previous=rounds.rows.find((r)=>r.round_no===roundNo-1);
      const previousMatches=existing.rows.filter((m)=>m.program_round===roundNo-1);
      const result=previous && buildTournamentRoundResult(previous,previousMatches,participants.rows);
      if (!result?.complete) {await client.query('ROLLBACK');return res.status(409).json({message:'이전 라운드의 모든 경기를 먼저 완료해주세요.'});}
      if (previous.format==='GROUP' && previous.round_no===1) {
        const members=await client.query('SELECT po.id AS pool_id,pm.participant_id FROM tournament_pools po JOIN tournament_pool_members pm ON pm.pool_id=po.id WHERE po.division_id=$1 AND po.round_no=1 ORDER BY po.pool_no,pm.slot_no',[req.params.divisionId]);
        const pools=new Map(); for (const row of members.rows) {if(!pools.has(row.pool_id))pools.set(row.pool_id,[]);pools.get(row.pool_id).push(row.participant_id);}
        const pairs=new Set(previousMatches.filter((m)=>m.status!=='cancelled').map((m)=>[m.participant_a_id,m.participant_b_id].sort().join(':')));
        if (!pools.size || [...pools.values()].some((ids)=>ids.some((a,i)=>ids.slice(i+1).some((b)=>!pairs.has([a,b].sort().join(':')))))) {await client.query('ROLLBACK');return res.status(409).json({message:'예선에 누락된 경기가 있어 진출자를 확정할 수 없습니다.'});}
      }
      let ranked=result.standings;
      if (round.rules?.final_advancement_mode==='top-n') {
        const count=Number(round.rules.advance_count);
        if (!Number.isInteger(count)||count<2) {await client.query('ROLLBACK');return res.status(409).json({message:'토너먼트 진출 인원은 2명 이상이어야 합니다.'});}
        if (ranked[count] && ranked[count-1]?.rank===ranked[count].rank) {await client.query('ROLLBACK');return res.status(409).json({message:'진출 경계의 동점 순위가 확정되지 않았습니다.'});}
        ranked=ranked.slice(0,count);
      }
      entrants=ranked.map((person)=>({...participants.rows.find((p)=>p.id===person.id),source_pool:previousMatches.find((m)=>m.participant_a_id===person.id||m.participant_b_id===person.id)?.pool_name}));
    }
    const bracket=buildKnockoutBracket(entrants,{divisionId:req.params.divisionId,roundNo,mode:round.rules?.tournament_mode??'single'});
    for (const m of bracket) await client.query(`INSERT INTO tournament_matches (id,division_id,program_round,phase,round_no,match_order,participant_a_id,participant_b_id,score_a,score_b,status,bracket,bracket_index,match_label,next_match_id,next_slot,loser_next_match_id,loser_next_slot,is_bye) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,[m.id,m.division_id,m.program_round,m.phase,m.round_no,m.match_order,m.participant_a_id,m.participant_b_id,m.score_a,m.score_b,m.status,m.bracket,m.bracket_index,m.match_label,m.next_match_id,m.next_slot,m.loser_next_match_id,m.loser_next_slot,m.is_bye]);
    await client.query("UPDATE tournament_divisions SET status='locked',updated_at=NOW() WHERE id=$1",[req.params.divisionId]);
    await client.query('COMMIT');return res.status(201).json({match_count:bracket.length});
  } catch(error) {await client.query('ROLLBACK');console.error(error);return res.status(error.statusCode??500).json({message:error.statusCode?error.message:'토너먼트를 생성하지 못했습니다.'});}
  finally {client.release();}
});

// Photo-result imports update only the explicitly selected persisted matches atomically.
router.patch('/tournaments/:id/divisions/:divisionId/rounds/:roundNo/matches/batch-results', requireAuth, async (req,res) => {
  const state = z.object({ score_a:z.number().int().min(0).max(99).nullable(),score_b:z.number().int().min(0).max(99).nullable(),status:z.enum(['pending','playing','completed']),court:z.string().nullable() }).strict();
  const parsed = z.object({matches:z.array(z.object({match_id:z.string().uuid(),score_a:z.number().int().min(0).max(99).optional(),score_b:z.number().int().min(0).max(99).optional(),status:z.enum(['done','playing']).optional(),expected:state}).strict()).min(1).max(2000)}).strict().safeParse(req.body);
  if (!parsed.success || ![req.params.id,req.params.divisionId].every((id)=>z.string().uuid().safeParse(id).success) || !/^\d+$/.test(req.params.roundNo) || Number(req.params.roundNo)<1) return res.status(400).json({message:'저장할 경기 결과를 확인해주세요.'});
  const items=parsed.data.matches;
  if (new Set(items.map((m)=>m.match_id)).size!==items.length) return res.status(400).json({message:'중복된 경기입니다.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const rights=await tournamentAccess(client,req.params.id,Number(req.user.sub));
    if (!rights.manage) {await client.query('ROLLBACK');return res.status(403).json({message:'대회 관리 권한이 필요합니다.'});}
    await client.query('SELECT id FROM tournament_divisions WHERE id=$1 AND tournament_id=$2 FOR UPDATE',[req.params.divisionId,req.params.id]);
    const saved=await client.query(`SELECT m.* FROM tournament_matches m JOIN tournament_divisions d ON d.id=m.division_id
      WHERE d.tournament_id=$1 AND d.id=$2 AND m.id=ANY($3::uuid[]) AND (m.program_round=$4 OR (m.program_round IS NULL AND (SELECT COUNT(*) FROM tournament_division_rounds r WHERE r.division_id=d.id)=1)) ORDER BY m.id FOR UPDATE OF m`,[req.params.id,req.params.divisionId,items.map((m)=>m.match_id),Number(req.params.roundNo)]);
    if (saved.rows.length!==items.length) {await client.query('ROLLBACK');return res.status(409).json({message:'현재 부문과 라운드의 경기 명단이 변경되었습니다.'});}
    for (const item of items) {
      const match=saved.rows.find((m)=>m.id===item.match_id);
      if (match.status==='cancelled' || (match.status==='completed' && item.status==='playing') || ['score_a','score_b','status','court'].some((key)=>(match[key]??null)!==item.expected[key])) {await client.query('ROLLBACK');return res.status(409).json({message:'경기 결과가 변경되어 전체 저장을 중단했습니다. 최신 기록을 확인해주세요.'});}
      const next={...match,...(item.score_a!==undefined?{score_a:item.score_a}:{}),...(item.score_b!==undefined?{score_b:item.score_b}:{}),...(item.status?{status:item.status==='done'?'completed':item.status}:{})};
      await guardQualifiedSourceResults(client,match,next);
      if (next.status==='completed' && (next.score_a===null || next.score_b===null)) {await client.query('ROLLBACK');return res.status(400).json({message:'양쪽 점수가 필요합니다.'});}
    }
    for (const item of items) {
      const match=saved.rows.find((m)=>m.id===item.match_id);
      await client.query('UPDATE tournament_matches SET score_a=$1,score_b=$2,status=$3 WHERE id=$4',[item.score_a??match.score_a,item.score_b??match.score_b,item.status==='done'?'completed':item.status??match.status,match.id]);
    }
    if (saved.rows.some((m)=>m.phase==='TOURNAMENT')) await advancePersistedBracket(client,req.params.divisionId,Number(req.params.roundNo));
    await client.query('COMMIT');return res.json({updated:items.length});
  } catch(error) {await client.query('ROLLBACK');console.error(error);return res.status(error.statusCode??500).json({message:error.statusCode?error.message:'경기 결과 저장에 실패했습니다.'});}
  finally {client.release();}
});

router.patch('/tournaments/:id/matches/:matchId', requireAuth, async (req, res) => {
  const state = z.object({ score_a: z.number().int().min(0).max(99).nullable(), score_b: z.number().int().min(0).max(99).nullable(), status: z.enum(['pending','playing','completed']), court: z.string().max(40).nullable() }).strict();
  const parsed = z.object({ expected: state, updates: z.object({ score_a: z.number().int().min(0).max(99).optional(), score_b: z.number().int().min(0).max(99).optional(), status: z.enum(['playing','completed']).optional(), court: z.string().max(40).nullable().optional() }).strict() }).strict().safeParse(req.body);
  if (!parsed.success || ![req.params.id,req.params.matchId].every((id) => z.string().uuid().safeParse(id).success)) return res.status(400).json({ message: '경기 입력을 확인해주세요.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await tournamentAccess(client, req.params.id, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    await client.query('SELECT d.id FROM tournament_divisions d JOIN tournament_matches m ON m.division_id=d.id WHERE m.id=$1 AND d.tournament_id=$2 FOR UPDATE OF d', [req.params.matchId,req.params.id]);
    const saved = await client.query('SELECT m.* FROM tournament_matches m JOIN tournament_divisions d ON d.id=m.division_id WHERE m.id=$1 AND d.tournament_id=$2 FOR UPDATE OF m', [req.params.matchId,req.params.id]);
    const match = saved.rows[0];
    if (!match) { await client.query('ROLLBACK'); return res.status(404).json({ message: '경기를 찾을 수 없습니다.' }); }
    const { expected, updates } = parsed.data;
    if (['score_a','score_b','status','court'].some((key) => (match[key] ?? null) !== expected[key])) { await client.query('ROLLBACK'); return res.status(409).json({ message: '다른 사용자가 경기를 수정했습니다. 최신 기록을 다시 확인해주세요.' }); }
    if (match.status === 'cancelled' || (match.status === 'completed' && updates.status && updates.status !== 'completed')) { await client.query('ROLLBACK'); return res.status(409).json({ message: '완료되거나 취소된 경기는 초기화할 수 없습니다.' }); }
    const next = { ...match, ...updates };
    if (next.status === 'completed' && (next.score_a === null || next.score_b === null)) { await client.query('ROLLBACK'); return res.status(400).json({ message: '양쪽 점수를 입력해주세요.' }); }
    await guardQualifiedSourceResults(client,match,next);
    const result = await client.query('UPDATE tournament_matches SET score_a=$1,score_b=$2,status=$3,court=$4 WHERE id=$5 RETURNING *', [next.score_a,next.score_b,next.status,next.court ?? null,match.id]);
    if (next.phase==='TOURNAMENT' && next.program_round!=null) await advancePersistedBracket(client,next.division_id,next.program_round);
    await client.query('COMMIT'); return res.json({ match: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return res.status(error.statusCode??500).json({ message: error.statusCode?error.message:'경기 저장에 실패했습니다.' }); }
  finally { client.release(); }
});

// Explicit, append-only creation from persisted first-round pool assignments.
router.post('/tournaments/:id/divisions/:divisionId/matches/generate', requireAuth, async (req, res) => {
  if (![req.params.id, req.params.divisionId].every((id) => z.string().uuid().safeParse(id).success)) return res.status(400).json({ message: '부문을 확인해주세요.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM tournaments WHERE id=$1 FOR UPDATE', [req.params.id]);
    const rights = await tournamentAccess(client, req.params.id, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    const rounds = await client.query('SELECT r.* FROM tournament_division_rounds r JOIN tournament_divisions d ON d.id=r.division_id WHERE d.tournament_id=$1 AND d.id=$2 ORDER BY r.round_no FOR UPDATE OF d,r', [req.params.id, req.params.divisionId]);
    const round = rounds.rows[0];
    if (!round || round.round_no !== 1 || round.league_type !== 'SINGLES' || !['GROUP','GROUP_TOURNAMENT'].includes(round.format)) {
      await client.query('ROLLBACK'); return res.status(409).json({ message: '현재 확정 조 기반 경기 생성은 1라운드 단식 조별리그에서 지원합니다.' });
    }
    const existing = await client.query('SELECT id FROM tournament_matches WHERE division_id=$1 AND (program_round=1 OR program_round IS NULL) LIMIT 1', [req.params.divisionId]);
    if (existing.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '기존 경기가 있어 재생성하지 않습니다. 저장된 경기와 결과는 유지됩니다.' }); }
    const assignments = await client.query(`SELECT po.id AS pool_id, po.pool_no, pm.participant_id FROM tournament_pools po JOIN tournament_pool_members pm ON pm.pool_id=po.id WHERE po.division_id=$1 AND po.round_no=1 ORDER BY po.pool_no,pm.slot_no`, [req.params.divisionId]);
    const { buildPoolMatchSchedule } = require('../services/tournamentMatchSchedule');
    const schedule = buildPoolMatchSchedule(assignments.rows);
    if (!schedule.length) { await client.query('ROLLBACK'); return res.status(409).json({ message: '확정된 조에 경기 가능한 참가자가 없습니다.' }); }
    for (const [index, match] of schedule.entries()) await client.query(`INSERT INTO tournament_matches (division_id,program_round,phase,pool_name,round_no,match_order,participant_a_id,participant_b_id) VALUES ($1,1,'GROUP',$2,1,$3,$4,$5)`, [req.params.divisionId, String(match.pool_no), index + 1, match.a, match.b]);
    await client.query('COMMIT');
    return res.status(201).json({ match_count: schedule.length });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return res.status(500).json({ message: '경기를 생성하지 못했습니다.' }); }
  finally { client.release(); }
});

router.post('/tournaments/:id/participants/manual', requireAuth, async (req, res) => {
  const parsed = z.object({ group_id: z.string().min(1).nullable(), rows: z.array(z.object({ division_id: z.string().uuid(), name: z.string().trim().min(1).max(120), member_division: z.string().trim().min(1).max(40), member_id: z.number().int().positive().nullable().optional(), pre_member_id: z.string().uuid().nullable().optional() }).strict()).min(1).max(500) }).strict().safeParse(req.body);
  if (!z.string().uuid().safeParse(req.params.id).success || !parsed.success) return res.status(400).json({ message: '참가자의 부문, 이름, 대회 부수를 입력해주세요.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await tournamentAccess(client, req.params.id, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return res.status(403).json({ message: '주최자만 참가자를 직접 등록할 수 있습니다.' }); }
    const tournament = await client.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE', [req.params.id]);
    const divisions = await client.query('SELECT id FROM tournament_divisions WHERE tournament_id=$1 ORDER BY sort_order FOR UPDATE', [req.params.id]);
    const body = parsed.data;
    if (body.rows.some((row) => !divisions.rows.some((division) => division.id === row.division_id))) { await client.query('ROLLBACK'); return res.status(400).json({ message: '대회 부문을 확인해주세요.' }); }
    if (body.group_id) {
      const group = await client.query('SELECT id FROM groups WHERE id=$1', [body.group_id]);
      if (!group.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽을 찾을 수 없습니다.' }); }
    }
    const existing = await client.query(`SELECT p.* FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id WHERE d.tournament_id=$1 AND p.status IN ('applied','confirmed') FOR UPDATE OF p`, [req.params.id]);
    if (tournament.rows[0].recruit_count && existing.rowCount + body.rows.length > tournament.rows[0].recruit_count) { await client.query('ROLLBACK'); return res.status(409).json({ message: '총 모집 인원을 초과했습니다.' }); }
    const ids = [...new Set(body.rows.map((row) => row.division_id))];
    const competition = await client.query('SELECT 1 FROM tournament_pools WHERE division_id=ANY($1::uuid[]) UNION ALL SELECT 1 FROM tournament_matches WHERE division_id=ANY($1::uuid[]) LIMIT 1', [ids]);
    if (competition.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 또는 경기가 생성된 부문은 참가자를 추가할 수 없습니다.' }); }
    const keys = new Set(existing.rows.map((row) => `${row.source_group_id ?? ''}:${row.name}`));
    const identities = new Set(existing.rows.flatMap((row) => [row.member_id ? `user:${row.member_id}` : null, row.pre_member_id ? `pre:${row.pre_member_id}` : null].filter(Boolean)));
    for (const row of body.rows) {
      const key = `${body.group_id ?? ''}:${row.name}`;
      if (keys.has(key) || row.member_id && existing.rows.some((saved) => saved.member_id === row.member_id) || row.pre_member_id && existing.rows.some((saved) => saved.pre_member_id === row.pre_member_id)) { await client.query('ROLLBACK'); return res.status(409).json({ message: `${row.name}: 이미 등록된 참가자입니다.` }); }
      keys.add(key);
      if (row.member_id || row.pre_member_id) {
        const found = row.pre_member_id
          ? await client.query("SELECT name,linked_user_id AS member_id FROM group_pre_members WHERE id=$1 AND group_id=$2 AND status='active'", [row.pre_member_id, body.group_id])
          : await client.query("SELECT COALESCE(NULLIF(u.name,''),u.nickname) AS name,u.id AS member_id FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 AND gm.user_id=$2 AND u.deleted_at IS NULL", [body.group_id, row.member_id]);
        if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: '클럽 회원 명단이 변경되었습니다.' }); }
        row.name = found.rows[0].name; row.member_id = found.rows[0].member_id;
      }
      const identity = row.member_id ? `user:${row.member_id}` : row.pre_member_id ? `pre:${row.pre_member_id}` : null;
      if (identity && identities.has(identity)) { await client.query('ROLLBACK'); return res.status(409).json({ message: `${row.name}: 이미 등록된 참가자입니다.` }); }
      if (identity) identities.add(identity);
    }
    for (const row of body.rows) await client.query("INSERT INTO tournament_participants(division_id,name,member_division,source_group_id,member_id,pre_member_id,status) VALUES($1,$2,$3,$4,$5,$6,'applied')", [row.division_id,row.name,row.member_division,body.group_id,row.member_id ?? null,row.pre_member_id ?? null]);
    await client.query('COMMIT'); return res.status(201).json({ message: '참가자를 대기 상태로 등록했습니다.' });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return res.status(500).json({ message: '참가자를 등록하지 못했습니다.' }); }
  finally { client.release(); }
});
router.post('/tournaments/:id/participants/:participantId/withdraw', requireAuth, async (req, res) => {
  const ids = z.object({ id: z.string().uuid(), participantId: z.string().uuid() }).safeParse(req.params);
  if (!ids.success || req.body?.confirmation_intent !== 'WITHDRAW_TOURNAMENT_PARTICIPANT') return res.status(400).json({ message: '참가 취소 확인이 필요합니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rights = await tournamentAccess(client, ids.data.id, Number(req.user.sub));
    if (!rights.manage) { await client.query('ROLLBACK'); return res.status(403).json({ message: '주최자만 참가자를 취소할 수 있습니다.' }); }
    await client.query('SELECT id FROM tournaments WHERE id=$1 FOR UPDATE', [ids.data.id]);
    const found = await client.query('SELECT p.* FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id WHERE d.tournament_id=$1 AND p.id=$2 FOR UPDATE OF d,p', [ids.data.id, ids.data.participantId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '참가자를 찾을 수 없습니다.' }); }
    const linked = await client.query('SELECT 1 FROM tournament_pool_members WHERE participant_id=$1 UNION ALL SELECT 1 FROM tournament_matches WHERE participant_a_id=$1 OR participant_b_id=$1 LIMIT 1', [ids.data.participantId]);
    if (linked.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ message: '조 배정이나 경기가 있는 참가자는 이 화면에서 취소할 수 없습니다.' }); }
    await client.query("UPDATE tournament_participants SET status='withdrawn' WHERE id=$1 AND status IN ('applied','confirmed')", [ids.data.participantId]);
    await client.query('COMMIT'); return res.json({ message: '참가 신청을 취소했습니다.' });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return res.status(500).json({ message: '참가자를 취소하지 못했습니다.' }); }
  finally { client.release(); }
});
module.exports = router;
