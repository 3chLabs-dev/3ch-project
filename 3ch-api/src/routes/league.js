const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const participantSchema = z.object({
  division: z.string().default(''),
  name: z.string().min(1, '참가자 이름은 필수입니다.'),
  paid: z.boolean().default(false),
  arrived: z.boolean().default(false),
  after: z.boolean().default(false),
});

/**
 * @openapi
 * tags:
 *   name: 리그
 *   description: 리그 생성/조회/수정 및 참가자 관리 API
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     League:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *         format:
 *           type: string
 *           nullable: true
 *         sport:
 *           type: string
 *         start_date:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [draft, active, completed]
 *         rules:
 *           type: string
 *           nullable: true
 *         notice:
 *           type: string
 *           nullable: true
 *         recruit_count:
 *           type: integer
 *         participant_count:
 *           type: integer
 *         group_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *     LeagueParticipant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         division:
 *           type: string
 *         paid:
 *           type: boolean
 *         arrived:
 *           type: boolean
 *         after:
 *           type: boolean
 *         sort_order:
 *           type: integer
 *           nullable: true
 *     LeagueMatch:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         match_order:
 *           type: integer
 *         participant_a_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         participant_b_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         participant_a_name:
 *           type: string
 *           nullable: true
 *         participant_a_division:
 *           type: string
 *           nullable: true
 *         participant_b_name:
 *           type: string
 *           nullable: true
 *         participant_b_division:
 *           type: string
 *           nullable: true
 *         score_a:
 *           type: integer
 *           nullable: true
 *         score_b:
 *           type: integer
 *           nullable: true
 *         court:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [pending, playing, done]
 */

const createLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다.'),
  description: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다.'),
  format: z.string().optional(),
  sport: z.string().min(1, '스포츠 종목은 필수입니다.'),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 형식이어야 합니다.'),
  rules: z.string().optional(),
  sort_order: z.string().optional(),
  recruit_count: z.number().int().min(0).default(0),
  participant_count: z.number().int().min(0).default(0),
  group_id: z.string().uuid('클럽 ID 형식이 올바르지 않습니다.'),
  participants: z.array(participantSchema).default([]),
});

const updateLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다.').optional(),
  description: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다.').optional(),
  format: z.string().optional(),
  sport: z.string().min(1, '스포츠 종목은 필수입니다.').optional(),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 형식이어야 합니다.').optional(),
  rules: z.string().optional(),
  notice: z.string().optional(),
  sort_order: z.string().optional(),
  recruit_count: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
});

/**
 * GET /league
 * 리그 목록 조회
 */
/**
 * @openapi
 * /league:
 *   get:
 *     summary: 리그 목록 조회
 *     tags: [리그]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지당 항목 수 (최대 50)
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         description: 종목 필터
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed]
 *         description: 상태 필터
 *       - in: query
 *         name: group_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 특정 클럽의 리그만 조회
 *       - in: query
 *         name: my_groups
 *         schema:
 *           type: boolean
 *         description: user_id 기준 내가 속한 클럽의 리그만 조회
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: my_groups=true일 때 필요한 사용자 ID
 *     responses:
 *       200:
 *         description: 리그 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get('/league', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (req.query.sport) {
      conditions.push(`l.sport = $${paramIndex++}`);
      params.push(req.query.sport);
    }
    if (req.query.status) {
      conditions.push(`l.status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.group_id) {
      conditions.push(`l.group_id = $${paramIndex++}`);
      params.push(req.query.group_id);
    }
    if (req.query.my_groups === 'true' && req.query.user_id) {
      conditions.push(`l.group_id IN (SELECT group_id FROM group_members WHERE user_id = $${paramIndex++})`);
      params.push(parseInt(req.query.user_id, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leagues l ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT l.id, l.name, l.description, l.type, l.sport, l.start_date, l.status,
              l.recruit_count, l.participant_count, l.group_id, l.created_at,
              u.name AS creator_name,
              g.name AS group_name
       FROM leagues l
       LEFT JOIN users u ON l.created_by_id = u.id
       LEFT JOIN groups g ON l.group_id = g.id
       ${whereClause}
       ORDER BY l.start_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      listParams,
    );

    return res.status(200).json({
      leagues: result.rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return res.status(500).json({ message: '리그 목록 조회 중 서버 오류' });
  }
});

/**
 * POST /league
 * 리그 생성
 * 인증 필요. 리그와 참가자 정보를 한 트랜잭션으로 저장합니다.
 */
/**
 * @openapi
 * /league:
 *   post:
 *     summary: 리그 생성
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, sport, start_date, group_id]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               sport:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               rules:
 *                 type: string
 *               recruit_count:
 *                 type: integer
 *               participant_count:
 *                 type: integer
 *               group_id:
 *                 type: string
 *                 format: uuid
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     division:
 *                       type: string
 *                     name:
 *                       type: string
 *                     paid:
 *                       type: boolean
 *                     arrived:
 *                       type: boolean
 *                     after:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: 리그 생성 성공
 *       400:
 *         description: 검증 오류
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/league', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      description,
      type,
      format,
      sport,
      start_date,
      rules,
      sort_order,
      recruit_count,
      participant_count,
      group_id,
      participants,
    } = createLeagueSchema.parse(req.body);

    const userId = req.user.sub;

    const roleCheck = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [group_id, userId],
    );

    if (roleCheck.rows.length === 0 || !['owner', 'admin'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ message: '리그 생성 권한이 없습니다. 리더 또는 운영진만 가능합니다.' });
    }

    const leagueId = randomUUID();

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO leagues (id, name, description, type, format, sport, start_date, rules, sort_order, recruit_count, participant_count, group_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, name, description, type, format, sport, start_date, status, rules, notice, sort_order, recruit_count, participant_count, group_id, created_at, updated_at;`,
      [leagueId, name, description, type, format, sport, start_date, rules, sort_order ?? null, recruit_count, participant_count, group_id, userId],
    );

    for (const p of participants) {
      await client.query(
        `INSERT INTO league_participants (id, league_id, division, name, paid, arrived, "after")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), leagueId, p.division ?? '', p.name, p.paid ?? false, p.arrived ?? false, p.after ?? false],
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: '리그가 성공적으로 생성되었습니다.',
      league: result.rows[0],
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error creating league:', error);
    return res.status(500).json({ message: '리그 생성 중 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * GET /league/:id/participants
 * 리그 참가자 목록 조회
 * 인증 필요. 해당 리그가 속한 클럽의 멤버만 조회 가능합니다.
 */
/**
 * @openapi
 * /league/{id}/participants:
 *   get:
 *     summary: 리그 참가자 목록 조회
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 참가자 목록 조회 성공
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/league/:id/participants', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT 1
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [id, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '해당 리그 참가자 목록을 조회할 권한이 없습니다.' });
    }

    const result = await pool.query(
      `SELECT id, league_id, division, name, paid, arrived, "after", sort_order, created_at
       FROM league_participants
       WHERE league_id = $1
       ORDER BY sort_order ASC NULLS LAST, division ASC, created_at ASC`,
      [id],
    );

    return res.status(200).json({ participants: result.rows });
  } catch (error) {
    console.error('Error fetching league participants:', error);
    return res.status(500).json({ message: '리그 참가자 조회 중 서버 오류' });
  }
});

/**
 * POST /league/:leagueId/participants
 * 참가자 추가 (관리자용 수기입력 / 클럽 회원 불러오기)
 */
/**
 * @openapi
 * /league/{leagueId}/participants:
 *   post:
 *     summary: 참가자 추가
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participants]
 *             properties:
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     division:
 *                       type: string
 *                     name:
 *                       type: string
 *     responses:
 *       201:
 *         description: 참가자 추가 성공
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/league/:leagueId/participants', requireAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    // 권한 확인: 해당 클럽의 owner 또는 admin만 가능
    const authCheck = await pool.query(
      `SELECT gm.role
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner','admin')`,
      [leagueId, userId],
    );
    if (authCheck.rowCount === 0) {
      return res.status(403).json({ message: '참가자를 추가할 권한이 없습니다.' });
    }

    const rawParticipants = req.body.participants;
    if (!Array.isArray(rawParticipants) || rawParticipants.length === 0) {
      return res.status(400).json({ message: '참가자 목록이 비어있습니다.' });
    }

    const addSchema = z.array(z.object({
      division: z.string().default(''),
      name: z.string().min(1, '이름은 필수입니다.'),
    }));
    const participants = addSchema.parse(rawParticipants);

    const inserted = [];
    for (const p of participants) {
      const result = await pool.query(
        `INSERT INTO league_participants (id, league_id, division, name, paid, arrived, "after")
         VALUES ($1, $2, $3, $4, false, false, false)
         RETURNING id, league_id, division, name, paid, arrived, "after", created_at`,
        [randomUUID(), leagueId, p.division, p.name],
      );
      inserted.push(result.rows[0]);
    }

    // participant_count 실수 기반으로 갱신
    await pool.query(
      `UPDATE leagues SET participant_count = (
         SELECT COUNT(*) FROM league_participants WHERE league_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [leagueId],
    );

    return res.status(201).json({ message: '참가자가 추가되었습니다.', participants: inserted });
  } catch (error) {
    console.error('Add participants error:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * GET /league/:id
 * 리그 상세 조회 (참가자 목록 포함)
 */
/**
 * @openapi
 * /league/{id}:
 *   get:
 *     summary: 리그 상세 조회 (참가자 목록 포함)
 *     description: 리그의 기본 정보와 참가자 목록을 함께 조회합니다. 추첨 등에 활용할 수 있습니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 리그 상세 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 league:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     type:
 *                       type: string
 *                     sport:
 *                       type: string
 *                     start_date:
 *                       type: string
 *                       format: date-time
 *                     rules:
 *                       type: string
 *                     status:
 *                       type: string
 *                     recruit_count:
 *                       type: integer
 *                     participant_count:
 *                       type: integer
 *                     group_id:
 *                       type: string
 *                     created_by_id:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       league_id:
 *                         type: string
 *                       division:
 *                         type: string
 *                       name:
 *                         type: string
 *                       paid:
 *                         type: boolean
 *                       arrived:
 *                         type: boolean
 *                       after:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/league/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 리그 정보 조회
    const leagueResult = await pool.query(
      `SELECT id, name, description, type, format, sport, start_date, rules, status,
              recruit_count, participant_count, group_id, created_by_id, created_at, updated_at
       FROM leagues
       WHERE id = $1`,
      [id],
    );

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    // 참가자 목록 조회
    const participantsResult = await pool.query(
      `SELECT id, league_id, division, name, paid, arrived, "after", created_at
       FROM league_participants
       WHERE league_id = $1
       ORDER BY division ASC, created_at ASC`,
      [id],
    );

    return res.status(200).json({
      league: leagueResult.rows[0],
      participants: participantsResult.rows
    });
  } catch (error) {
    console.error('Error fetching league:', error);
    return res.status(500).json({ message: '리그 조회 중 서버 오류' });
  }
});

/**
 * PUT /league/:id
 * 리그 수정
 */
/**
 * @openapi
 * /league/{id}:
 *   put:
 *     summary: 리그 수정
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               sport:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               rules:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, completed]
 *     responses:
 *       200:
 *         description: 리그 수정 성공
 *       400:
 *         description: 검증 오류/수정 항목 없음
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/league/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = updateLeagueSchema.parse(req.body);

    const fields = [];
    const values = [];
    let queryIndex = 1;

    for (const key in updates) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${queryIndex}`);
        values.push(updates[key]);
        queryIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: '수정할 항목이 없습니다.' });
    }

    values.push(id);
    const updateQuery = `
      UPDATE leagues
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${queryIndex}
      RETURNING id, name, description, type, format, sport, start_date, rules, notice, sort_order, status, recruit_count, participant_count, created_by_id, created_at, updated_at;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      message: '리그가 성공적으로 수정되었습니다.',
      league: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error updating league:', error);
    return res.status(500).json({ message: '리그 수정 중 서버 오류' });
  }
});

/**
 * PUT /league/:leagueId/participants/:participantId
 * 리그 참가자 정보 수정
 * 인증 필요. 해당 리그가 속한 클럽의 owner 또는 admin만 수정 가능합니다.
 */
/**
 * @openapi
 * /league/{leagueId}/participants/{participantId}:
 *   put:
 *     summary: 리그 참가자 정보 수정
 *     description: 참가자의 부수, 이름, 입금/도착/뒷풀이 상태를 수정합니다. 클럽의 owner 또는 admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 참가자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               division:
 *                 type: string
 *                 description: 부수
 *               name:
 *                 type: string
 *                 description: 참가자 이름
 *               paid:
 *                 type: boolean
 *                 description: 입금 완료 여부
 *               arrived:
 *                 type: boolean
 *                 description: 도착 완료 여부
 *               footPool:
 *                 type: boolean
 *                 description: 뒷풀이 참여 여부
 *     responses:
 *       200:
 *         description: 참가자 정보 수정 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 참가자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put('/league/:leagueId/participants/:participantId', requireAuth, async (req, res) => {
  try {
    const { leagueId, participantId } = req.params;
    const userId = Number(req.user.sub);

    // 권한 확인: 클럽 멤버(owner, admin, member) 모두 가능
    const accessCheck = await pool.query(
      `SELECT 1
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '참가자를 수정할 권한이 없습니다.' });
    }

    // 업데이트할 필드 검증
    const updateSchema = z.object({
      division: z.string().optional(),
      name: z.string().min(1, '이름은 필수입니다.').optional(),
      paid: z.boolean().optional(),
      arrived: z.boolean().optional(),
      after: z.boolean().optional(),
    });

    const updates = updateSchema.parse(req.body);

    const fields = [];
    const values = [];
    let queryIndex = 1;

    for (const key in updates) {
      if (updates[key] !== undefined) {
        const dbKey = key;
        fields.push(`${dbKey} = $${queryIndex}`);
        values.push(updates[key]);
        queryIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: '수정할 항목이 없습니다.' });
    }

    values.push(participantId);
    values.push(leagueId);

    const updateQuery = `
      UPDATE league_participants
      SET ${fields.join(', ')}
      WHERE id = $${queryIndex} AND league_id = $${queryIndex + 1}
      RETURNING id, league_id, division, name, paid, arrived, "after", created_at;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '참가자를 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      message: '참가자 정보가 수정되었습니다.',
      participant: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }

    console.error('Error updating participant:', error);
    return res.status(500).json({ message: '참가자 수정 중 서버 오류' });
  }
});

/**
 * DELETE /league/:leagueId/participants/:participantId
 * 리그 참가자 삭제
 * 인증 필요. 해당 리그가 속한 클럽의 owner 또는 admin만 삭제 가능합니다.
 */
/**
 * @openapi
 * /league/{leagueId}/participants/{participantId}:
 *   delete:
 *     summary: 리그 참가자 삭제
 *     description: 리그 참가자 1명을 삭제합니다. 클럽의 owner 또는 admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 참가자 ID
 *     responses:
 *       200:
 *         description: 참가자 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 참가자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.delete('/league/:leagueId/participants/:participantId', requireAuth, async (req, res) => {
  try {
    const { leagueId, participantId } = req.params;
    const userId = Number(req.user.sub);

    // 권한 확인:
    const accessCheck = await pool.query(
      `SELECT 1
      FROM leagues l
      INNER JOIN group_members gm ON gm.group_id = l.group_id
      WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '참가자를 삭제할 권한이 없습니다.' });
    }

    // 참가자 삭제 (리그 아이디도 추가 체크)
    const delResult = await pool.query(
      `DELETE FROM league_participants
      WHERE id = $1 AND league_id = $2
      RETURNING id, league_id, division, name, paid, arrived, "after", created_at;`,
      [participantId, leagueId],
    );

    if (delResult.rows.length === 0) {
      return res.status(404).json({ message: '참가자를 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      message: '참가자가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Error deleting participant:', error);
    return res.status(500).json({ message: '참가자 삭제 중 서버 오류' });
  }
});

/**
 * @openapi
 * /league/{leagueId}:
 *   delete:
 *     summary: 리그 삭제
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 리그 삭제 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 리그 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/league/:leagueId', requireAuth, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = Number(req.user.sub);

    const accessCheck = await pool.query(
      `SELECT 1
       FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '리그를 삭제할 권한이 없습니다.' });
    }

    const result = await pool.query(
      `DELETE FROM leagues WHERE id = $1 RETURNING id`,
      [leagueId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
    }

    return res.status(200).json({ message: '리그가 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting league:', error);
    return res.status(500).json({ message: '리그 삭제 중 서버 오류' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 경기 순서 (league_matches)
// ─────────────────────────────────────────────────────────────────────────────

function generateRoundRobin(n) {
  const games = [];
  const size = n % 2 === 0 ? n : n + 1;
  const pos = Array.from({ length: size }, (_, i) => i);
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const p1 = pos[i];
      const p2 = pos[size - 1 - i];
      if (p1 < n && p2 < n) games.push([p1, p2]);
    }
    const last = pos.splice(size - 1, 1)[0];
    pos.splice(1, 0, last);
  }
  return games;
}

/**
 * @openapi
 * /league/{id}/matches:
 *   get:
 *     summary: 경기 목록 조회
 *     description: 리그의 경기 순서 목록을 조회합니다. 클럽 멤버만 접근 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     responses:
 *       200:
 *         description: 경기 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeagueMatch'
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// GET /league/:id/matches - 경기 목록 조회 (클럽 멤버)
router.get('/league/:id/matches', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '접근 권한이 없습니다.' });

    const result = await pool.query(
      `SELECT
         m.id, m.match_order, m.score_a, m.score_b, m.court, m.status,
         m.participant_a_id, m.participant_b_id,
         pa.name AS participant_a_name, pa.division AS participant_a_division,
         pb.name AS participant_b_name, pb.division AS participant_b_division
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.league_id = $1
       ORDER BY m.match_order ASC`,
      [leagueId],
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error fetching matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/init:
 *   post:
 *     summary: 라운드로빈 경기 자동 생성
 *     description: 참가자 목록을 기반으로 라운드로빈 경기를 자동 생성합니다. force=true 시 기존 경기 삭제 후 재생성합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *         description: true이면 기존 경기를 삭제하고 재생성
 *     responses:
 *       200:
 *         description: 경기 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeagueMatch'
 *       400:
 *         description: 이미 경기 존재 또는 참가자 부족
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// POST /league/:id/matches/init - 라운드로빈 경기 생성 (owner/admin)
router.post('/league/:id/matches/init', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const force = req.query.force === 'true';
    const existing = await pool.query(
      `SELECT id FROM league_matches WHERE league_id = $1 LIMIT 1`,
      [leagueId],
    );
    if (existing.rowCount > 0) {
      if (!force) return res.status(400).json({ message: '이미 경기가 생성되어 있습니다.' });
      await pool.query(`DELETE FROM league_matches WHERE league_id = $1`, [leagueId]);
    }

    const participants = await pool.query(
      `SELECT id FROM league_participants WHERE league_id = $1 ORDER BY sort_order ASC NULLS LAST, division ASC, created_at ASC`,
      [leagueId],
    );
    const ids = participants.rows.map((r) => r.id);
    if (ids.length < 2) return res.status(400).json({ message: '참가자가 2명 이상이어야 합니다.' });

    const pairs = generateRoundRobin(ids.length);
    const values = pairs.map((pair, i) => `('${randomUUID()}', '${leagueId}', ${i + 1}, '${ids[pair[0]]}', '${ids[pair[1]]}')`).join(', ');
    await pool.query(
      `INSERT INTO league_matches (id, league_id, match_order, participant_a_id, participant_b_id) VALUES ${values}`,
    );

    const result = await pool.query(
      `SELECT
         m.id, m.match_order, m.score_a, m.score_b, m.court, m.status,
         m.participant_a_id, m.participant_b_id,
         pa.name AS participant_a_name, pa.division AS participant_a_division,
         pb.name AS participant_b_name, pb.division AS participant_b_division
       FROM league_matches m
       LEFT JOIN league_participants pa ON pa.id = m.participant_a_id
       LEFT JOIN league_participants pb ON pb.id = m.participant_b_id
       WHERE m.league_id = $1
       ORDER BY m.match_order ASC`,
      [leagueId],
    );
    return res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error initializing matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/participants/reorder:
 *   patch:
 *     summary: 참가자 순서 변경
 *     description: 참가자 ID 배열을 새 순서로 전달하면 sort_order를 일괄 업데이트합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order]
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 새 순서로 정렬된 참가자 ID 배열
 *     responses:
 *       200:
 *         description: 순서 저장 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: order 배열 누락
 *       403:
 *         description: 권한 없음 (owner/admin 아님)
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/participants/reorder - 씨드 순서 저장 (owner/admin)
router.patch('/league/:id/participants/reorder', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const { order } = req.body; // string[] - participant IDs in new order
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order 배열이 필요합니다.' });
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        await client.query(
          `UPDATE league_participants SET sort_order = $1 WHERE id = $2 AND league_id = $3`,
          [i + 1, order[i], leagueId],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error reordering participants:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/reorder:
 *   patch:
 *     summary: 경기 순서 변경
 *     description: 경기 ID 배열을 새 순서로 전달하면 match_order를 일괄 업데이트합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order]
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 새 순서로 정렬된 경기 ID 배열
 *     responses:
 *       200:
 *         description: 순서 변경 성공
 *       400:
 *         description: order 배열 누락
 *       403:
 *         description: 권한 없음
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/matches/reorder - 순서 변경 (owner/admin)
router.patch('/league/:id/matches/reorder', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const { order } = req.body; // string[]
  if (!Array.isArray(order)) return res.status(400).json({ message: 'order 배열이 필요합니다.' });
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < order.length; i++) {
        await client.query(
          `UPDATE league_matches SET match_order = $1 WHERE id = $2 AND league_id = $3`,
          [i + 1, order[i], leagueId],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error reordering matches:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/{matchId}:
 *   patch:
 *     summary: 경기 점수/코트/상태 수정
 *     description: 경기의 점수, 코트, 상태를 부분 업데이트합니다. 클럽 멤버 전체 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 경기 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score_a:
 *                 type: integer
 *               score_b:
 *                 type: integer
 *               court:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [pending, playing, done]
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 match:
 *                   $ref: '#/components/schemas/LeagueMatch'
 *       400:
 *         description: 변경 필드 없음
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 경기 없음
 *       500:
 *         description: 서버 오류
 */
// PATCH /league/:id/matches/:matchId - 점수/코트/상태 업데이트 (클럽 멤버)
router.patch('/league/:id/matches/:matchId', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const matchId = req.params.matchId;
  const { score_a, score_b, court, status } = req.body;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const fields = [];
    const vals = [];
    if (score_a !== undefined) { fields.push(`score_a = $${vals.length + 1}`); vals.push(score_a); }
    if (score_b !== undefined) { fields.push(`score_b = $${vals.length + 1}`); vals.push(score_b); }
    if (court !== undefined) { fields.push(`court = $${vals.length + 1}`); vals.push(court); }
    if (status !== undefined) { fields.push(`status = $${vals.length + 1}`); vals.push(status); }
    if (fields.length === 0) return res.status(400).json({ message: '변경할 필드가 없습니다.' });

    vals.push(matchId, leagueId);
    const result = await pool.query(
      `UPDATE league_matches SET ${fields.join(', ')} WHERE id = $${vals.length - 1} AND league_id = $${vals.length} RETURNING *`,
      vals,
    );
    if (result.rowCount === 0) return res.status(404).json({ message: '경기를 찾을 수 없습니다.' });
    return res.json({ match: result.rows[0] });
  } catch (err) {
    console.error('Error updating match:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /league/{id}/matches/{matchId}:
 *   delete:
 *     summary: 경기 삭제
 *     description: 경기를 삭제하고 나머지 경기의 match_order를 재정렬합니다. owner/admin만 가능합니다.
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 리그 ID
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 경기 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 경기 없음
 *       500:
 *         description: 서버 오류
 */
// DELETE /league/:id/matches/:matchId - 경기 삭제 (owner/admin)
router.delete('/league/:id/matches/:matchId', requireAuth, async (req, res) => {
  const userId = Number(req.user.sub);
  const leagueId = req.params.id;
  const matchId = req.params.matchId;
  try {
    const access = await pool.query(
      `SELECT l.id FROM leagues l
       INNER JOIN group_members gm ON gm.group_id = l.group_id
       WHERE l.id = $1 AND gm.user_id = $2 AND gm.role IN ('owner', 'admin')`,
      [leagueId, userId],
    );
    if (access.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const del = await pool.query(
      `DELETE FROM league_matches WHERE id = $1 AND league_id = $2 RETURNING id`,
      [matchId, leagueId],
    );
    if (del.rowCount === 0) return res.status(404).json({ message: '경기를 찾을 수 없습니다.' });

    // match_order 재정렬
    await pool.query(
      `UPDATE league_matches SET match_order = sub.rn
       FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY match_order) AS rn FROM league_matches WHERE league_id = $1) sub
       WHERE league_matches.id = sub.id`,
      [leagueId],
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting match:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
