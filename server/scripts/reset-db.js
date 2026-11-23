'use strict';

// 清空三张表的数据（保留表结构），用于部署后移除演示数据、或重新开始时用。
// 用法：npm run db:reset            （清空并重置自增 ID）
//       npm run db:reset -- --dry-run （只看会清掉多少条，不真的删）

const db = require('../src/db');

const dryRun = process.argv.includes('--dry-run');
const tables = ['people', 'items', 'subscriptions'];

try {
  const counts = tables.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]);
  console.log(dryRun ? '【预览】当前各表记录数：' : '即将清空以下记录：');
  for (const [t, n] of counts) console.log(`  ${t.padEnd(14)} ${n} 条`);
  const total = counts.reduce((s, [, n]) => s + n, 0);

  if (dryRun) {
    console.log('（--dry-run，未做任何改动）');
    process.exit(0);
  }

  if (total === 0) {
    console.log('数据库已是空的，无需清空。');
    process.exit(0);
  }

  db.transaction(() => {
    for (const t of tables) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('people','items','subscriptions')");
  })();

  console.log(`已清空 ${total} 条记录（表结构保留，自增 ID 重置）。`);
} finally {
  db.close();
}
