'use strict';

// 忘记密码时，在服务器上直接重置登录密码（不影响任何业务数据）。
//
// 用法：
//   npm run auth:reset -- 你的新密码
//   npm run auth:reset -- --dry-run 你的新密码   （只预览，不改动）
//
// Docker 部署时，在服务器上（项目目录内）执行：
//   docker compose exec rizi npm run auth:reset -- 你的新密码
//
// 说明：
//   - 只改 auth 表里的密码哈希，亲人/物品/会员数据一律不动。
//   - 重置后所有设备的登录会话立即失效，需用新密码重新登录。
//   - 新密码至少 6 位。

const db = require('../src/db');
const auth = require('../src/services/auth');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const password = args.filter((a) => a !== '--dry-run').join(' ').trim();

function fail(msg) {
  console.error(`错误：${msg}`);
  console.error('用法：npm run auth:reset -- 你的新密码');
  process.exit(1);
}

try {
  if (!password) fail('请提供新密码');
  if (password.length < 6) fail('密码至少 6 位');

  const hasPassword = auth.hasPassword();
  // 统计业务数据，向用户确认这些数据不会被动到
  const counts = ['people', 'items', 'subscriptions']
    .map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]);

  console.log(dryRun ? '【预览】' : '【重置登录密码】');
  console.log(`  当前状态：${hasPassword ? '已有密码（将覆盖）' : '尚未设置密码（将创建）'}`);
  console.log('  以下业务数据不会改变：');
  for (const [t, n] of counts) console.log(`    ${t.padEnd(14)} ${n} 条`);
  console.log(`  新密码长度：${password.length} 位`);

  if (dryRun) {
    console.log('（--dry-run，未做任何改动）');
    process.exit(0);
  }

  db.transaction(() => {
    auth.setPassword(password);
    auth.deleteAllSessions(); // 让所有旧会话失效
  })();

  console.log('✅ 密码已重置，所有设备需重新登录。请用新密码打开应用登录。');
} finally {
  db.close();
}
