const pool = require('../db/pool');

/**
 * 회원코드 생성: M + YYYYMMDD + 4자리 순번
 * 예) M202601010003
 */
async function generateMemberCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix  = `M${dateStr}`;

  const result = await pool.query(
    `SELECT COALESCE(MAX(SUBSTRING(member_code FROM 10)::int), 0) + 1 AS next_num
     FROM users
     WHERE member_code LIKE $1`,
    [`${prefix}%`],
  );

  const num = String(result.rows[0].next_num).padStart(4, '0');
  return `${prefix}${num}`;
}

module.exports = { generateMemberCode };
