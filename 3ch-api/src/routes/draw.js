const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');
const { z } = require('zod');

// ─────────────────────────────────────────────────────────
// 추첨 (draws) 독립 라우터  /api/draw/...
// ─────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Draw
 *   description: 추첨 관리 API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DrawListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         creator_name:
 *           type: string
 *         prize_count:
 *           type: integer
 *         winner_count:
 *           type: integer
 *     DrawWinner:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         participant_name:
 *           type: string
 *         participant_division:
 *           type: string
 *           nullable: true
 *         display_order:
 *           type: integer
 *     DrawPrize:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         prize_name:
 *           type: string
 *         quantity:
 *           type: integer
 *         display_order:
 *           type: integer
 *         winners:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DrawWinner'
 */

/**
 * @swagger
 * /draw/{leagueId}:
 *   get:
 *     summary: 추첨 목록 조회
 *     description: 해당 리그의 추첨 목록을 조회합니다. 클럽 멤버 전체 가능.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 추첨 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draws:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DrawListItem'
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/draw/:leagueId', requireAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT 1 FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨 목록을 조회할 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT d.id, d.name, d.created_at, u.name AS creator_name,
              COUNT(DISTINCT dp.id) AS prize_count,
              COUNT(DISTINCT dw.id) AS winner_count
       FROM draws d
       LEFT JOIN users u ON u.id = d.created_by_id
       LEFT JOIN draw_prizes dp ON dp.draw_id = d.id
       LEFT JOIN draw_winners dw ON dw.draw_id = d.id
       WHERE d.league_id = $1
       GROUP BY d.id, d.name, d.created_at, u.name
       ORDER BY d.created_at DESC`,
      [leagueId],
    );

    return res.status(200).json({ draws: result.rows });
  } catch (error) {
    console.error('Error fetching draws:', error);
    return res.status(500).json({ message: '추첨 목록 조회 중 서버 오류' });
  }
});

/**
 * @swagger
 * /draw/{leagueId}:
 *   post:
 *     summary: 추첨 생성
 *     description: 경품 및 당첨자를 포함한 추첨을 생성합니다. owner/admin 전용.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - prizes
 *             properties:
 *               name:
 *                 type: string
 *                 description: 추첨 이름
 *               prizes:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - prize_name
 *                     - quantity
 *                   properties:
 *                     prize_name:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     winners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - participant_name
 *                         properties:
 *                           participant_name:
 *                             type: string
 *                           participant_division:
 *                             type: string
 *     responses:
 *       201:
 *         description: 추첨 생성 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 draw_id:
 *                   type: string
 *       400:
 *         description: 유효성 검사 실패
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/draw/:leagueId', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT gm.role FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
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

    await client.query('BEGIN');

    const drawResult = await client.query(
      `INSERT INTO draws (league_id, name, created_by_id) VALUES ($1, $2, $3) RETURNING id`,
      [leagueId, name, userId],
    );
    const drawId = drawResult.rows[0].id;

    for (let i = 0; i < prizes.length; i++) {
      const prize = prizes[i];
      const prizeResult = await client.query(
        `INSERT INTO draw_prizes (draw_id, prize_name, quantity, display_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [drawId, prize.prize_name, prize.quantity, i],
      );
      const prizeId = prizeResult.rows[0].id;

      for (let j = 0; j < prize.winners.length; j++) {
        const winner = prize.winners[j];
        await client.query(
          `INSERT INTO draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
          [drawId, prizeId, winner.participant_name, winner.participant_division ?? null, j],
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({ message: '추첨이 저장되었습니다.', draw_id: drawId });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error creating draw:', error);
    return res.status(500).json({ message: '추첨 생성 중 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /draw/{leagueId}/{drawId}:
 *   get:
 *     summary: 추첨 상세 조회
 *     description: 특정 추첨의 경품 및 당첨자 정보를 조회합니다. 클럽 멤버 전체 가능.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리그 ID
 *       - in: path
 *         name: drawId
 *         required: true
 *         schema:
 *           type: string
 *         description: 추첨 ID
 *     responses:
 *       200:
 *         description: 추첨 상세
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draw:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 prizes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DrawPrize'
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 추첨 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/draw/:leagueId/:drawId', requireAuth, async (req, res) => {
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT 1 FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 조회할 권한이 없습니다.' });
    }

    const drawResult = await pool.query(
      `SELECT id, name, created_at FROM draws WHERE id = $1 AND league_id = $2`,
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
       FROM draw_prizes dp
       LEFT JOIN draw_winners dw ON dw.prize_id = dp.id
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

/**
 * @swagger
 * /draw/{leagueId}/{drawId}:
 *   patch:
 *     summary: 추첨 수정
 *     description: 추첨 이름을 수정하거나 다른 리그로 이동합니다. owner/admin 전용.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리그 ID
 *       - in: path
 *         name: drawId
 *         required: true
 *         schema:
 *           type: string
 *         description: 추첨 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: 추첨 이름
 *               new_league_id:
 *                 type: string
 *                 description: 이동할 리그 ID (같은 모임 내 리그만 가능)
 *     responses:
 *       200:
 *         description: 수정 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 draw:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 유효성 오류 또는 다른 모임의 리그로 이동 시도
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 추첨 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/draw/:leagueId/:drawId', requireAuth, async (req, res) => {
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT gm.role FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
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
        `SELECT l.id FROM leagues l
         INNER JOIN leagues curr ON curr.group_id = l.group_id
         WHERE l.id = $1 AND curr.id = $2`,
        [new_league_id, leagueId],
      );
      if (leagueCheck.rowCount === 0) {
        return res.status(400).json({ message: '같은 모임의 리그로만 이동할 수 있습니다.' });
      }
      result = await pool.query(
        `UPDATE draws SET name = $1, league_id = $2 WHERE id = $3 AND league_id = $4 RETURNING id, name, created_at`,
        [name.trim(), new_league_id, drawId, leagueId],
      );
    } else {
      result = await pool.query(
        `UPDATE draws SET name = $1 WHERE id = $2 AND league_id = $3 RETURNING id, name, created_at`,
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

/**
 * @swagger
 * /draw/{leagueId}/{drawId}:
 *   delete:
 *     summary: 추첨 삭제
 *     description: 추첨을 삭제합니다. owner/admin 전용.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *         description: 리그 ID
 *       - in: path
 *         name: drawId
 *         required: true
 *         schema:
 *           type: string
 *         description: 추첨 ID
 *     responses:
 *       200:
 *         description: 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 추첨 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/draw/:leagueId/:drawId', requireAuth, async (req, res) => {
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT gm.role FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 삭제할 권한이 없습니다.' });
    }

    const delResult = await pool.query(
      `DELETE FROM draws WHERE id = $1 AND league_id = $2 RETURNING id`,
      [drawId, leagueId],
    );
    if (delResult.rows.length === 0) {
      return res.status(404).json({ message: '추첨을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ message: '추첨이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting draw:', error);
    return res.status(500).json({ message: '추첨 삭제 중 서버 오류' });
  }
});

/**
 * @swagger
 * /draw/{leagueId}/{drawId}/run:
 *   post:
 *     summary: 추첨 진행 (당첨자 저장)
 *     description: 대기 중인 추첨에 당첨자를 저장합니다. owner/admin 전용.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: drawId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prizes
 *             properties:
 *               prizes:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - prize_name
 *                     - quantity
 *                   properties:
 *                     prize_name:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     winners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - participant_name
 *                         properties:
 *                           participant_name:
 *                             type: string
 *                           participant_division:
 *                             type: string
 *     responses:
 *       200:
 *         description: 추첨 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 유효성 검사 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 추첨 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/draw/:leagueId/:drawId/run', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { leagueId, drawId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT gm.role FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 진행할 권한이 없습니다.' });
    }

    const drawCheck = await pool.query(
      `SELECT id FROM draws WHERE id = $1 AND league_id = $2`,
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

    await client.query(`DELETE FROM draw_winners WHERE draw_id = $1`, [drawId]);
    await client.query(`DELETE FROM draw_prizes WHERE draw_id = $1`, [drawId]);

    for (let i = 0; i < prizes.length; i++) {
      const prize = prizes[i];
      const prizeResult = await client.query(
        `INSERT INTO draw_prizes (draw_id, prize_name, quantity, display_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [drawId, prize.prize_name, prize.quantity, i],
      );
      const prizeId = prizeResult.rows[0].id;

      for (let j = 0; j < prize.winners.length; j++) {
        const winner = prize.winners[j];
        await client.query(
          `INSERT INTO draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
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

/**
 * @swagger
 * /draw/{leagueId}/{drawId}/prizes/{prizeId}/winners:
 *   post:
 *     summary: 경품 개별 추첨 (당첨자 저장)
 *     description: 특정 경품의 당첨자를 저장합니다. owner/admin 전용.
 *     tags: [Draw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: drawId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: prizeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - winners
 *             properties:
 *               winners:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - participant_name
 *                   properties:
 *                     participant_name:
 *                       type: string
 *                     participant_division:
 *                       type: string
 *                       nullable: true
 *     responses:
 *       200:
 *         description: 추첨 완료
 *       400:
 *         description: 유효성 검사 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 경품 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/draw/:leagueId/:drawId/prizes/:prizeId/winners', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { leagueId, drawId, prizeId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT gm.role FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '추첨을 진행할 권한이 없습니다.' });
    }

    const prizeCheck = await pool.query(
      `SELECT dp.id FROM draw_prizes dp
       INNER JOIN draws d ON d.id = dp.draw_id
       WHERE dp.id = $1 AND dp.draw_id = $2 AND d.league_id = $3`,
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
    await client.query(`DELETE FROM draw_winners WHERE prize_id = $1`, [prizeId]);

    for (let j = 0; j < winners.length; j++) {
      const winner = winners[j];
      await client.query(
        `INSERT INTO draw_winners (draw_id, prize_id, participant_name, participant_division, display_order) VALUES ($1, $2, $3, $4, $5)`,
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
