'use strict';

// 所有"今天"按 Asia/Shanghai 计算，统一口径，避免跨零点差一天。
const TZ = 'Asia/Shanghai';
const { Solar, Lunar } = require('lunar-javascript');
const { UPCOMING_DAYS } = require('../config');

const MS_PER_DAY = 86400000;

/** 返回上海时区当天的 'YYYY-MM-DD' */
function todayShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 'YYYY-MM-DD' -> UTC 零点 Date（避免本地时区漂移） */
function parseDate(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date -> 'YYYY-MM-DD' */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/** a - b 相差天数（整数，a 晚于 b 为正） */
function diffDays(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / MS_PER_DAY);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 加 N 个月，日超出当月天数时收敛到月末（如 1/31 + 1 月 = 2/28） */
function addMonths(dateStr, months) {
  const base = parseDate(dateStr);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1; // 1-12
  const d = base.getUTCDate();
  const total = y * 12 + (m - 1) + Number(months);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return formatDate(new Date(Date.UTC(ny, nm - 1, nd)));
}

/** 公历下次生日：已过则取明年；2/29 在非闰年收敛到 2/28 */
function nextSolarBirthday(month, day, today) {
  const ty = Number(today.slice(0, 4));
  for (const year of [ty, ty + 1, ty + 2]) {
    const md = Math.min(Number(day), daysInMonth(year, Number(month)));
    const cand = `${year}-${String(month).padStart(2, '0')}-${String(md).padStart(2, '0')}`;
    if (diffDays(cand, today) >= 0) return cand;
  }
  return null;
}

/**
 * 农历下次生日：在候选年份里用 Lunar.fromYmd 求对应公历日。
 * 闰月按同名平月处理（与方案/忆辰一致）；某年无该日则跳过该年。
 */
function nextLunarBirthday(month, day, today) {
  const ty = Number(today.slice(0, 4));
  for (const year of [ty - 1, ty, ty + 1, ty + 2, ty + 3]) {
    let solar;
    try {
      solar = Lunar.fromYmd(year, Number(month), Number(day)).getSolar();
    } catch (e) {
      continue;
    }
    if (!solar) continue;
    const cand = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`;
    if (diffDays(cand, today) >= 0) return cand;
  }
  return null;
}

/** 公历日期转成中文农历展示，如 '农历十月十九' */
function lunarLabel(dateStr) {
  try {
    const lunar = parseDate(dateStr) && Solar.fromYmd(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)),
      Number(dateStr.slice(8, 10))
    ).getLunar();
    return `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  } catch (e) {
    return '农历';
  }
}

/** 已用时长：'X年Y个月' */
function usedDuration(purchaseDate, today) {
  const start = parseDate(purchaseDate);
  const end = parseDate(today);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0 && m === 0) return '不到 1 个月';
  if (y === 0) return `${m}个月`;
  if (m === 0) return `${y}年`;
  return `${y}年${m}个月`;
}

/** 把剩余天数格式化成人类可读：正数显示时长，负数显示已过 */
function remainingLabel(days, prefix = '剩') {
  if (days >= 0) {
    if (days === 0) return '就是今天';
    if (days === 1) return '明天';
    if (days < 30) return `${prefix} ${days} 天`;
    if (days < 365) return `${prefix} ${Math.floor(days / 30)} 个月`;
    return `${prefix} ${(days / 365).toFixed(1)} 年`;
  }
  const over = -days;
  if (over < 30) return `已过 ${over} 天`;
  if (over < 365) return `已过 ${Math.floor(over / 30)} 个月`;
  return `已过 ${(over / 365).toFixed(1)} 年`;
}

/** 亲人：算出下次生日、倒计时天数、年龄 */
function computePerson(p, today) {
  const nextDate = p.calendar === 'lunar'
    ? nextLunarBirthday(p.birth_month, p.birth_day, today)
    : nextSolarBirthday(p.birth_month, p.birth_day, today);
  const days = nextDate ? diffDays(nextDate, today) : null;
  const age = (p.birth_year && nextDate)
    ? Number(nextDate.slice(0, 4)) - Number(p.birth_year)
    : null;
  return {
    ...p,
    nextDate,
    days,
    age,
    dateLabel: nextDate
      ? (p.calendar === 'lunar' ? lunarLabel(nextDate) : `${Number(nextDate.slice(5, 7))}月${Number(nextDate.slice(8, 10))}日`)
      : '',
    countdown: days === null ? '' : (days === 0 ? '今天' : `${days} 天`),
  };
}

/** 物品：保修到期 = 购买日 + N 月（固定不滚动）；已用时长正计时 */
function computeItem(it, today) {
  const warrantyEnd = it.warranty_months ? addMonths(it.purchase_date, it.warranty_months) : null;
  const warrantyDays = warrantyEnd ? diffDays(warrantyEnd, today) : null;
  return {
    ...it,
    warrantyEnd,
    warrantyDays,
    warrantyText: warrantyEnd ? remainingLabel(warrantyDays) : '未记录保修',
    usedText: usedDuration(it.purchase_date, today),
  };
}

/** 会员：到期倒计时；过期持续为正数天数提示直到处理 */
function computeSubscription(s, today) {
  const days = diffDays(s.expiry_date, today);
  return {
    ...s,
    days,
    expired: days < 0,
    countdown: days < 0 ? `已过期 ${-days} 天` : (days === 0 ? '今天到期' : `${days} 天`),
  };
}

/**
 * 近期提醒首页：从三张表各筛出"距今天数 <= UPCOMING_DAYS"的条目，按类型分组，不混排。
 * 会员：expired 也要纳入（需要行动）；物品：已过保不倒计时，不纳入。
 */
function buildOverview(people, items, subs, today) {
  const needAction = (d) => d !== null && d >= 0 && d <= UPCOMING_DAYS;
  return {
    today,
    windowDays: UPCOMING_DAYS,
    groups: {
      subscriptions: subs.filter((s) => s.days <= UPCOMING_DAYS).sort((a, b) => a.days - b.days),
      birthdays: people.filter((p) => needAction(p.days)).sort((a, b) => a.days - b.days),
      warranty: items.filter((it) => it.warrantyDays !== null && needAction(it.warrantyDays))
        .sort((a, b) => a.warrantyDays - b.warrantyDays),
    },
  };
}

module.exports = {
  TZ,
  todayShanghai,
  parseDate,
  formatDate,
  diffDays,
  addMonths,
  nextSolarBirthday,
  nextLunarBirthday,
  lunarLabel,
  usedDuration,
  remainingLabel,
  computePerson,
  computeItem,
  computeSubscription,
  buildOverview,
};
