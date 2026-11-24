'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// 认证服务的纯逻辑测试（不依赖 express）。
// 通过 DB_PATH 环境变量指向临时库后再 require，避免污染真实数据。
const tmpDb = require('path').join(require('os').tmpdir(), `rizi-auth-test-${process.pid}.db`);
process.env.DB_PATH = tmpDb;
process.env.COOKIE_SECURE = 'false';

const auth = require('../src/services/auth');
const db = require('../src/db');

// 每个测试前清空认证与会话
function reset() {
  db.exec('DELETE FROM sessions; DELETE FROM auth;');
}

test('初始状态未设置密码', () => {
  reset();
  assert.equal(auth.hasPassword(), false);
});

test('设置密码后哈希存储，明文不落库', () => {
  reset();
  auth.setPassword('secret123');
  assert.equal(auth.hasPassword(), true);
  const row = db.prepare('SELECT salt, password_hash FROM auth WHERE id = 1').get();
  assert.ok(row.salt && row.password_hash);
  assert.ok(!row.password_hash.includes('secret123'));
  assert.notEqual(row.password_hash, 'secret123');
});

test('密码校验正确与错误', () => {
  reset();
  auth.setPassword('secret123');
  assert.equal(auth.verifyPassword('secret123'), true);
  assert.equal(auth.verifyPassword('wrongpass'), false);
});

test('不同盐值：同样密码两次设置哈希不同', () => {
  reset();
  auth.setPassword('samepassword');
  const h1 = db.prepare('SELECT salt, password_hash FROM auth WHERE id = 1').get();
  auth.setPassword('samepassword');
  const h2 = db.prepare('SELECT salt, password_hash FROM auth WHERE id = 1').get();
  assert.notEqual(h1.salt, h2.salt);
  assert.notEqual(h1.password_hash, h2.password_hash);
});

test('会话创建与校验，删除后失效', () => {
  reset();
  const token = auth.createSession();
  assert.ok(token && token.length >= 32);
  assert.equal(auth.isValidSession(token), true);
  assert.equal(auth.isValidSession('badtoken'), false);
  assert.equal(auth.isValidSession(null), false);
  auth.deleteSession(token);
  assert.equal(auth.isValidSession(token), false);
});

test('过期会话视为无效', () => {
  reset();
  const token = auth.createSession();
  const past = new Date(Date.now() - 1000).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(past, token);
  assert.equal(auth.isValidSession(token), false);
});

test('改密码后让所有会话失效', () => {
  reset();
  const t1 = auth.createSession();
  const t2 = auth.createSession();
  assert.equal(auth.isValidSession(t1), true);
  assert.equal(auth.isValidSession(t2), true);
  auth.setPassword('newpassword');
  auth.deleteAllSessions();
  assert.equal(auth.isValidSession(t1), false);
  assert.equal(auth.isValidSession(t2), false);
  assert.equal(auth.verifyPassword('newpassword'), true);
});

test('pruneSessions 清理过期会话', () => {
  reset();
  const good = auth.createSession();
  const expired = auth.createSession();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run('2000-01-01T00:00:00.000Z', expired);
  auth.pruneSessions();
  assert.equal(auth.isValidSession(good), true);
  assert.equal(db.prepare('SELECT 1 FROM sessions WHERE token = ?').get(expired), undefined);
});

test('cookieOptions 安全属性正确', () => {
  const opts = auth.cookieOptions();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.secure, false); // 测试环境 COOKIE_SECURE=false
  assert.ok(opts.maxAge > 0);
});

test('登录失败限流：连续失败达上限后锁定，成功清零', () => {
  const fakeReq = { ip: '10.0.0.99', headers: {}, socket: { remoteAddress: '10.0.0.99' } };
  assert.equal(auth.lockRemainingMs(fakeReq), 0);
  for (let i = 0; i < 4; i++) {
    auth.recordFailure(fakeReq);
    assert.equal(auth.lockRemainingMs(fakeReq), 0, `第 ${i + 1} 次失败不应锁定`);
  }
  auth.recordFailure(fakeReq); // 第 5 次触发锁定
  assert.ok(auth.lockRemainingMs(fakeReq) > 0, '第 5 次失败应锁定');
  auth.clearFailures(fakeReq); // 成功后清零
  assert.equal(auth.lockRemainingMs(fakeReq), 0);
});

test('cleanup', () => {
  try {
    db.close();
    require('fs').unlinkSync(tmpDb);
    for (const suf of ['-wal', '-shm']) {
      try { require('fs').unlinkSync(tmpDb + suf); } catch (_) {}
    }
  } catch (_) {}
});
