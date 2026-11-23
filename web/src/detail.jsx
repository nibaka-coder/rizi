import React from 'react';
import { Modal } from './components';

function Row({ k, v }) {
  return <div className="detail-row"><span className="dk">{k}</span><span className="dv">{v ?? '—'}</span></div>;
}

export function DetailDrawer({ type, data, onClose, onEdit, onDelete, onRenew }) {
  if (!data) return null;
  let title = '', body = null;

  if (type === 'person') {
    title = data.name;
    body = <>
      <Row k="称呼" v={data.name} />
      <Row k="历法" v={data.calendar === 'lunar' ? '农历' : '公历'} />
      <Row k="生日" v={data.calendar === 'lunar' ? `农历${data.birth_month}月${data.birth_day}日` : `${data.birth_month}月${data.birth_day}日`} />
      <Row k="出生年" v={data.birth_year || '未记录'} />
      <Row k="下次生日" v={data.nextDate} />
      <Row k="倒计时" v={data.countdown} />
      {data.age && <Row k="将满" v={`${data.age} 岁`} />}
      <Row k="提前提醒" v={`${data.remind_days} 天`} />
      <Row k="备注" v={data.note} />
    </>;
  } else if (type === 'item') {
    title = data.name;
    body = <>
      <Row k="名称" v={data.name} />
      <Row k="分类" v={data.category} />
      <Row k="位置" v={data.location} />
      <Row k="购买日" v={data.purchase_date} />
      <Row k="已用时长" v={data.usedText} />
      <Row k="价格" v={data.price != null ? `¥${data.price}` : null} />
      <Row k="品牌型号" v={[data.brand, data.model].filter(Boolean).join(' ')} />
      <Row k="序列号" v={data.serial} />
      <Row k="保修月数" v={data.warranty_months} />
      <Row k="保修到期" v={data.warrantyEnd || '未记录'} />
      <Row k="保修状态" v={data.warrantyText} />
      <Row k="发票路径" v={data.receipt_path} />
      <Row k="备注" v={data.note} />
    </>;
  } else if (type === 'sub') {
    title = data.name;
    const unitText = { month: '个月', quarter: '个季度', year: '年' };
    body = <>
      <Row k="名称" v={data.name} />
      <Row k="账号归属" v={data.account} />
      <Row k="购买日期" v={data.purchase_date || '未记录'} />
      {data.purchase_date != null && data.duration != null && (
        <Row k="购买时长" v={`${data.duration} ${unitText[data.cycle] || '年'}`} />
      )}
      <Row k="到期日" v={data.expiry_date} />
      <Row k="费用" v={data.cost != null ? `¥${data.cost}` : null} />
      <Row k="支付方式" v={data.payment_method} />
      <Row k="状态" v={data.countdown} />
      <Row k="提前提醒" v={`${data.remind_days} 天`} />
      <Row k="备注" v={data.note} />
    </>;
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="detail">{body}</div>
      <div className="detail-actions">
        {type === 'sub' && <button className="btn success" onClick={() => onRenew(data)}>✓ 标记已续费</button>}
        <button className="btn ghost" onClick={() => onEdit(type, data)}>编辑</button>
        <button className="btn danger-ghost" onClick={() => onDelete(type, data)}>删除</button>
      </div>
    </Modal>
  );
}
