const pool = require('../db/pool');

/**
 * 클럽 내 특정 권한을 가진 사용자만 접근 허용
 * @param {string[]} allowedRoles - 허용할 역할 목록 (예: ['owner', 'admin'])
 */
const requireGroupRole = (allowedRoles) => async (req, res, next) => {
  try {
    // URL에서 groupId 추출 (예: /group/:groupId/member, /group/:id 등)
    const groupId = req.params.groupId || req.params.id;

    if (!groupId) {
      return res.status(400).json({ message: '클럽 ID가 필요합니다' });
    }

    const userId = req.user.sub;

    // 사용자의 클럽 내 역할 확인
    const roleCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ message: '클럽에 속해있지 않습니다' });
    }

    const userRole = roleCheck.rows[0].role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: '권한이 없습니다. 필요한 권한: ' + allowedRoles.join(', ')
      });
    }

    // 권한 정보를 req에 추가 (라우터에서 사용 가능)
    req.groupRole = userRole;
    next();
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ message: '권한 확인 중 오류가 발생했습니다' });
  }
};

/**
 * 시스템 관리자만 접근 허용
 * 향후 users 테이블에 role 컬럼 추가 시 사용
 */
const requireAdmin = (req, res, next) => {
  // TODO: users 테이블에 role 컬럼 추가 후 구현
  // const userRole = req.user.role;
  // if (userRole !== 'admin') {
  //   return res.status(403).json({ message: '시스템 관리자만 접근 가능합니다' });
  // }
  next();
};

/**
 * 리더(owner)만 접근 허용
 */
const requireGroupOwner = requireGroupRole(['owner']);

/**
 * 리더 또는 운영진만 접근 허용
 */
const requireGroupAdmin = requireGroupRole(['owner', 'admin']);

module.exports = {
  requireGroupRole,
  requireGroupOwner,
  requireGroupAdmin,
  requireAdmin,
};
