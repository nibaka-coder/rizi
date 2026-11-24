import React, { useEffect } from 'react';
import { Icon } from './icons';

// 倒计时徽标：临近紫色、今天高亮、过期红色。支持大号用于 Hero 区。
export function CountBadge({ days, expired, showToday }) {
  let cls = 'badge';
  let text;
  if (expired) { cls += ' badge-danger'; text = `已过${-days}天`; }
  else if (days === 0) { cls += ' badge-today'; text = showToday || '今天'; }
  else { cls += ' badge-normal'; text = `${days}天`; }
  return <span className={cls}>{text}</span>;
}

// 头像：优先用线性图标（tone 决定配色），否则用自定义 emoji。
const TONE_COLORS = {
  sub: { bg: '#fff1e8', fg: '#e07a3f' },
  birthday: { bg: '#f3ecff', fg: '#8b5cf6' },
  warranty: { bg: '#eaf1ff', fg: '#4a7bd4' },
  person: { bg: '#f3ecff', fg: '#8b5cf6' },
};

export function Avatar({ emoji, icon, bg, fg, tone = 'person', size = 'md' }) {
  const palette = TONE_COLORS[tone] || TONE_COLORS.person;
  return (
    <span className={`avatar avatar-${size}`} style={{ background: bg || palette.bg, color: fg || palette.fg }}>
      {icon ? <Icon name={icon} size={size === 'lg' ? 24 : 20} /> : (emoji || '·')}
    </span>
  );
}

export function Empty({ text }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name="inbox" size={30} /></span>
      <span>{text}</span>
    </div>
  );
}

// 通用弹窗壳
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// 表单字段
export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}{hint && <em> · {hint}</em>}</span>
      {children}
    </label>
  );
}
