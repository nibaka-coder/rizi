'use strict';

const express = require('express');

/**
 * 通用 CRUD 路由工厂。
 * @param {object} db better-sqlite3 实例
 * @param {string} table 表名（内部白名单，来自代码，非用户输入）
 * @param {string[]} fields 允许写入的字段白名单
 */
function makeCrud(db, table, fields) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: '记录不存在' });
    res.json(row);
  });

  router.post('/', (req, res) => {
    const body = pick(req.body, fields);
    const cols = Object.keys(body);
    if (!cols.length) return res.status(400).json({ error: '请求体为空' });
    const placeholders = cols.map(() => '?').join(',');
    const info = db.prepare(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`
    ).run(...cols.map((c) => normalize(body[c])));
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  });

  router.put('/:id', (req, res) => {
    const body = pick(req.body, fields);
    const cols = Object.keys(body);
    if (!cols.length) return res.status(400).json({ error: '请求体为空' });
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .run(...cols.map((c) => normalize(body[c])), req.params.id);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: '记录不存在' });
    res.json(row);
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: '记录不存在' });
    res.status(204).end();
  });

  return router;
}

function pick(obj, fields) {
  const out = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  }
  return out;
}

function normalize(v) {
  if (v === '' || v === undefined) return null;
  return v;
}

module.exports = { makeCrud };
