'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/services/dates');

test('todayShanghai 输出 YYYY-MM-DD', () => {
  assert.match(d.todayShanghai(), /^\d{4}-\d{2}-\d{2}$/);
});

test('diffDays 基本正负', () => {
  assert.equal(d.diffDays('2026-11-20', '2026-11-17'), 3);
  assert.equal(d.diffDays('2026-11-10', '2026-11-17'), -7);
  assert.equal(d.diffDays('2026-11-17', '2026-11-17'), 0);
});

test('addMonths 月末收敛：1/31 + 1 月 = 2/28（2026 非闰年）', () => {
  assert.equal(d.addMonths('2026-01-31', 1), '2026-02-28');
});
test('addMonths 闰年 1/31 + 1 月 = 2/29（2028 闰年）', () => {
  assert.equal(d.addMonths('2028-01-31', 1), '2028-02-29');
});
test('addMonths 跨年', () => {
  assert.equal(d.addMonths('2026-11-15', 3), '2027-02-15');
});

test('公历生日滚动：未到取当年，已过取明年', () => {
  assert.equal(d.nextSolarBirthday(11, 20, '2026-11-17'), '2026-11-20');
  assert.equal(d.nextSolarBirthday(11, 10, '2026-11-17'), '2027-11-10');
});
test('公历生日 2/29 在非闰年收敛到 2/28', () => {
  const r = d.nextSolarBirthday(2, 29, '2026-03-01');
  // 2027 非闰年 -> 2/28；但 2028 是闰年且更近的是 2027-02-28
  assert.equal(r, '2027-02-28');
});

test('农历生日：农历八月十五换算到当年公历且 >= 今天', () => {
  const r = d.nextLunarBirthday(8, 15, '2026-11-17');
  assert.match(r, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d.diffDays(r, '2026-11-17') >= 0);
});

test('农历闰月按同名平月处理不报错', () => {
  const r = d.nextLunarBirthday(2, 10, '2026-11-17');
  assert.match(r, /^\d{4}-\d{2}-\d{2}$/);
});

test('usedDuration 已用时长', () => {
  assert.equal(d.usedDuration('2025-01-20', '2026-11-17'), '1年9个月');
  assert.equal(d.usedDuration('2026-10-20', '2026-11-17'), '不到 1 个月');
  assert.equal(d.usedDuration('2025-11-17', '2026-11-17'), '1年');
});

test('computePerson 出生年可空不显示年龄', () => {
  const today = '2026-11-17';
  const withYear = d.computePerson({ calendar: 'solar', birth_month: 11, birth_day: 20, birth_year: 1985 }, today);
  assert.equal(withYear.age, 41);
  assert.equal(withYear.days, 3);
  const noYear = d.computePerson({ calendar: 'solar', birth_month: 11, birth_day: 20, birth_year: null }, today);
  assert.equal(noYear.age, null);
  assert.equal(noYear.days, 3);
});

test('computeItem 保修到期 = 购买日 + N 月', () => {
  const today = '2026-11-17';
  const it = d.computeItem({ purchase_date: '2025-01-20', warranty_months: 12 }, today);
  assert.equal(it.warrantyEnd, '2026-01-20');
  assert.ok(it.warrantyDays < 0); // 已过保
  assert.match(it.warrantyText, /已过/);
});

test('computeSubscription 过期显示已过期天数', () => {
  const s = d.computeSubscription({ expiry_date: '2026-11-10', cycle: 'year' }, '2026-11-17');
  assert.equal(s.days, -7);
  assert.equal(s.expired, true);
  assert.match(s.countdown, /已过期 7 天/);
});

test('buildOverview 分组筛选：30 天内、会员过期也纳入、已过保物品排除', () => {
  const today = '2026-11-17';
  const people = [
    d.computePerson({ calendar: 'solar', birth_month: 11, birth_day: 20, birth_year: null }, today), // 3 天
    d.computePerson({ calendar: 'solar', birth_month: 12, birth_day: 25, birth_year: null }, today), // 38 天 -> 排除
  ];
  const items = [
    d.computeItem({ purchase_date: '2026-01-01', warranty_months: 12 }, today), // 保修到期 2027-01-01 -> 45 天 -> 排除
    d.computeItem({ purchase_date: '2025-11-01', warranty_months: 12 }, today), // 到期 2026-11-01 -> 已过保 -> 排除
  ];
  const subs = [
    d.computeSubscription({ expiry_date: '2026-11-20', cycle: 'year' }, today), // 3 天
    d.computeSubscription({ expiry_date: '2026-11-10', cycle: 'year' }, today), // 过期 7 天 -> 纳入
  ];
  const ov = d.buildOverview(people, items, subs, today);
  assert.equal(ov.groups.birthdays.length, 1);
  assert.equal(ov.groups.subscriptions.length, 2);
  assert.equal(ov.groups.warranty.length, 0);
});
