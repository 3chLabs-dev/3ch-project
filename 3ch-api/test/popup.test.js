const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const poolPath = require.resolve('../src/db/pool');
const authPath = require.resolve('../src/middlewares/auth');
const queries = [];
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: async (sql, values) => { queries.push({ sql, values }); return { rowCount: 1, rows: [{ id: 1 }] }; } } };
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { requireAdmin: (req,res,next) => req.headers.authorization === 'Bearer admin' ? next() : res.sendStatus(401) } };
const app = express(); app.use(express.json()); app.use(require('../src/routes/popup'));
test('팝업 API 권한, 기간 필터, 입력 검증 및 명시적 삭제 확인', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: 'Bearer admin', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/admin/popups`)).status,401);
    assert.equal(queries.length,0);
    assert.equal((await fetch(`${base}/popups`)).status,200);
    assert.match(queries[0].sql,/is_active=true AND starts_at<=NOW\(\) AND ends_at>NOW\(\)/);
    const before = queries.length;
    assert.equal((await fetch(`${base}/admin/popups/1`,{method:'DELETE',headers,body:'{}'})).status,400);
    assert.equal(queries.length,before);
    assert.equal((await fetch(`${base}/admin/popups/1`,{method:'PATCH',headers,body:JSON.stringify({name:'테스트',linkUrl:'javascript:alert(1)',startsAt:'2026-10-07',endsAt:'2026-10-08',isActive:'true'})})).status,400);
    assert.equal(queries.length,before);
    assert.equal((await fetch(`${base}/admin/popups/1`,{method:'PATCH',headers,body:JSON.stringify({name:'테스트',linkUrl:'https://example.com',startsAt:'2026-10-07',endsAt:'2026-10-08',isActive:'false'})})).status,200);
    assert.match(queries.at(-1).sql,/image=COALESCE\(\$6,image\)/);
    assert.equal(queries.at(-1).values[4],false);
    assert.equal((await fetch(`${base}/admin/popups/1`,{method:'DELETE',headers,body:JSON.stringify({confirmDelete:true})})).status,200);
    assert.match(queries.at(-1).sql,/DELETE FROM popups WHERE id=\$1/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
