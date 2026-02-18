const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');
const { requireGroupAdmin, requireGroupOwner } = require('../middlewares/permissions');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: 클럽
 *   description: 클럽 관리 API - 클럽 생성, 가입, 멤버 관리 등
 */

const createGroupSchema = z.object({
  name: z.string().min(1, '클럽 이름은 필수입니다'),
  description: z.string().optional(),
  sport: z.string().optional(),
  region_city: z.string().optional(),
  region_district: z.string().optional(),
  founded_at: z.string().optional(),
});

/**
 * @openapi
 * /group/check-name:
 *   get:
 *     summary: 클럽명 중복 검사
 *     description: 클럽 생성 시 클럽명이 이미 사용 중인지 확인합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: 확인할 클럽명
 *     responses:
 *       200:
 *         description: 중복 검사 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: 사용 가능 여부
 *       400:
 *         description: 클럽명이 제공되지 않음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/check-name', requireAuth, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '클럽명을 입력해주세요' });
    }

    const result = await pool.query(
      `SELECT id FROM groups WHERE name = $1`,
      [name.trim()]
    );

    const available = result.rows.length === 0;
    res.status(200).json({ available });
  } catch (error) {
    console.error('Error checking group name:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group:
 *   post:
 *     summary: 클럽 생성
 *     description: 새로운 클럽을 생성합니다. 생성자는 자동으로 owner 역할을 부여받습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
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
 *                 description: 클럽명
 *               description:
 *                 type: string
 *                 description: 클럽 설명
 *               sport:
 *                 type: string
 *                 description: 종목 (예 탁구, 배드민턴, 테니스)
 *               type:
 *                 type: string
 *                 description: 종류 (예 동호회, 학교, 직장, 지역)
 *               region_city:
 *                 type: string
 *                 description: 지역(시/도)
 *               region_district:
 *                 type: string
 *                 description: 지역(구/군)
 *               founded_at:
 *                 type: string
 *                 format: date
 *                 description: 창립일
 *     responses:
 *       201:
 *         description: 클럽 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 group:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: 유효하지 않은 요청
 *       409:
 *         description: 이미 사용 중인 클럽명
 *       500:
 *         description: 서버 오류
 */
router.post('/group', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, sport, region_city, region_district, founded_at } = createGroupSchema.parse(req.body);
    const userId = req.user.sub;
    const groupId = randomUUID();
    const memberId = randomUUID();

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO groups (id, name, description, sport, region_city, region_district, founded_at, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [groupId, name, description || null, sport || null, region_city || null, region_district || null, founded_at || null, userId]
    );

    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [memberId, groupId, userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: '클럽이 성공적으로 생성되었습니다',
      group: { id: groupId, name },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: '이미 사용 중인 클럽명입니다' });
    }
    console.error('Error creating group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/search:
 *   get:
 *     summary: 클럽 검색 및 추천
 *     description: 내가 가입하지 않은 클럽을 검색하거나 추천받습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 검색어 (클럽명)
 *       - in: query
 *         name: region_city
 *         schema:
 *           type: string
 *         description: 지역 필터 (시/도)
 *       - in: query
 *         name: region_district
 *         schema:
 *           type: string
 *         description: 지역 필터 (구/군)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: 결과 개수 제한
 *       - in: query
 *         name: sort_by_region
 *         schema:
 *           type: boolean
 *         description: true일 때 region_city를 필터가 아닌 정렬 기준으로 사용 (같은 지역 우선, 다른 지역도 표시)
 *     responses:
 *       200:
 *         description: 검색 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       region_city:
 *                         type: string
 *                       region_district:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       member_count:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 */
router.get('/group/search', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { q, region_city, region_district, limit = '20', sort_by_region } = req.query;

    const conditions = [
      `g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = $1)`
    ];
    const params = [userId];
    let paramIdx = 2;

    // 검색어가 있으면 필터링
    if (q && q.trim()) {
      conditions.push(`g.name ILIKE $${paramIdx}`);
      params.push(`%${q.trim()}%`);
      paramIdx++;
    }

    // sort_by_region=true이면 지역은 정렬 기준으로만 사용 (필터링 X)
    // sort_by_region=false이거나 없으면 지역 필터링
    const useSortOnly = sort_by_region === 'true';

    if (!useSortOnly) {
      if (region_city && region_city.trim()) {
        conditions.push(`g.region_city = $${paramIdx}`);
        params.push(region_city.trim());
        paramIdx++;
      }

      if (region_district && region_district.trim()) {
        conditions.push(`g.region_district = $${paramIdx}`);
        params.push(region_district.trim());
        paramIdx++;
      }
    }

    params.push(Math.min(parseInt(limit, 10) || 20, 50));

    // 정렬: region_city가 제공되고 sort_by_region=true이면 일치하는 것 우선
    let orderBy = 'g.created_at DESC';
    if (useSortOnly && region_city && region_city.trim()) {
      orderBy = `(CASE WHEN g.region_city = '${region_city.trim()}' THEN 0 ELSE 1 END), g.created_at DESC`;
    }

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district, g.created_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int AS member_count
       FROM groups g
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx}`,
      params
    );

    res.status(200).json({ groups: result.rows });
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group:
 *   get:
 *     summary: 내가 속한 클럽 목록 조회
 *     description: 로그인한 사용자가 가입한 모든 클럽 목록을 반환합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 클럽 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       region_city:
 *                         type: string
 *                       region_district:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member]
 *                       creator_name:
 *                         type: string
 *                       member_count:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 */
router.get('/group', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district, g.created_at,
              gm.role,
              u.name AS creator_name,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int AS member_count
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       LEFT JOIN users u ON g.created_by_id = u.id
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.status(200).json({ groups: result.rows });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   get:
 *     summary: 클럽 상세 정보 조회
 *     description: 특정 클럽의 상세 정보와 멤버 목록을 조회합니다. 클럽에 속한 사용자만 접근 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 group:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     creator_name:
 *                       type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member]
 *                       joined_at:
 *                         type: string
 *                         format: date-time
 *                       user_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                 myRole:
 *                   type: string
 *                   enum: [owner, admin, member]
 *       403:
 *         description: 클럽에 속해있지 않음
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // 해당 클럽에 속해있는지 확인
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: '클럽에 속해있지 않습니다' });
    }

    const groupResult = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district,
              g.founded_at, g.created_at, u.name AS creator_name
       FROM groups g
       LEFT JOIN users u ON g.created_by_id = u.id
       WHERE g.id = $1`,
      [id]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    const membersResult = await pool.query(
      `SELECT gm.id, gm.role, gm.division, gm.joined_at, u.id AS user_id, u.name, u.email
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [id]
    );

    res.status(200).json({
      group: groupResult.rows[0],
      members: membersResult.rows,
      myRole: memberCheck.rows[0].role,
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member:
 *   post:
 *     summary: 클럽에 멤버 추가
 *     description: 클럽에 새로운 멤버를 추가합니다. owner 또는 admin만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 추가할 사용자 ID
 *     responses:
 *       201:
 *         description: 멤버 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 사용자 ID가 제공되지 않음
 *       403:
 *         description: 권한 없음
 *       409:
 *         description: 이미 클럽에 속한 사용자
 *       500:
 *         description: 서버 오류
 */
router.post('/group/:id/member', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: '추가할 사용자 ID가 필요합니다' });
    }

    // 이미 멤버인지 확인
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: '이미 클럽에 속해있는 사용자입니다' });
    }

    const memberId = randomUUID();
    await pool.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'member')`,
      [memberId, id, user_id]
    );

    res.status(201).json({ message: '멤버가 추가되었습니다' });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/join:
 *   post:
 *     summary: 클럽 가입
 *     description: 사용자가 클럽에 가입합니다. 자동으로 member 역할이 부여됩니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 가입할 클럽 ID
 *     responses:
 *       201:
 *         description: 클럽 가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       409:
 *         description: 이미 가입된 클럽
 *       500:
 *         description: 서버 오류
 */
router.post('/group/:id/join', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // 클럽 존재 확인
    const groupCheck = await pool.query(
      `SELECT id FROM groups WHERE id = $1`,
      [id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    // 이미 멤버인지 확인
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: '이미 가입된 클럽입니다' });
    }

    const memberId = randomUUID();
    await pool.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'member')`,
      [memberId, id, userId]
    );

    res.status(201).json({ message: '클럽에 가입되었습니다' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}/role:
 *   patch:
 *     summary: 멤버 권한 변경
 *     description: 클럽 멤버의 역할을 변경합니다. owner만 가능하며, member와 admin 간 변경만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 대상 사용자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *                 description: 변경할 역할
 *     responses:
 *       200:
 *         description: 권한 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 유효하지 않은 역할 또는 owner 권한 변경 시도
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id/member/:userId/role', requireAuth, requireGroupOwner, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body;

    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: '유효하지 않은 권한입니다. member 또는 admin만 가능합니다' });
    }

    // 대상 멤버 확인
    const targetCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }
    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ message: '리더의 권한은 변경할 수 없습니다' });
    }

    await pool.query(
      `UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3`,
      [role, id, targetUserId]
    );

    res.status(200).json({ message: '권한이 변경되었습니다' });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}:
 *   patch:
 *     summary: 멤버 정보 수정
 *     description: 클럽 멤버의 정보(부수 등)를 수정합니다. owner 또는 admin만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 대상 사용자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               division:
 *                 type: string
 *                 description: 부수 (예 1부, 2부, A조 등)
 *     responses:
 *       200:
 *         description: 멤버 정보 수정 성공
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
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id/member/:userId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { division } = req.body;

    // 대상 멤버 확인
    const targetCheck = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }

    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (division !== undefined) {
      updates.push(`division = $${paramIdx++}`);
      values.push(division);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: '수정할 내용이 없습니다' });
    }

    values.push(id, targetUserId);
    await pool.query(
      `UPDATE group_members SET ${updates.join(', ')} WHERE group_id = $${paramIdx++} AND user_id = $${paramIdx}`,
      values
    );

    res.status(200).json({ message: '멤버 정보가 수정되었습니다' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   patch:
 *     summary: 클럽 정보 수정
 *     description: 클럽의 기본 정보를 수정합니다. owner만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 클럽명
 *               description:
 *                 type: string
 *                 description: 클럽 설명
 *               sport:
 *                 type: string
 *                 description: 종목
 *               type:
 *                 type: string
 *                 description: 종류
 *               region_city:
 *                 type: string
 *                 description: 지역(시/도)
 *               region_district:
 *                 type: string
 *                 description: 지역(구/군)
 *               founded_at:
 *                 type: string
 *                 format: date
 *                 description: 창립일
 *     responses:
 *       200:
 *         description: 클럽 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id', requireAuth, requireGroupOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sport, region_city, region_district, founded_at } = req.body;

    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(description);
    }
    if (sport !== undefined) {
      updates.push(`sport = $${paramIdx++}`);
      values.push(sport);
    }
    if (region_city !== undefined) {
      updates.push(`region_city = $${paramIdx++}`);
      values.push(region_city);
    }
    if (region_district !== undefined) {
      updates.push(`region_district = $${paramIdx++}`);
      values.push(region_district);
    }
    if (founded_at !== undefined) {
      updates.push(`founded_at = $${paramIdx++}`);
      values.push(founded_at);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: '수정할 내용이 없습니다' });
    }

    values.push(id);
    await pool.query(
      `UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    );

    res.status(200).json({ message: '클럽 정보가 수정되었습니다' });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   delete:
 *     summary: 클럽 삭제
 *     description: 클럽을 삭제합니다. owner만 가능하며, 클럽의 모든 멤버와 관련 데이터가 삭제됩니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/group/:id', requireAuth, requireGroupOwner, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 클럽 멤버 삭제
    await client.query(
      `DELETE FROM group_members WHERE group_id = $1`,
      [id]
    );

    // 클럽 삭제
    const result = await client.query(
      `DELETE FROM groups WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: '클럽이 삭제되었습니다' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}:
 *   delete:
 *     summary: 클럽에서 멤버 제거
 *     description: 클럽에서 멤버를 제거합니다. owner 또는 admin만 가능하며, owner는 제거할 수 없습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 제거할 사용자 ID
 *     responses:
 *       200:
 *         description: 멤버 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: owner 제거 시도
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/group/:id/member/:userId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;

    // owner는 제거 불가
    const targetCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }
    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ message: '클럽 소유자는 제거할 수 없습니다' });
    }

    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );

    res.status(200).json({ message: '멤버가 제거되었습니다' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

module.exports = router;
