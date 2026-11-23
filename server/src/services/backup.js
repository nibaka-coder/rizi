'use strict';

// 数据备份服务：JSON 导入导出 + SQLite 定时快照
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');

const TABLES = ['people', 'items', 'subscriptions'];
const BACKUP_FORMAT = 'rizi-backup';
const BACKUP_VERSION = 1;

// 备份目录（相对路径基于 server/ 目录，和 DB_PATH 一致）
const backupDir = path.isAbsolute(config.BACKUP_DIR)
  ? config.BACKUP_DIR
  : path.resolve(__dirname, '..', '..', config.BACKUP_DIR);
fs.mkdirSync(backupDir, { recursive: true });

// ---------- JSON 导出/导入 ----------

function exportData() {
  const data = {};
  for (const t of TABLES) data[t] = db.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appName: config.APP_NAME,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])),
    data,
  };
}

// mode: 'merge'（默认，按 id 存在则跳过，不存在则插入）| 'replace'（清空后导入）
function importData(payload, mode = 'merge') {
  if (!payload || payload.format !== BACKUP_FORMAT) {
    throw new Error('不是「日子」的备份文件（format 不匹配）');
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('备份文件缺少 data 字段');
  }
  for (const t of TABLES) {
    if (payload.data[t] != null && !Array.isArray(payload.data[t])) {
      throw new Error(`备份文件里的 ${t} 不是数组`);
    }
  }

  const result = { mode, inserted: {}, skipped: {}, total: 0 };
  const cols = {
    people: ['id', 'name', 'avatar', 'calendar', 'birth_year', 'birth_month', 'birth_day',
      'is_leap_month', 'remind_days', 'note', 'created_at', 'updated_at'],
    items: ['id', 'name', 'category', 'location', 'purchase_date', 'price', 'brand', 'model',
      'serial', 'warranty_months', 'receipt_path', 'note', 'created_at', 'updated_at'],
    subscriptions: ['id', 'name', 'account', 'purchase_date', 'duration', 'expiry_date', 'cycle', 'cost', 'payment_method',
      'remind_days', 'note', 'created_at', 'updated_at'],
  };

  db.transaction(() => {
    if (mode === 'replace') {
      for (const t of TABLES) db.exec(`DELETE FROM ${t}`);
    }
    for (const t of TABLES) {
      const rows = payload.data[t] || [];
      result.inserted[t] = 0;
      result.skipped[t] = 0;
      const allowed = cols[t];
      const insert = db.prepare(
        `INSERT INTO ${t} (${allowed.join(', ')}) VALUES (${allowed.map(() => '?').join(', ')})`
      );
      for (const row of rows) {
        if (!row || typeof row !== 'object') { result.skipped[t] += 1; continue; }
        if (mode === 'merge' && row.id != null && db.prepare(`SELECT 1 FROM ${t} WHERE id = ?`).get(row.id)) {
          result.skipped[t] += 1;
          continue;
        }
        const values = allowed.map((c) => (row[c] === undefined ? null : row[c]));
        // 必填字段缺失则跳过，避免脏数据入库
        if (t === 'people' && (!row.name || !row.birth_month || !row.birth_day)) {
          result.skipped[t] += 1; continue;
        }
        if (t === 'items' && (!row.name || !row.purchase_date)) {
          result.skipped[t] += 1; continue;
        }
        if (t === 'subscriptions' && (!row.name || !row.expiry_date)) {
          result.skipped[t] += 1; continue;
        }
        try {
          if (row.id != null) insert.run(...values);
          else {
            const noId = allowed.filter((c) => c !== 'id');
            const vals = noId.map((c) => (row[c] === undefined ? null : row[c]));
            db.prepare(`INSERT INTO ${t} (${noId.join(', ')}) VALUES (${noId.map(() => '?').join(', ')})`).run(...vals);
          }
          result.inserted[t] += 1;
        } catch (_) {
          result.skipped[t] += 1;
        }
      }
      result.total += result.inserted[t];
    }
  })();

  return result;
}

// ---------- SQLite 快照备份 ----------

function shanghaiDate() {
  // 用与日期算法一致的"今天"口径
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // YYYY-MM-DD
}

function backupNow() {
  const date = shanghaiDate();
  const file = path.join(backupDir, `rizi-${date}.db`);
  // better-sqlite3 的 backup 是异步的，这里用 VACUUM INTO 生成一致性快照（同步、锁安全）
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  prune();
  return { file: path.basename(file), size: fs.statSync(file).size, date };
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((f) => /^rizi-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse()
    .map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      return { file: f, size: st.size, mtime: st.mtime.toISOString() };
    });
}

function prune() {
  const files = fs.readdirSync(backupDir)
    .filter((f) => /^rizi-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse();
  for (const f of files.slice(config.BACKUP_KEEP)) {
    try { fs.unlinkSync(path.join(backupDir, f)); } catch (_) {}
  }
}

// 启动时若当天还没备份则补一份；之后每小时检查一次（只在该备份的小时之后执行）
let scheduler = null;
function startScheduler() {
  const check = () => {
    try {
      const date = shanghaiDate();
      const exists = fs.existsSync(path.join(backupDir, `rizi-${date}.db`));
      const hour = Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false,
      }).format(new Date()));
      if (!exists && hour >= config.BACKUP_HOUR) {
        backupNow();
        console.log(`[backup] 已创建当日快照 rizi-${date}.db`);
      }
    } catch (e) {
      console.error('[backup] 自动备份失败:', e.message);
    }
  };
  if (config.BACKUP_ON_START) check();
  scheduler = setInterval(check, 60 * 60 * 1000);
  if (scheduler.unref) scheduler.unref(); // 不阻止进程退出
}

module.exports = {
  exportData, importData, backupNow, listBackups, startScheduler,
  BACKUP_FORMAT, BACKUP_VERSION,
  backupDir,
};
