/**
 * 알파벳 3자리 클럽 코드 순차 생성 유틸리티
 * AAA → AAB → ... → AAZ → ABA → ... → ZZZ (총 26^3 = 17,576개)
 */

/**
 * 알파벳 코드 증가 (AAA → AAB, AAZ → ABA, ZZZ는 에러)
 * @param {string} code - 현재 코드 (e.g. "AAA")
 * @returns {string} 다음 코드
 */
function incrementAlphaCode(code) {
  const letters = code.split('').map((c) => c.charCodeAt(0) - 65); // A=0, Z=25
  let carry = 1;
  for (let i = letters.length - 1; i >= 0 && carry; i--) {
    letters[i] += carry;
    carry = Math.floor(letters[i] / 26);
    letters[i] %= 26;
  }
  if (carry) throw new Error('클럽 코드가 ZZZ를 초과했습니다.');
  return letters.map((n) => String.fromCharCode(65 + n)).join('');
}

/**
 * 다음 클럽 코드 생성 (트랜잭션 내에서 호출, 테이블 락 필요)
 * @param {import('pg').PoolClient} client - DB 클라이언트
 * @returns {Promise<string>} 새 클럽 코드
 */
async function generateClubCode(client) {
  const result = await client.query(
    `SELECT MAX(club_code) AS max_code FROM groups WHERE club_code ~ '^[A-Z]{3}$'`,
  );
  const maxCode = result.rows[0]?.max_code ?? null;
  if (!maxCode) return 'AAA';
  return incrementAlphaCode(maxCode);
}

/**
 * 리그 코드 생성: {클럽코드}{YYMMDD}{순번 2자리}
 * 예: AAA26031601
 * @param {string} clubCode - 클럽 코드 (e.g. "AAA")
 * @param {string|Date} startDate - 리그 시작일
 * @param {number} seq - 해당 클럽+날짜 내 순번 (1부터)
 * @returns {string}
 */
function buildLeagueCode(clubCode, startDate, seq) {
  const d = new Date(startDate);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${clubCode}${yy}${mm}${dd}${String(seq).padStart(2, '0')}`;
}

/**
 * 추첨 코드 생성: {리그코드11자리}{순번2자리}
 * 예: AAA26031601 + 01 = AAA2603160101
 * @param {string} leagueCode - 리그 코드 (11자리)
 * @param {number} seq - 해당 리그 내 순번 (1부터)
 * @returns {string}
 */
function buildDrawCode(leagueCode, seq) {
  return `${leagueCode}${String(seq).padStart(2, '0')}`;
}

module.exports = { generateClubCode, buildLeagueCode, buildDrawCode };
