'use strict';

// 应用名集中在这里定义，前端通过 /api/config 读取，改名只需改这一处。
const APP_NAME = process.env.APP_NAME || '时间管理局';

// 近期提醒首页的窗口天数：只显示距今天数 <= 该值的条目。
const UPCOMING_DAYS = Number(process.env.UPCOMING_DAYS || 30);

// 物品分类：固定几类下拉选（方案第一期确定用固定分类）。
const ITEM_CATEGORIES = ['家电', '数码', '车辆', '证件', '其他'];

// 会员周期 -> 推进月数
const CYCLE_MONTHS = { month: 1, quarter: 3, year: 12 };

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || './data/rizi.db';

// 自动备份
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups';
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP || 7);       // 保留最近 N 份
const BACKUP_HOUR = Number(process.env.BACKUP_HOUR || 3);       // 每天几点后执行（0-23）
const BACKUP_ON_START = process.env.BACKUP_ON_START !== 'false'; // 启动时若当天无备份则补一份

// 访问认证
// SETUP_KEY：可选。设置后，首次设置密码必须提供此密钥，防止他人抢先设置密码把你锁在外面。
// 不设置则任何人首次打开都可设置密码——适合只有你知道域名的场景。
const SETUP_KEY = process.env.SETUP_KEY || '';
// 会话有效期（天）
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
// Cookie 是否强制 Secure（默认开启，仅在 HTTPS 下需要；本地 HTTP 调试可设 false）
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';

module.exports = {
  APP_NAME,
  UPCOMING_DAYS,
  ITEM_CATEGORIES,
  CYCLE_MONTHS,
  PORT,
  DB_PATH,
  BACKUP_DIR,
  BACKUP_KEEP,
  BACKUP_HOUR,
  BACKUP_ON_START,
  SETUP_KEY,
  SESSION_DAYS,
  COOKIE_SECURE,
};
