'use strict';

const express = require('express');
const path = require('path');
const db = require('./db');
const config = require('./config');
const { makeCrud } = require('./routes/crud');
const backup = require('./services/backup');
const auth = require('./services/auth');
const {
  todayShanghai,
  computePerson,
  computeItem,
  computeSubscription,
  buildOverview,
  addMonths,
  subscriptionExpiry,
} = require('./services/dates');

// 会员写入前：有购买日+时长时自动算出到期日并落库，前端不必自己算
function fillSubscriptionExpiry(body) {
  if (body.purchase_date && body.duration != null) {
    const unitMonths = config.CYCLE_MONTHS[body.cycle] || config.CYCLE_MONTHS.year;
    body.expiry_date = addMonths(body.purchase_date, Number(body.duration) * unitMonths);
  }
  return body;
}

const app = express();
app.use(express.json());

// ---------- 认证（这些接口本身不需要登录） ----------

// 查询认证状态：前端据此决定显示"设置密码 / 登录 / 正常应用"
app.get('/api/auth/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    hasPassword: auth.hasPassword(),
    loggedIn: auth.isValidSession(auth.readToken(req)),
    needsSetupKey: !!config.SETUP_KEY,
  });
});

// 首次设置密码（仅当尚未设置过时可用）
app.post('/api/auth/setup', (req, res) => {
  if (auth.hasPassword()) return res.status(409).json({ error: '密码已设置' });
  const password = String(req.body?.password || '');
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (config.SETUP_KEY && String(req.body?.setupKey || '') !== config.SETUP_KEY) {
    return res.status(403).json({ error: '初始化密钥错误' });
  }
  auth.setPassword(password);
  auth.deleteAllSessions();
  const token = auth.createSession();
  res.cookie(auth.COOKIE_NAME, token, auth.cookieOptions());
  res.json({ ok: true });
});

// 登录
app.post('/api/auth/login', (req, res) => {
  if (!auth.hasPassword()) return res.status(409).json({ error: '尚未设置密码' });
  const password = String(req.body?.password || '');
  if (!auth.verifyPassword(password)) return res.status(401).json({ error: '密码错误' });
  const token = auth.createSession();
  res.cookie(auth.COOKIE_NAME, token, auth.cookieOptions());
  res.json({ ok: true });
});

// 退出登录
app.post('/api/auth/logout', (req, res) => {
  auth.deleteSession(auth.readToken(req));
  res.clearCookie(auth.COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// 修改密码（需已登录）
app.post('/api/auth/change-password', auth.requireAuth, (req, res) => {
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!auth.verifyPassword(oldPassword)) return res.status(401).json({ error: '原密码错误' });
  if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  auth.setPassword(newPassword);
  auth.deleteAllSessions();
  const token = auth.createSession();
  res.cookie(auth.COOKIE_NAME, token, auth.cookieOptions());
  res.json({ ok: true });
});

// ---------- 以下所有 /api 接口都需要登录 ----------
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next(); // 认证接口已自行处理
  return auth.requireAuth(req, res, next);
});

// 基础信息（应用名等可配置常量）——前端从这里读取，集中管理
app.get('/api/config', (req, res) => {
  res.json({
    appName: config.APP_NAME,
    itemCategories: config.ITEM_CATEGORIES,
    cycleMonths: config.CYCLE_MONTHS,
    windowDays: config.UPCOMING_DAYS,
    today: todayShanghai(),
  });
});

// 近期提醒首页：把三张表读出来算好日期再聚合
app.get('/api/overview', (req, res) => {
  const today = todayShanghai();
  const people = db.prepare('SELECT * FROM people').all().map((r) => computePerson(r, today));
  const items = db.prepare('SELECT * FROM items').all().map((r) => computeItem(r, today));
  const subs = db.prepare('SELECT * FROM subscriptions').all().map((r) => computeSubscription(r, today));
  res.json(buildOverview(people, items, subs, today));
});

// 分类页也返回带计算字段的数据，前端不用重复算日期
app.get('/api/people/view', (req, res) => {
  const today = todayShanghai();
  const rows = db.prepare('SELECT * FROM people').all();
  res.json(rows.map((r) => computePerson(r, today)).sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)));
});
app.get('/api/items/view', (req, res) => {
  const today = todayShanghai();
  const rows = db.prepare('SELECT * FROM items').all();
  res.json(rows.map((r) => computeItem(r, today)));
});
app.get('/api/subscriptions/view', (req, res) => {
  const today = todayShanghai();
  const rows = db.prepare('SELECT * FROM subscriptions').all();
  res.json(rows.map((r) => computeSubscription(r, today)).sort((a, b) => a.days - b.days));
});

// 会员"标记已续费"：购买日推进一个时长（若已过期多个周期，推进到第一个不早于今天的到期日）
app.post('/api/subscriptions/:id/renew', (req, res) => {
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  const unitMonths = config.CYCLE_MONTHS[row.cycle] || config.CYCLE_MONTHS.year;
  const months = (row.duration != null ? Number(row.duration) : 1) * unitMonths;
  const currentExpiry = subscriptionExpiry(row); // 当前到期日（新数据按购买日+时长算出，旧数据用已存值）
  let next = addMonths(currentExpiry, months);    // 续费：在当前到期日基础上再延长一个时长
  const today = todayShanghai();
  let guard = 0;
  while (next < today && guard < 240) {           // 已过期多个周期时，推进到第一个不早于今天的到期日
    next = addMonths(next, months);
    guard += 1;
  }
  // 有购买日的记录：购买日同步更新为"新到期日 - 一个时长"，保持 purchase_date + duration = expiry_date 可推导
  const nextPurchase = row.purchase_date ? addMonths(next, -months) : row.purchase_date;
  db.prepare("UPDATE subscriptions SET purchase_date = ?, expiry_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(nextPurchase, next, req.params.id);
  res.json(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id));
});

// ---------- 数据备份 ----------
// 导出为 JSON 文件（浏览器直接下载）
app.get('/api/backup/export', (req, res) => {
  const data = backup.exportData();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rizi-backup-${data.exportedAt.slice(0, 10)}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

// 导入：mode=merge（跳过已存在 id）或 replace（清空后导入）
app.post('/api/backup/import', (req, res) => {
  try {
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const result = backup.importData(req.body?.payload ?? req.body, mode);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 立即生成一份 SQLite 快照
app.post('/api/backup/now', (req, res) => {
  try {
    res.json(backup.backupNow());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 列出已有快照 + 备份目录配置（供前端展示）
app.get('/api/backup/status', (req, res) => {
  res.json({
    dir: config.BACKUP_DIR,
    keep: config.BACKUP_KEEP,
    hour: config.BACKUP_HOUR,
    backups: backup.listBackups(),
  });
});

// 三张表的通用 CRUD（放在所有专用路由之后，避免 /view 被 /:id 抢先匹配）
app.use('/api/people', makeCrud(db, 'people', [
  'name', 'avatar', 'calendar', 'birth_year', 'birth_month', 'birth_day',
  'is_leap_month', 'remind_days', 'note',
]));
app.use('/api/items', makeCrud(db, 'items', [
  'name', 'category', 'location', 'purchase_date', 'price', 'brand', 'model',
  'serial', 'warranty_months', 'receipt_path', 'note',
]));
app.use('/api/subscriptions', makeCrud(db, 'subscriptions', [
  'name', 'account', 'purchase_date', 'duration', 'expiry_date', 'cycle', 'cost', 'payment_method',
  'remind_days', 'note',
], fillSubscriptionExpiry));

// 生产环境托管前端构建产物
const webDist = path.resolve(__dirname, '../../web/dist');
const fs = require('fs');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: '接口不存在' });
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

module.exports = app;
