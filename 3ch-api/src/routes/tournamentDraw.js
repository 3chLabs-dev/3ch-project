// Tournament draw endpoints share the league draw contract with isolated tournament tables.
const express = require('express');
const router = express.Router();
const { tournamentAccess } = require('../utils/tournamentAccess');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');
const { z } = require('zod');
const { buildDrawCode } = require('../utils/clubCodeUtils');
const { randomUUID } = require('crypto');
const { FEATURES, consumeFeatureCredit, refundFeatureCredit } = require('../services/featureUsageService');

// ─────────────────────────────────────────────────────────
// 추첨 (tournament_draws) 독립 라우터  /api/draw/...
// ─────────────────────────────────────────────────────────

// league_code로 요청 시 league UUID로 자동 변환
router.param('leagueId', async (req, _res, next, id) => {
  if (/^[A-Z]{3}\d{6}\d{2}$/.test(id)) {
    try {
      const result = await pool.query('SELECT id FROM tournament_event_context WHERE league_code = $1', [id]);
      if (result.rows.length > 0) req.params.leagueId = result.rows[0].id;
    } catch { /* 변환 실패 시 원본 유지 */ }
  }
  next();
});

// draw_code로 요청 시 draw UUID로 자동 변환
router.param('drawId', async (req, _res, next, id) => {
  if (/^[A-Z]{3}\d{6}\d{4}$/.test(id)) {
    try {
      const result = await pool.query('SELECT id FROM tournament_draws WHERE draw_code = $1', [id]);
      if (result.rows.length > 0) req.params.drawId = result.rows[0].id;
    } catch { /* 변환 실패 시 원본 유지 */ }
  }
  next();
});

router.get('/tournaments/:leagueId/draw', requireAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);
    if (req.body?.new_league_id) return res.status(400).json({ message: '대회 추첨을 다른 대회로 옮길 수 없습니다.' });

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.allowed ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨 목록을 조회할 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT d.id, d.name, d.created_at, d.draw_code, u.name AS creator_name,
              COUNT(DISTINCT dp.id) AS prize_count,
              COALESCE((SELECT SUM(quantity) FROM tournament_draw_prizes WHERE draw_id = d.id), 0) AS total_quantity,
              COALESCE((SELECT json_agg(prize_name ORDER BY display_order) FROM tournament_draw_prizes WHERE draw_id = d.id), '[]'::json) AS prize_names,
              COUNT(DISTINCT dw.id) AS winner_count,
              l.title, l.type, l.start_date
       FROM tournament_draws d
       LEFT JOIN users u ON u.id = d.created_by_id
       LEFT JOIN tournament_draw_prizes dp ON dp.draw_id = d.id
       LEFT JOIN tournament_draw_winners dw ON dw.draw_id = d.id
       LEFT JOIN tournament_event_context l ON l.id = d.tournament_id
       WHERE d.tournament_id = $1
       GROUP BY d.id, d.name, d.created_at, d.draw_code, u.name, l.title, l.type, l.start_date
       ORDER BY d.created_at DESC`,
      [leagueId],
    );

    return res.status(200).json({ draws: result.rows });
  } catch (error) {
    console.error('Error fetching tournament_draws:', error);
    return res.status(500).json({ message: '추첨 목록 조회 중 서버 오류' });
  }
});

router.post('/tournaments/:leagueId/draw', requireAuth, async (req, res) => {
  const client = await pool.connect();
  let quotaRequestKey = null;
  let quotaUserId = null;
  let quotaConsumed = false;
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.manage ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 생성할 권한이 없습니다.' });
    }

    const drawSchema = z.object({
      name: z.string().min(1, '추첨 이름은 필수입니다.'),
      prizes: z.array(z.object({
        prize_name: z.string().min(1, '경품 이름은 필수입니다.'),
        quantity: z.number().int().min(1),
        winners: z.array(z.object({
          participant_name: z.string().min(1),
          participant_division: z.string().optional(),
        })).default([]),
      })).min(1, '경품이 최소 1개 필요합니다.'),
    });

    const { name, prizes } = drawSchema.parse(req.body);

    quotaUserId = userId;
    if (!Number.isFinite(quotaUserId) || quotaUserId <= 0) {
      return res.status(409).json({ message: '사용량을 차감할 계정을 확인할 수 없습니다.', code: 'BILLING_OWNER_NOT_FOUND' });
    }
    const clientRequestKey = String(req.get('Idempotency-Key') || req.body?.idempotency_key || randomUUID())
      .trim()
      .slice(0, 48);
    quotaRequestKey = `draw-create:${quotaUserId}:${leagueId}:${clientRequestKey}`;
    const quota = await consumeFeatureCredit({
      userId: quotaUserId,
      feature: FEATURES.DRAW_CREATE,
      requestKey: quotaRequestKey,
      referenceType: 'TOURNAMENT',
      referenceId: leagueId,
      metadata: { createdById: userId },
    });
    if (!quota.allowed) {
      return res.status(402).json({
        message: '추첨 생성 가능 횟수가 부족합니다.',
        code: 'DRAW_CREATE_QUOTA_EXHAUSTED',
        remaining: 0,
        pricingPath: '/mypage/pricing',
      });
    }
    if (quota.duplicate) {
      return res.status(409).json({
        message: '이미 처리된 추첨 생성 요청입니다.',
        code: 'DUPLICATE_REQUEST',
      });
    }
    quotaConsumed = true;

    await client.query('BEGIN');

    const drawResult = await client.query(
      `INSERT INTO tournament_draws (tournament_id, name, created_by_id) VALUES ($1, $2, $3) RETURNING id`,
      [leagueId, name, userId],
    );
    const drawId = drawResult.rows[0].id;

    // 추첨 코드 생성: {리그코드}{순번2자리}
    const leagueRow = await client.query(`SELECT league_code FROM tournament_event_context WHERE id = $1`, [leagueId]);
    const leagueCode = leagueRow.rows[0]?.league_code;
    if (leagueCode) {
      const seqRow = await client.query(
        `SELECT COUNT(*) AS cnt FROM tournament_draws WHERE tournament_id = $1`,
        [leagueId],
      );
      const seq = parseInt(seqRow.rows[0].cnt, 10); // INSERT 후라서 현재 추첨 포함
      await client.query(`UPDATE tournament_draws SET draw_code = $1 WHERE id = $2`, [buildDrawCode(leagueCode, seq), drawId]);
    }

    for (let i = 0; i < prizes.length; i++) {
      const prize = prizes[i];
      const prizeResult = await client.query(
        `INSERT INTO tournament_draw_prizes (draw_id, prize_name, quantity, display_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [drawId, prize.prize_name, prize.quantity, i],
      );
      const prizeId = prizeResult.rows[0].id;

      for (let j = 0; j < prize.winners.length; j++) {
        const winner = prize.winners[j];
        await client.query(
          `INSERT INTO tournament_draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
          [drawId, prizeId, winner.participant_name, winner.participant_division ?? null, j],
        );
      }
    }

    await client.query('COMMIT');

    const codeRow = await client.query(`SELECT draw_code FROM tournament_draws WHERE id = $1`, [drawId]);
    return res.status(201).json({ message: '추첨이 저장되었습니다.', draw_id: drawId, draw_code: codeRow.rows[0]?.draw_code ?? null });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    if (quotaConsumed && quotaRequestKey && quotaUserId) {
      await refundFeatureCredit({
        userId: quotaUserId,
        feature: FEATURES.DRAW_CREATE,
        requestKey: quotaRequestKey,
        reason: 'DRAW_CREATE_FAILED',
      }).catch((refundError) => console.error('Draw creation quota refund failed:', refundError));
    }
    console.error('Error creating draw:', error);
    return res.status(500).json({ message: '추첨 생성 중 서버 오류' });
  } finally {
    client.release();
  }
});

router.get('/tournaments/:leagueId/draw/:drawId', requireAuth, async (req, res) => {
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.allowed ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 조회할 권한이 없습니다.' });
    }

    const drawResult = await pool.query(
      `SELECT id, name, created_at FROM tournament_draws WHERE id = $1 AND tournament_id = $2`,
      [drawId, leagueId],
    );
    if (drawResult.rows.length === 0) {
      return res.status(404).json({ message: '추첨을 찾을 수 없습니다.' });
    }

    const prizesResult = await pool.query(
      `SELECT dp.id, dp.prize_name, dp.quantity, dp.display_order,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', dw.id,
                    'participant_name', dw.participant_name,
                    'participant_division', dw.participant_division,
                    'display_order', dw.display_order
                  ) ORDER BY dw.display_order
                ) FILTER (WHERE dw.id IS NOT NULL),
                '[]'::json
              ) AS winners
       FROM tournament_draw_prizes dp
       LEFT JOIN tournament_draw_winners dw ON dw.prize_id = dp.id
       WHERE dp.draw_id = $1
       GROUP BY dp.id, dp.prize_name, dp.quantity, dp.display_order
       ORDER BY dp.display_order`,
      [drawId],
    );

    return res.status(200).json({
      draw: drawResult.rows[0],
      prizes: prizesResult.rows,
    });
  } catch (error) {
    console.error('Error fetching draw detail:', error);
    return res.status(500).json({ message: '추첨 조회 중 서버 오류' });
  }
});

router.patch('/tournaments/:leagueId/draw/:drawId', requireAuth, async (req, res) => {
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.manage ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 수정할 권한이 없습니다.' });
    }

    const { name, new_league_id } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: '추첨 이름은 필수입니다.' });
    }

    let result;
    if (new_league_id && new_league_id !== leagueId) {
      // 같은 모임의 리그인지 확인
      const leagueCheck = await pool.query(
        `SELECT l.id FROM tournament_event_context l
         INNER JOIN tournament_event_context curr ON curr.group_id = l.group_id
         WHERE l.id = $1 AND curr.id = $2`,
        [new_league_id, leagueId],
      );
      if (leagueCheck.rowCount === 0) {
        return res.status(400).json({ message: '같은 모임의 리그로만 이동할 수 있습니다.' });
      }
      result = await pool.query(
        `UPDATE tournament_draws SET name = $1, tournament_id = $2 WHERE id = $3 AND tournament_id = $4 RETURNING id, name, created_at`,
        [name.trim(), new_league_id, drawId, leagueId],
      );
    } else {
      result = await pool.query(
        `UPDATE tournament_draws SET name = $1 WHERE id = $2 AND tournament_id = $3 RETURNING id, name, created_at`,
        [name.trim(), drawId, leagueId],
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '추첨을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ message: '추첨이 수정되었습니다.', draw: result.rows[0] });
  } catch (error) {
    console.error('Error updating draw:', error);
    return res.status(500).json({ message: '추첨 수정 중 서버 오류' });
  }
});

router.delete('/tournaments/:leagueId/draw/:drawId', requireAuth, async (req,res) => {
  if (req.body?.confirmation_intent !== 'DELETE_TOURNAMENT_DRAW') return res.status(400).json({ message: '추첨 삭제 확인이 필요합니다.' });
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const rights=await tournamentAccess(client,req.params.leagueId,Number(req.user.sub), 'draw');
    if (!rights.manage) { await client.query('ROLLBACK'); return res.status(403).json({ message: '대회 관리 권한이 필요합니다.' }); }
    const found=await client.query('SELECT id FROM tournament_draws WHERE id=$1 AND tournament_id=$2 FOR UPDATE',[req.params.drawId,req.params.leagueId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: '추첨을 찾을 수 없습니다.' }); }
    await client.query('DELETE FROM tournament_draw_winners WHERE draw_id=$1',[req.params.drawId]);
    await client.query('DELETE FROM tournament_draw_prizes WHERE draw_id=$1',[req.params.drawId]);
    await client.query('DELETE FROM tournament_draws WHERE id=$1 AND tournament_id=$2',[req.params.drawId,req.params.leagueId]);
    await client.query('COMMIT'); return res.json({ message: '추첨을 삭제했습니다.' });
  } catch(error) { await client.query('ROLLBACK'); console.error(error); return res.status(500).json({ message: '추첨을 삭제하지 못했습니다.' }); }
  finally { client.release(); }
});

router.post('/tournaments/:leagueId/draw/:drawId/run', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.manage ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 진행할 권한이 없습니다.' });
    }

    const drawCheck = await pool.query(
      `SELECT id FROM tournament_draws WHERE id = $1 AND tournament_id = $2`,
      [drawId, leagueId],
    );
    if (drawCheck.rows.length === 0) {
      return res.status(404).json({ message: '추첨을 찾을 수 없습니다.' });
    }

    const runSchema = z.object({
      prizes: z.array(z.object({
        prize_name: z.string().min(1, '경품 이름은 필수입니다.'),
        quantity: z.number().int().min(1),
        winners: z.array(z.object({
          participant_name: z.string().min(1),
          participant_division: z.string().optional(),
        })).default([]),
      })).min(1, '경품이 최소 1개 필요합니다.'),
    });

    const { prizes } = runSchema.parse(req.body);

    await client.query('BEGIN');
    await client.query('SELECT id FROM tournament_draws WHERE id=$1 AND tournament_id=$2 FOR UPDATE', [drawId, leagueId]);
    const recorded=await client.query('SELECT id FROM tournament_draw_winners WHERE draw_id=$1 LIMIT 1', [drawId]);
    if (recorded.rowCount && req.body?.confirmation_intent !== 'REPLACE_TOURNAMENT_DRAW_RESULTS') { await client.query('ROLLBACK'); return res.status(409).json({ message: '기존 당첨 결과를 변경하려면 재추첨 확인이 필요합니다.' }); }

    await client.query(`DELETE FROM tournament_draw_winners WHERE draw_id = $1`, [drawId]);
    await client.query(`DELETE FROM tournament_draw_prizes WHERE draw_id = $1`, [drawId]);

    for (let i = 0; i < prizes.length; i++) {
      const prize = prizes[i];
      const prizeResult = await client.query(
        `INSERT INTO tournament_draw_prizes (draw_id, prize_name, quantity, display_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [drawId, prize.prize_name, prize.quantity, i],
      );
      const prizeId = prizeResult.rows[0].id;

      for (let j = 0; j < prize.winners.length; j++) {
        const winner = prize.winners[j];
        await client.query(
          `INSERT INTO tournament_draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
          [drawId, prizeId, winner.participant_name, winner.participant_division ?? null, j],
        );
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({ message: '추첨이 완료되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error running draw:', error);
    return res.status(500).json({ message: '추첨 진행 중 서버 오류' });
  } finally {
    client.release();
  }
});

router.post('/tournaments/:leagueId/draw/:drawId/prizes/:prizeId/winners', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { leagueId, drawId, prizeId } = req.params;
    const userId = Number(req.user.sub);

    const rights = await tournamentAccess(pool, leagueId, userId, 'draw');
    const accessCheck = { rowCount: rights.manage ? 1 : 0, rows: [{ role: 'owner', billing_owner_id: rights.tournament?.created_by_id }] };
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 진행할 권한이 없습니다.' });
    }

    const prizeCheck = await pool.query(
      `SELECT dp.id FROM tournament_draw_prizes dp
       INNER JOIN tournament_draws d ON d.id = dp.draw_id
       WHERE dp.id = $1 AND dp.draw_id = $2 AND d.tournament_id = $3`,
      [prizeId, drawId, leagueId],
    );
    if (prizeCheck.rows.length === 0) {
      return res.status(404).json({ message: '경품을 찾을 수 없습니다.' });
    }

    const winnersSchema = z.object({
      winners: z.array(z.object({
        participant_name: z.string().min(1),
        participant_division: z.string().nullish(),
      })).min(1, '당첨자가 최소 1명 필요합니다.'),
    });

    const { winners } = winnersSchema.parse(req.body);

    await client.query('BEGIN');
    await client.query('SELECT id FROM tournament_draw_prizes WHERE id=$1 AND draw_id=$2 FOR UPDATE', [prizeId, drawId]);
    const recorded=await client.query('SELECT id FROM tournament_draw_winners WHERE prize_id=$1 LIMIT 1', [prizeId]);
    if (recorded.rowCount && req.body?.confirmation_intent !== 'REPLACE_TOURNAMENT_DRAW_WINNERS') { await client.query('ROLLBACK'); return res.status(409).json({ message: '기존 당첨자를 변경하려면 재추첨 확인이 필요합니다.' }); }
    await client.query(`DELETE FROM tournament_draw_winners WHERE prize_id = $1`, [prizeId]);

    for (let j = 0; j < winners.length; j++) {
      const winner = winners[j];
      await client.query(
        `INSERT INTO tournament_draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
        [drawId, prizeId, winner.participant_name, winner.participant_division ?? null, j],
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ message: '추첨이 완료되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error drawing prize winners:', error);
    return res.status(500).json({ message: '추첨 진행 중 서버 오류' });
  } finally {
    client.release();
  }
});

module.exports = router;
