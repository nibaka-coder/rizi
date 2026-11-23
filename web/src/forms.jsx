import React, { useState, useEffect } from 'react';
import { Modal, Field } from './components';

const TODAY = new Date().toISOString().slice(0, 10);

function toForm(row, defaults) {
  return { ...defaults, ...(row || {}) };
}

// 与后端一致的"加 N 个月 + 月末收敛"，仅用于表单里实时预览到期日
function addMonths(dateStr, months) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const total = y * 12 + (m - 1) + Number(months);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}
const CYCLE_MONTHS = { month: 1, quarter: 3, year: 12 };

// 编辑旧数据（只有到期日、没有购买日）时，反推出一个购买日，保证编辑后语义连续
function subInitial(row) {
  const base = {
    name: '', account: '', purchase_date: TODAY, duration: 1, cycle: 'year',
    cost: '', payment_method: '', remind_days: 7, note: '',
  };
  if (!row) return base;
  const merged = { ...base, ...row };
  if (!row.purchase_date && row.expiry_date) {
    const unit = CYCLE_MONTHS[row.cycle] || CYCLE_MONTHS.year;
    const duration = Number(row.duration) || 1;
    merged.purchase_date = addMonths(row.expiry_date, -duration * unit);
    merged.duration = duration;
  }
  merged.duration = Number(merged.duration) || 1;
  return merged;
}

// 亲人表单
export function PersonForm({ initial, config, onSave, onClose }) {
  const [f, setF] = useState(() => toForm(initial, {
    name: '', avatar: '👤', calendar: 'solar', birth_year: '',
    birth_month: '', birth_day: '', is_leap_month: 0, remind_days: 7, note: '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...f,
        birth_year: f.birth_year === '' ? null : Number(f.birth_year),
        birth_month: Number(f.birth_month),
        birth_day: Number(f.birth_day),
        is_leap_month: Number(f.is_leap_month),
        remind_days: Number(f.remind_days),
      });
    } finally { setSaving(false); }
  };
  return (
    <Modal title={initial ? '编辑亲人' : '新增亲人'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="form-row">
          <Field label="称呼"><input value={f.name} onChange={set('name')} placeholder="如：妈妈" required /></Field>
          <Field label="头像"><input value={f.avatar} onChange={set('avatar')} placeholder="emoji，如 🎂" /></Field>
        </div>
        <Field label="历法">
          <div className="segmented">
            <button type="button" className={f.calendar === 'solar' ? 'on' : ''} onClick={() => setF({ ...f, calendar: 'solar' })}>公历</button>
            <button type="button" className={f.calendar === 'lunar' ? 'on' : ''} onClick={() => setF({ ...f, calendar: 'lunar' })}>农历</button>
          </div>
        </Field>
        <div className="form-row">
          <Field label="出生年份"><input type="number" value={f.birth_year || ''} onChange={set('birth_year')} placeholder="1985" /></Field>
          <Field label="出生月"><input type="number" min="1" max="12" value={f.birth_month} onChange={set('birth_month')} placeholder="11" required /></Field>
          <Field label="出生日"><input type="number" min="1" max="31" value={f.birth_day} onChange={set('birth_day')} placeholder="20" required /></Field>
        </div>
        {f.calendar === 'lunar' && (
          <label className="check">
            <input type="checkbox" checked={!!Number(f.is_leap_month)} onChange={(e) => setF({ ...f, is_leap_month: e.target.checked ? 1 : 0 })} />
            农历闰月出生
          </label>
        )}
        <Field label="提前提醒（天）"><input type="number" min="0" value={f.remind_days} onChange={set('remind_days')} /></Field>
        <Field label="备注"><textarea value={f.note} onChange={set('note')} placeholder="礼物想法、喜好…" rows="2" /></Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </Modal>
  );
}

// 物品表单
export function ItemForm({ initial, config, onSave, onClose }) {
  const [f, setF] = useState(() => toForm(initial, {
    name: '', category: config?.itemCategories?.[0] || '其他', location: '',
    purchase_date: TODAY, price: '', brand: '', model: '', serial: '',
    warranty_months: '', receipt_path: '', note: '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...f,
        price: f.price === '' ? null : Number(f.price),
        warranty_months: f.warranty_months === '' ? null : Number(f.warranty_months),
      });
    } finally { setSaving(false); }
  };
  return (
    <Modal title={initial ? '编辑物品' : '新增物品'} onClose={onClose} wide>
      <form onSubmit={submit} className="form">
        <div className="form-row">
          <Field label="名称"><input value={f.name} onChange={set('name')} placeholder="如：索尼电视 65寸" required /></Field>
          <Field label="分类">
            <select value={f.category} onChange={set('category')}>
              {(config?.itemCategories || ['家电', '数码', '车辆', '证件', '其他']).map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="位置"><input value={f.location} onChange={set('location')} placeholder="客厅" /></Field>
        </div>
        <div className="form-row">
          <Field label="购买日期"><input type="date" value={f.purchase_date} onChange={set('purchase_date')} required /></Field>
          <Field label="价格（元）"><input type="number" step="0.01" value={f.price || ''} onChange={set('price')} placeholder="8999" /></Field>
          <Field label="保修月数"><input type="number" min="0" value={f.warranty_months || ''} onChange={set('warranty_months')} placeholder="12" /></Field>
        </div>
        <div className="form-row">
          <Field label="品牌"><input value={f.brand} onChange={set('brand')} placeholder="索尼" /></Field>
          <Field label="型号"><input value={f.model} onChange={set('model')} /></Field>
          <Field label="序列号"><input value={f.serial} onChange={set('serial')} /></Field>
        </div>
        <Field label="发票照片路径"><input value={f.receipt_path} onChange={set('receipt_path')} placeholder="/path/to/receipt.jpg" /></Field>
        <Field label="备注"><textarea value={f.note} onChange={set('note')} rows="2" /></Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </Modal>
  );
}

// 会员表单：填"购买日期 + 时长 + 单位"，到期日自动算出，不用自己算
export function SubForm({ initial, config, onSave, onClose }) {
  const [f, setF] = useState(() => subInitial(initial));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const previewExpiry = (f.purchase_date && f.duration)
    ? addMonths(f.purchase_date, Number(f.duration) * (CYCLE_MONTHS[f.cycle] || CYCLE_MONTHS.year))
    : null;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...f,
        duration: Number(f.duration),
        cost: f.cost === '' ? null : Number(f.cost),
        remind_days: Number(f.remind_days),
      });
    } finally { setSaving(false); }
  };
  return (
    <Modal title={initial ? '编辑会员' : '新增会员'} onClose={onClose} wide>
      <form onSubmit={submit} className="form">
        <div className="form-row">
          <Field label="名称"><input value={f.name} onChange={set('name')} placeholder="Netflix" required /></Field>
          <Field label="账号归属"><input value={f.account} onChange={set('account')} placeholder="谁的名下" /></Field>
          <Field label="购买日期"><input type="date" value={f.purchase_date || ''} onChange={set('purchase_date')} required /></Field>
        </div>
        <div className="form-row">
          <Field label="时长"><input type="number" min="1" value={f.duration} onChange={set('duration')} required /></Field>
          <Field label="单位">
            <select value={f.cycle} onChange={set('cycle')}>
              <option value="month">个月</option>
              <option value="quarter">个季度</option>
              <option value="year">年</option>
            </select>
          </Field>
          <Field label="费用"><input type="number" step="0.01" value={f.cost || ''} onChange={set('cost')} placeholder="68" /></Field>
          <Field label="支付方式"><input value={f.payment_method} onChange={set('payment_method')} placeholder="自动续费/支付宝" /></Field>
        </div>
        <div className="expiry-preview">
          到期日期（自动计算）：<strong>{previewExpiry || '请先填购买日期和时长'}</strong>
        </div>
        <Field label="提前提醒（天）"><input type="number" min="0" value={f.remind_days} onChange={set('remind_days')} /></Field>
        <Field label="备注"><textarea value={f.note} onChange={set('note')} rows="2" /></Field>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="submit" className="btn primary" disabled={saving || !previewExpiry}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </Modal>
  );
}
