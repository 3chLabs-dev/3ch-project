const { validateTournamentEntrySettings } = require('./tournamentEntryPolicy');
const conflict = message => Object.assign(new Error(message), { statusCode: 409 });

function leagueProgramEntryReset(pool, onReset = async () => {}) {
  return async (req, res) => {
    if (req.body?.confirmation_intent !== 'RESET_LEAGUE_PROGRAM_FOR_EDIT' || !Array.isArray(req.body.expected_matches)) return res.status(400).json({ message: '프로그램과 경기 결과 초기화 확인이 필요합니다.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const league = await client.query(`SELECT l.id FROM leagues l JOIN group_members gm ON gm.group_id=l.group_id
        WHERE l.id=$1 AND gm.user_id=$2 AND (gm.role='owner' OR (gm.role='admin' AND COALESCE((gm.management_permissions->>'league')::boolean,false))) FOR UPDATE OF l`, [req.params.id, Number(req.user.sub)]);
      if (!league.rowCount) { await client.query('ROLLBACK'); return res.status(403).json({ message: '프로그램 관리 권한이 필요합니다.' }); }
      const program = req.body.program_data;
      if (!Array.isArray(program?.blocks) || !program.blocks.length) throw conflict('프로그램 구성을 확인해주세요.');
      validateTournamentEntrySettings(program);
      const previous = await client.query('SELECT * FROM league_programs WHERE league_id=$1 FOR UPDATE', [req.params.id]);
      const revision = previous.rows[0]?.updated_at;
      if (revision && new Date(revision).toISOString() !== req.body.expected_program_updated_at) throw conflict('프로그램이 변경되었습니다. 새로고침 후 다시 확인해주세요.');
      const matches = await client.query('SELECT * FROM league_matches WHERE league_id=$1 AND is_program=TRUE ORDER BY id FOR UPDATE', [req.params.id]);
      const expected = req.body.expected_matches.filter(match => match.is_program);
      const fields = ['status','score_a','score_b','court','match_order','program_round','next_match_id','next_slot','loser_next_match_id','loser_next_slot'];
      if (expected.length !== matches.rows.length || new Set(expected.map(match => match.id)).size !== expected.length
        || matches.rows.some(match => {
          const saved = expected.find(item => item.id === match.id);
          return !saved || fields.some(field => (match[field] ?? null) !== (saved[field] ?? null)) || ['a','b'].some(side => {
            const roster = match[`participant_${side}_roster_ids`];
            const identity = roster?.length ? roster.join('+') : match[`participant_${side}_id`] ?? null;
            return identity !== (saved[`participant_${side}_id`] ?? null);
          });
        })) throw conflict('경기 기록이 변경되었습니다. 최신 기록을 확인한 후 다시 초기화해주세요.');
      const participants = await client.query('SELECT * FROM league_participants WHERE league_id=$1 ORDER BY id', [req.params.id]);
      await client.query('INSERT INTO league_program_entry_reset_audit(league_id,actor_id,snapshot) VALUES($1,$2,$3::jsonb)', [req.params.id, Number(req.user.sub), JSON.stringify({ program: previous.rows, matches: matches.rows, participants: participants.rows })]);
      const clean = structuredClone(program);
      delete clean.roundStandings; delete clean.roundTieBreaks;
      for (const item of [...clean.blocks, ...(clean.rounds ?? [])]) {
        for (const field of ['tournamentSelectedIds','restoredMatchIds','deletedMatchIds']) delete item[field];
        item.matchStateResetAt = new Date().toISOString();
      }
      await client.query('DELETE FROM league_matches WHERE league_id=$1 AND is_program=TRUE', [req.params.id]);
      const result = await client.query(`INSERT INTO league_programs(league_id,program_data,created_by_id) VALUES($1,$2::jsonb,$3)
        ON CONFLICT(league_id) DO UPDATE SET program_data=EXCLUDED.program_data,updated_at=NOW() RETURNING *`, [req.params.id, JSON.stringify(clean), Number(req.user.sub)]);
      await client.query('COMMIT');
      await onReset(req.params.id).catch(() => {});
      return res.json({ program: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(error.statusCode ?? 500).json({ message: error.statusCode ? error.message : '프로그램 초기화를 저장하지 못했습니다. 기존 기록은 보존됩니다.' });
    } finally { client.release(); }
  };
}
module.exports = { leagueProgramEntryReset };
