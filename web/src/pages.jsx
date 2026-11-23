import React from 'react';
import { CountBadge, Avatar, Empty } from './components';

const cycleText = { month: '每月', quarter: '每季', year: '每年' };

function StatCards({ groups }) {
  return (
    <div className="stats">
      <div className="stat"><span className="stat-num">{groups.subscriptions.length}</span><span className="stat-label">会员续费</span></div>
      <div className="stat"><span className="stat-num">{groups.birthdays.length}</span><span className="stat-label">亲人生日</span></div>
      <div className="stat"><span className="stat-num">{groups.warranty.length}</span><span className="stat-label">物品保修</span></div>
    </div>
  );
}

// 近期提醒首页
export function OverviewPage({ data, config, onOpen }) {
  if (!data) return <div className="loading">加载中…</div>;
  const { groups, windowDays, today } = data;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>近期提醒</h1>
          <p className="sub">未来 {windowDays} 天内需要你行动的事 · 今天 {today}</p>
        </div>
      </div>
      <StatCards groups={groups} />

      <section className="group">
        <h2 className="group-title"><span className="dot dot-sub" />会员续费</h2>
        {groups.subscriptions.length === 0
          ? <Empty text={`${windowDays} 天内没有到期的会员`} />
          : <div className="list">
              {groups.subscriptions.map((s) => (
                <button key={s.id} className="row" onClick={() => onOpen('sub', s)}>
                  <Avatar emoji="💳" bg="#fff0e8" fg="#d1622b" />
                  <div className="row-main">
                    <div className="row-title">{s.name}</div>
                    <div className="row-sub">{s.expiry_date} · {s.cost != null ? `¥${s.cost}` : '费用未填'}</div>
                  </div>
                  <CountBadge days={s.days} expired={s.expired} showToday="今天到期" />
                </button>
              ))}
            </div>}
      </section>

      <section className="group">
        <h2 className="group-title"><span className="dot dot-birthday" />亲人生日</h2>
        {groups.birthdays.length === 0
          ? <Empty text={`${windowDays} 天内没有生日`} />
          : <div className="list">
              {groups.birthdays.map((p) => (
                <button key={p.id} className="row" onClick={() => onOpen('person', p)}>
                  <Avatar emoji={p.avatar} />
                  <div className="row-main">
                    <div className="row-title">{p.name}</div>
                    <div className="row-sub">{p.dateLabel}{p.age ? ` · ${p.age}岁` : ''}</div>
                  </div>
                  <CountBadge days={p.days} showToday="就是今天" />
                </button>
              ))}
            </div>}
      </section>

      <section className="group">
        <h2 className="group-title"><span className="dot dot-warranty" />物品保修</h2>
        {groups.warranty.length === 0
          ? <Empty text={`${windowDays} 天内没有需要处理的物品保修`} />
          : <div className="list">
              {groups.warranty.map((it) => (
                <button key={it.id} className="row" onClick={() => onOpen('item', it)}>
                  <Avatar emoji="▣" bg="#eef3ff" fg="#3b6fd4" />
                  <div className="row-main">
                    <div className="row-title">{it.name}</div>
                    <div className="row-sub">保修至 {it.warrantyEnd}</div>
                  </div>
                  <CountBadge days={it.warrantyDays} showToday="今天到期" />
                </button>
              ))}
            </div>}
      </section>
    </div>
  );
}

// 亲人页
export function PeoplePage({ rows, onOpen }) {
  if (!rows) return <div className="loading">加载中…</div>;
  return (
    <div className="page">
      <div className="page-head"><div><h1>亲人</h1><p className="sub">生日与称呼，农历也记得住</p></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((p) => (
            <button key={p.id} className="row" onClick={() => onOpen('person', p)}>
              <Avatar emoji={p.avatar} />
              <div className="row-main">
                <div className="row-title">{p.name} <span className={`tag ${p.calendar === 'lunar' ? 'tag-lunar' : ''}`}>{p.calendar === 'lunar' ? '农历' : '公历'}</span></div>
                <div className="row-sub">
                  {p.calendar === 'lunar' ? p.dateLabel : `${Number(p.nextDate?.slice(5,7)) || p.birth_month}月${Number(p.nextDate?.slice(8,10)) || p.birth_day}日`}
                  {p.age ? ` · 将满 ${p.age} 岁` : (p.birth_year ? '' : ' · 未记年份')}
                </div>
              </div>
              <div className="row-right">
                <span className="count-text">{p.countdown || '—'}</span>
                <span className="chev">›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 物品页
export function ItemsPage({ rows, onOpen }) {
  if (!rows) return <div className="loading">加载中…</div>;
  return (
    <div className="page">
      <div className="page-head"><div><h1>物品</h1><p className="sub">买了什么、用了多久、保修到几时</p></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((it) => (
            <button key={it.id} className="row" onClick={() => onOpen('item', it)}>
              <Avatar emoji="▣" bg="#eef3ff" fg="#3b6fd4" />
              <div className="row-main">
                <div className="row-title">{it.name} <span className="tag">{it.category}</span></div>
                <div className="row-sub">
                  <span className="used">已用 {it.usedText}</span>
                  <span className={it.warrantyDays < 0 ? 'warranty-over' : ''}> · {it.warrantyText}</span>
                </div>
              </div>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 会员页
export function SubsPage({ rows, onOpen }) {
  if (!rows) return <div className="loading">加载中…</div>;
  return (
    <div className="page">
      <div className="page-head"><div><h1>会员</h1><p className="sub">到期与续费，别被自动扣款</p></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((s) => (
            <button key={s.id} className="row" onClick={() => onOpen('sub', s)}>
              <Avatar emoji="💳" bg="#fff0e8" fg="#d1622b" />
              <div className="row-main">
                <div className="row-title">{s.name} <span className="tag">{cycleText[s.cycle]}</span></div>
                <div className="row-sub">{s.expiry_date} 到期{s.cost != null ? ` · ¥${s.cost}` : ''}</div>
              </div>
              <div className="row-right">
                <span className={s.expired ? 'count-text danger' : 'count-text'}>{s.countdown}</span>
                <span className="chev">›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
