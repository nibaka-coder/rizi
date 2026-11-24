'use strict';

const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

const COOKIE_NAME = 'rizi_session';

// ---------- 密码哈希：scrypt + 随机盐 ----------
function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

// 防时序攻击的恒定时间比较
function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch (_) {
    return false;
  }
}

function verifyPassword(password) {
  const row = db.prepare('SELECT salt, password_hash FROM auth WHERE id = 1').get();
  if (!row) return false;
  const { hash } = hashPassword(password, row.salt);
  return safeEqualHex(hash, row.password_hash);
}

// ---------- 设置 / 修改密码 ----------
function hasPassword() {
  return !!db.prepare('SELECT 1 FROM auth WHERE id = 1').get();
}

function setPassword(password) {
  const { salt, hash } = hashPassword(password);
  db.prepare(`
    INSERT INTO auth (id, salt, password_hash, updated_at)
    VALUES (1, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET salt = excluded.salt, password_hash = excluded.password_hash,
      updated_at = datetime('now')
  `).run(salt, hash);
}

// ---------- 会话 ----------
function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + config.SESSION_DAYS * 24 * 3600 * 1000);
  // SQLite 用 ISO 字符串存，比较用 JS 侧做，避免格式差异
  db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expires.toISOString());
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
  if (!row) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// 清理过期会话（启动时调用）
function pruneSessions() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}

// 所有会话失效——改密码/重置后调用，强制所有人重新登录
function deleteAllSessions() {
  db.prepare('DELETE FROM sessions').run();
}

// ---------- 中间件 ----------
function readToken(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) return v.join('=');
  }
  return null;
}

// 要求已登录
function requireAuth(req, res, next) {
  if (isValidSession(readToken(req))) return next();
  return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
}

// ---------- 暴力破解防护：按 IP 的失败次数限流 ----------
// 连续失败 MAX_FAILS 次后锁定 LOCK_MS 毫秒。仅内存保存，进程重启后清零。
// 对单用户自托管场景足够；如需跨重启持久可在数据库建表，当前无必要。
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 分钟
const failures = new Map(); // ip -> { count, lockedUntil }

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// 是否被锁定；返回剩余毫秒数（0 表示未锁定）
function lockRemainingMs(req) {
  const rec = failures.get(clientIp(req));
  if (!rec) return 0;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return rec.lockedUntil - Date.now();
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) failures.delete(clientIp(req));
  return 0;
}

function recordFailure(req) {
  const ip = clientIp(req);
  const rec = failures.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  failures.set(ip, rec);
}

function clearFailures(req) {
  failures.delete(clientIp(req));
}

// 已登录时访问登录/设置页，可选放行
function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: config.SESSION_DAYS * 24 * 3600 * 1000,
    path: '/',
  };
}

module.exports = {
  COOKIE_NAME,
  hasPassword,
  setPassword,
  verifyPassword,
  createSession,
  isValidSession,
  deleteSession,
  deleteAllSessions,
  pruneSessions,
  requireAuth,
  readToken,
  cookieOptions,
  lockRemainingMs,
  recordFailure,
  clearFailures,
};
