'use strict';

const express = require('express');
const path = require('path');
const db = require('./db');
const config = require('./config');
const { makeCrud } = require('./routes/crud');
const backup = require('./services/backup');
const {
  todayShanghai,
  computePerson,
  computeItem,
  computeSubscription,
  buildOverview,
  addMonths,
} = require('./services/dates');

const app = express();
app.use(express.json());

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

// 会员"标记已续费"：到期日推进一个周期
app.post('/api/subscriptions/:id/renew', (req, res) => {
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  const months = config.CYCLE_MONTHS[row.cycle] || 12;
  // 若已过期多个周期，推进到第一个不早于今天的到期日
  let next = addMonths(row.expiry_date, months);
  const today = todayShanghai();
  let guard = 0;
  while (next < today && guard < 240) {
    next = addMonths(next, months);
    guard += 1;
  }
  db.prepare("UPDATE subscriptions SET expiry_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(next, req.params.id);
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
  'name', 'account', 'expiry_date', 'cycle', 'cost', 'payment_method',
  'remind_days', 'note',
]));

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
