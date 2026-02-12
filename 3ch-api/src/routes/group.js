const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const createGroupSchema = z.object({
  name: z.string().min(1, '모임 이름은 필수입니다'),
  description: z.string().optional(),
  region_city: z.string().optional(),
  region_district: z.string().optional(),
  founded_at: z.string().optional(),
});

/**
 * GET /group/check-name - 모임명 중복검사
 */
router.get('/group/check-name', requireAuth, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '모임명을 입력해주세요' });
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
 * POST /group - 모임 생성
 * 생성자는 자동으로 owner로 등록됨
 */
router.post('/group', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, region_city, region_district, founded_at } = createGroupSchema.parse(req.body);
    const userId = req.user.sub;
    const groupId = randomUUID();
    const memberId = randomUUID();

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO groups (id, name, description, region_city, region_district, founded_at, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [groupId, name, description || null, region_city || null, region_district || null, founded_at || null, userId]
    );

    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [memberId, groupId, userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: '모임이 성공적으로 생성되었습니다',
      group: { id: groupId, name },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: '이미 사용 중인 모임명입니다' });
    }
    console.error('Error creating group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * GET /group - 내가 속한 모임 목록
 */
router.get('/group', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.region_city, g.region_district, g.created_at,
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
 * GET /group/:id - 모임 상세 (멤버 목록 포함)
 */
router.get('/group/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // 해당 모임에 속해있는지 확인
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: '모임에 속해있지 않습니다' });
    }

    const groupResult = await pool.query(
      `SELECT g.id, g.name, g.description, g.created_at, u.name AS creator_name
       FROM groups g
       LEFT JOIN users u ON g.created_by_id = u.id
       WHERE g.id = $1`,
      [id]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: '모임을 찾을 수 없습니다' });
    }

    const membersResult = await pool.query(
      `SELECT gm.id, gm.role, gm.joined_at, u.id AS user_id, u.name, u.email
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
 * POST /group/:id/member - 모임에 멤버 추가 (owner/admin만)
 */
router.post('/group/:id/member', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: '추가할 사용자 ID가 필요합니다' });
    }

    // 권한 확인
    const roleCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (roleCheck.rows.length === 0 || !['owner', 'admin'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ message: '멤버를 추가할 권한이 없습니다' });
    }

    // 이미 멤버인지 확인
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: '이미 모임에 속해있는 사용자입니다' });
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
 * DELETE /group/:id/member/:userId - 모임에서 멤버 제거 (owner/admin만)
 */
router.delete('/group/:id/member/:userId', requireAuth, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const requesterId = req.user.sub;

    // 권한 확인
    const roleCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, requesterId]
    );
    if (roleCheck.rows.length === 0 || !['owner', 'admin'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ message: '멤버를 제거할 권한이 없습니다' });
    }

    // owner는 제거 불가
    const targetCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }
    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ message: '모임 소유자는 제거할 수 없습니다' });
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
