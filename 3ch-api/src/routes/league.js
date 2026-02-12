const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     League:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - type
 *         - sport
 *         - start_date
 *         - created_by_id
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 리그의 고유 식별자
 *         name:
 *           type: string
 *           description: 리그 이름
 *         description:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 선택적 설명
 *         type:
 *           type: string
 *           description: "리그 유형 (예: 단식, 복식, 3인 팀)"
 *         sport:
 *           type: string
 *           description: 리그가 생성된 스포츠
 *         start_date:
 *           type: string
 *           format: date-time
 *           description: "리그 시작일 및 시간"
 *         rules:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 사용자 지정 규칙
 *         status:
 *           type: string
 *           enum: [draft, active, completed]
 *           default: draft
 *           description: 리그의 현재 상태
 *         created_by_id:
 *           type: integer
 *           description: 리그를 생성한 사용자의 ID
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 리그 생성 타임스탬프
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 리그 최종 업데이트 타임스탬프
 *     CreateLeagueRequest:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - sport
 *         - start_date
 *       properties:
 *         name:
 *           type: string
 *           description: 리그 이름
 *         description:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 선택적 설명
 *         type:
 *           type: string
 *           description: "리그 유형 (예: 단식, 복식, 3인 팀)"
 *         sport:
 *           type: string
 *           description: 리그가 생성된 스포츠
 *         start_date:
 *           type: string
 *           format: date-time
 *           description: "리그 시작일 및 시간"
 *         rules:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 사용자 지정 규칙
 *     UpdateLeagueRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: 리그 이름
 *         description:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 선택적 설명
 *         type:
 *           type: string
 *           description: "리그 유형 (예: 단식, 복식, 3인 팀)"
 *         sport:
 *           type: string
 *           description: 리그가 생성된 스포츠
 *         start_date:
 *           type: string
 *           format: date-time
 *           description: "리그 시작일 및 시간"
 *         rules:
 *           type: string
 *           nullable: true
 *           description: 리그에 대한 사용자 지정 규칙
 *         status:
 *           type: string
 *           enum: [draft, active, completed]
 *           description: 리그의 현재 상태
 */

// Initial comment block for the entire league router
/**
 * @swagger
 * tags:
 *   name: 리그
 *   description: 리그 관리 API
 */

const createLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다'),
  description: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다'),
  sport: z.string().min(1, '스포츠 종목은 필수입니다'),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 날짜 형식이어야 합니다'),
  rules: z.string().optional(),
  recruit_count: z.number().int().min(0).default(0),
  participant_count: z.number().int().min(0).default(0),
  group_id: z.string().uuid('올바른 모임 ID 형식이어야 합니다').optional(),
});

const updateLeagueSchema = z.object({
  name: z.string().min(1, '리그 이름은 필수입니다').optional(),
  description: z.string().optional(),
  type: z.string().min(1, '리그 유형은 필수입니다').optional(),
  sport: z.string().min(1, '스포츠 종목은 필수입니다').optional(),
  start_date: z.string().datetime('시작일은 올바른 ISO 8601 날짜 형식이어야 합니다').optional(),
  rules: z.string().optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
});

// JSDoc for GET /league (list)
/**
 * @swagger
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
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *         description: 스포츠 종목 필터
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed]
 *         description: 리그 상태 필터
 *     responses:
 *       200:
 *         description: 리그 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leagues:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/League'
 *                       - type: object
 *                         properties:
 *                           creator_name:
 *                             type: string
 *                           team_count:
 *                             type: integer
 *                           player_count:
 *                             type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       500:
 *         description: 내부 서버 오류
 */
router.get('/league', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
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

    // my_groups=true: 내가 속한 모임의 리그만 조회 (user_id 필요)
    if (req.query.my_groups === 'true' && req.query.user_id) {
      conditions.push(`l.group_id IN (SELECT group_id FROM group_members WHERE user_id = $${paramIndex++})`);
      params.push(parseInt(req.query.user_id));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leagues l ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

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
      listParams
    );

    res.status(200).json({
      leagues: result.rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

// JSDoc for POST /league
/**
 * @swagger
 * /league:
 *   post:
 *     summary: 새 리그 생성
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLeagueRequest'
 *     responses:
 *       201:
 *         description: 리그가 성공적으로 생성되었습니다
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 리그가 성공적으로 생성되었습니다
 *                 league:
 *                   $ref: '#/components/schemas/League'
 *       400:
 *         description: 잘못된 입력
 *       401:
 *         description: 인증되지 않음
 *       500:
 *         description: 내부 서버 오류
 */
router.post('/league', requireAuth, async (req, res) => {
  try {
    const { name, description, type, sport, start_date, rules, recruit_count, participant_count, group_id } = createLeagueSchema.parse(req.body);
    const userId = req.user.sub;
    const leagueId = randomUUID();

    const result = await pool.query(
      `INSERT INTO leagues (id, name, description, type, sport, start_date, rules, recruit_count, participant_count, group_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, type, sport, recruit_count, participant_count, group_id, created_at;`,
      [leagueId, name, description, type, sport, start_date, rules, recruit_count, participant_count, group_id || null, userId]
    );

    res.status(201).json({
      message: '리그가 성공적으로 생성되었습니다',
      league: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error creating league:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

// JSDoc for GET /league/:id
/**
 * @swagger
 * /league/{id}:
 *   get:
 *     summary: ID로 리그 상세 정보 조회
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: 조회할 리그의 ID
 *     responses:
 *       200:
 *         description: 리그 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 league:
 *                   $ref: '#/components/schemas/League'
 *       401:
 *         description: 인증되지 않음
 *       404:
 *         description: 리그를 찾을 수 없습니다
 *       500:
 *         description: 내부 서버 오류
 */
router.get('/league/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, description, type, sport, start_date, rules, status, created_by_id, created_at, updated_at
       FROM leagues
       WHERE id = $1;`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다' });
    }

    res.status(200).json({
      league: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching league:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

// JSDoc for PUT /league/:id
/**
 * @swagger
 * /league/{id}:
 *   put:
 *     summary: 리그 상세 정보 업데이트
 *     tags: [리그]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: 업데이트할 리그의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLeagueRequest'
 *     responses:
 *       200:
 *         description: 리그가 성공적으로 업데이트되었습니다
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 리그가 성공적으로 업데이트되었습니다
 *                 league:
 *                   $ref: '#/components/schemas/League'
 *       400:
 *         description: 잘못된 입력 또는 업데이트할 필드가 제공되지 않았습니다
 *       401:
 *         description: 인증되지 않음
 *       404:
 *         description: 리그를 찾을 수 없습니다
 *       500:
 *         description: 내부 서버 오류
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
      return res.status(400).json({ message: '업데이트할 필드가 제공되지 않았습니다' });
    }

    values.push(id);
    const updateQuery = `
      UPDATE leagues
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${queryIndex}
      RETURNING id, name, description, type, sport, start_date, rules, status, created_by_id, created_at, updated_at;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '리그를 찾을 수 없습니다' });
    }

    res.status(200).json({
      message: '리그가 성공적으로 업데이트되었습니다',
      league: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error updating league:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

module.exports = router;
