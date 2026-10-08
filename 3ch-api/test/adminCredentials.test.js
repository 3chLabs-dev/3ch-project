const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const bcrypt = require('bcrypt');

function load(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, require: (name) => mocks[name] ?? require(name), console,
  });
  return module.exports;
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; } };
}
function routes(query) {
  const handlers = {};
  const router = Object.fromEntries(['get','post','put','patch','delete'].map(method => [method, (route,...callbacks)=>{ handlers[`${method} ${route}`]=callbacks.at(-1); }]));
  load('routes/admin.js', {
    express: { Router: ()=>router }, '../db/pool': { query },
    '../middlewares/auth': { requireAdmin() {} },
    '../utils/authUtils': { signToken: (value)=>value, verifyToken: (value,purpose)=>{ if(value.purpose!==purpose) throw Error('wrong purpose'); return value; } },
    '../utils/memberCodeUtils': {}, '../utils/clubCodeUtils': {}, '../services/pointRanking': {}, '../services/groupRanking': {}, '../services/sportRanking': {},
  });
  return handlers;
}
test('manager temporary login returns only a reset ticket, never an access token', async()=>{
  const hash=await bcrypt.hash('temporary!',4);
  const handlers=routes(async()=>({rowCount:1,rows:[{id:2,email:'manager@example.com',system_role:'MANAGER',is_admin:false,admin_password_hash:hash,admin_password_reset_required:true,admin_auth_version:1}]}));
  const res=response(); await handlers['post /login']({body:{email:'manager@example.com',password:'temporary!'}},res);
  assert.equal(res.body.passwordResetRequired,true); assert.equal(res.body.token,undefined);
  assert.equal(res.body.resetToken.purpose,'admin-password-reset');
});
test('first login rejects reusing temporary password without writing credentials', async()=>{
  const hash=await bcrypt.hash('temporary!',4); let calls=0;
  const handlers=routes(async()=>{calls++;return {rowCount:1,rows:[{admin_password_hash:hash}]};});
  const res=response(); await handlers['post /password/setup']({body:{password:'temporary!',resetToken:{sub:'2',adminVersion:1,purpose:'admin-password-reset'}}},res);
  assert.equal(res.body.error,'SAME_PASSWORD');assert.equal(calls,1);
});
test('first setup stores a new admin hash and invalidates the single-use ticket',async()=>{
  const oldHash=await bcrypt.hash('temporary!',4);let calls=0;
  const handlers=routes(async(sql,params)=>{
    calls++;
    if(calls===1)return {rowCount:1,rows:[{admin_password_hash:oldHash}]};
    assert.match(sql,/admin_auth_version=admin_auth_version\+1/);
    assert.match(sql,/admin_password_reset_required=true AND admin_auth_version=\$3/);
    assert.ok(await bcrypt.compare('newPassword!',params[0]));
    assert.equal(params[1],2);assert.equal(params[2],1);
    return {rowCount:1,rows:[{id:2,email:'manager@example.com',system_role:'MANAGER',admin_auth_version:2}]};
  });
  const res=response(); await handlers['post /password/setup']({body:{password:'newPassword!',resetToken:{sub:'2',adminVersion:1,purpose:'admin-password-reset'}}},res);
  assert.equal(res.body.ok,true);assert.equal(res.body.token.adminVersion,2);assert.equal(calls,2);
});
test('admin authorization blocks pending reset, stale tokens, and revoked manager role',async()=>{
  for(const [account,payload,expected] of [
    [{system_role:'MANAGER',admin_auth_version:2,admin_password_reset_required:true},{sub:'2',adminVersion:2},401],
    [{system_role:'MANAGER',admin_auth_version:2},{sub:'2',adminVersion:1},401],
    [{system_role:'USER',is_admin:false},{sub:'2',adminVersion:2},403],
    [{system_role:'MANAGER',admin_auth_version:2},{sub:'2',adminVersion:2},200],
  ]){
    const middleware=load('middlewares/auth.js',{'../db/pool':{query:async()=>({rowCount:1,rows:[account]})},'../utils/authUtils':{verifyToken:()=>payload}});
    const res=response();let allowed=false;
    await middleware.requireAdmin({headers:{authorization:'Bearer test'}},res,()=>{allowed=true;});
    assert.equal(res.statusCode,expected);assert.equal(allowed,expected===200);
  }
});
