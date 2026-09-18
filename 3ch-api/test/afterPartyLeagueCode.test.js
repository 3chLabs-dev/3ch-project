const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db/pool');
const router = require('../src/routes/afterParty');

test('뒤풀이 정산 API에서 리그 코드를 내부 ID로 바꾼다', async () => {
  const originalQuery = pool.query;
  const leagueId = '11111111-1111-4111-8111-111111111111';
  try {
    pool.query = async (_sql, params) => {
      assert.deepEqual(params, ['AAM260905 01', 'AAM26090501']);
      return { rowCount: 1, rows: [{ id: leagueId }] };
    };
    const req = { params: { leagueId: 'AAM260905 01' } };
    await new Promise((resolve, reject) => {
      router.params.leagueId[0](req, {}, (error) => error ? reject(error) : resolve(), req.params.leagueId);
    });
    assert.equal(req.params.leagueId, leagueId);
  } finally {
    pool.query = originalQuery;
  }
});
