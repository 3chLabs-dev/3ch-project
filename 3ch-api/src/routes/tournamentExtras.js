const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const { tournamentAccess } = require('../utils/tournamentAccess');
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
