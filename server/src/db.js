'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

// 保证数据目录存在
const dbFullPath = path.isAbsolute(DB_PATH) ? DB_PATH : path.resolve(__dirname, '..', DB_PATH);
fs.mkdirSync(path.dirname(dbFullPath), { recursive: true });

const db = new Database(dbFullPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    avatar        TEXT DEFAULT '',
    calendar      TEXT NOT NULL DEFAULT 'solar' CHECK(calendar IN ('solar','lunar')),
    birth_year    INTEGER,
    birth_month   INTEGER NOT NULL,
    birth_day     INTEGER NOT NULL,
    is_leap_month INTEGER NOT NULL DEFAULT 0,
    remind_days   INTEGER NOT NULL DEFAULT 7,
    note          TEXT DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT '其他',
    location        TEXT DEFAULT '',
    purchase_date   TEXT NOT NULL,
    price           REAL,
    brand           TEXT DEFAULT '',
    model           TEXT DEFAULT '',
    serial          TEXT DEFAULT '',
    warranty_months INTEGER,
    receipt_path    TEXT DEFAULT '',
    note            TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    account         TEXT DEFAULT '',
    purchase_date   TEXT,
    duration        INTEGER,
    expiry_date     TEXT NOT NULL,
    cycle           TEXT NOT NULL DEFAULT 'year' CHECK(cycle IN ('month','quarter','year')),
    cost            REAL,
    payment_method  TEXT DEFAULT '',
    remind_days     INTEGER NOT NULL DEFAULT 7,
    note            TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 认证：单行配置（密码哈希）+ 会话表
  CREATE TABLE IF NOT EXISTS auth (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    salt          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
  );
`);

// 旧库迁移：早期版本只有 expiry_date（购买日+时长是后加的字段）。
// 用 PRAGMA 检查列是否存在，缺列则补，保证已部署的库升级不丢数据。
{
  const cols = db.prepare('PRAGMA table_info(subscriptions)').all().map((c) => c.name);
  if (!cols.includes('purchase_date')) db.exec('ALTER TABLE subscriptions ADD COLUMN purchase_date TEXT');
  if (!cols.includes('duration')) db.exec('ALTER TABLE subscriptions ADD COLUMN duration INTEGER');
}

module.exports = db;
