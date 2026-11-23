import React, { useEffect } from 'react';

// 倒计时数字徽标：正数蓝色、今天高亮、过期红色
export function CountBadge({ days, expired, showToday }) {
  let cls = 'badge';
  let text;
  if (expired) { cls += ' badge-danger'; text = `已过${-days}天`; }
  else if (days === 0) { cls += ' badge-today'; text = showToday || '今天'; }
  else { cls += ' badge-normal'; text = `${days}天`; }
  return <span className={cls}>{text}</span>;
}

// 分类小圆点/emoji 头像
export function Avatar({ emoji, bg, fg }) {
  return (
    <span className="avatar" style={{ background: bg || '#efecff', color: fg || '#5b4bd6' }}>
      {emoji || '·'}
    </span>
  );
}

export function Empty({ text }) {
  return <div className="empty">📭 {text}</div>;
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
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
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
