import React from 'react';
import { CountBadge, Avatar, Empty } from './components';
import { Icon } from './icons';

const cycleText = { month: '每月', quarter: '每季', year: '每年' };
const cycleUnit = { month: '个月', quarter: '个季度', year: '年' };

// 把 yyyy-mm-dd 拆成适合 Hero 展示的中文日期
function heroDate(today) {
  if (!today) return { monthDay: '', weekday: '' };
  const [y, m, d] = today.split('-').map(Number);
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const w = new Date(y, m - 1, d).getDay();
  return { monthDay: `${m}月${d}日`, weekday: week[w] };
}

// 首页顶部 Hero：日期锚点 + 三类事项总数
function Hero({ today, groups }) {
  const { monthDay, weekday } = heroDate(today);
  const total = groups.subscriptions.length + groups.birthdays.length + groups.warranty.length;
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-date">
        <span className="hero-weekday">{weekday}</span>
        <span className="hero-monthday">{monthDay}</span>
      </div>
      <div className="hero-summary">
        <span className="hero-summary-main">{total > 0 ? `${total} 件` : '暂无'}</span>
        <span className="hero-summary-sub">{total > 0 ? '件重要的事在 30 天内' : '近期没有需要留意的事'}</span>
      </div>
    </section>
  );
}

function StatCards({ groups }) {
  const stats = [
    { key: 'sub', icon: 'card', label: '会员续费', value: groups.subscriptions.length },
    { key: 'birthday', icon: 'gift', label: '亲人生日', value: groups.birthdays.length },
    { key: 'warranty', icon: 'shield', label: '物品保修', value: groups.warranty.length },
  ];
  return (
    <div className="stats">
      {stats.map((s) => (
        <div className={`stat stat-${s.key}`} key={s.key}>
          <span className="stat-icon"><Icon name={s.icon} size={20} /></span>
          <span className="stat-num">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// 分组标题
function GroupTitle({ tone, icon, children }) {
  return (
    <h2 className="group-title">
      <span className={`group-icon group-icon-${tone}`}><Icon name={icon} size={15} /></span>
      {children}
    </h2>
  );
}

// 近期提醒首页
export function OverviewPage({ data, config, onOpen }) {
  if (!data) return <div className="loading">加载中…</div>;
  const { groups, windowDays, today } = data;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>近期提醒</h1></div>
      </div>
      <Hero today={today} groups={groups} />
      <StatCards groups={groups} />

      <section className="group">
        <GroupTitle tone="sub" icon="card">会员续费</GroupTitle>
        {groups.subscriptions.length === 0
          ? <Empty text={`${windowDays} 天内没有到期的会员`} />
          : <div className="list">
              {groups.subscriptions.map((s) => (
                <button key={s.id} className="row" onClick={() => onOpen('sub', s)}>
                  <Avatar icon="card" tone="sub" />
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
        <GroupTitle tone="birthday" icon="gift">亲人生日</GroupTitle>
        {groups.birthdays.length === 0
          ? <Empty text={`${windowDays} 天内没有生日`} />
          : <div className="list">
              {groups.birthdays.map((p) => (
                <button key={p.id} className="row" onClick={() => onOpen('person', p)}>
                  <Avatar emoji={p.avatar} tone="birthday" />
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
        <GroupTitle tone="warranty" icon="shield">物品保修</GroupTitle>
        {groups.warranty.length === 0
          ? <Empty text={`${windowDays} 天内没有需要处理的物品保修`} />
          : <div className="list">
              {groups.warranty.map((it) => (
                <button key={it.id} className="row" onClick={() => onOpen('item', it)}>
                  <Avatar icon="box" tone="warranty" />
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
      <div className="page-head"><div><h1>亲人</h1></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((p) => (
            <button key={p.id} className="row" onClick={() => onOpen('person', p)}>
              <Avatar emoji={p.avatar} tone="birthday" />
              <div className="row-main">
                <div className="row-title">{p.name} <span className={`tag ${p.calendar === 'lunar' ? 'tag-lunar' : ''}`}>{p.calendar === 'lunar' ? '农历' : '公历'}</span></div>
                <div className="row-sub">
                  {p.calendar === 'lunar' ? p.dateLabel : `${Number(p.nextDate?.slice(5,7)) || p.birth_month}月${Number(p.nextDate?.slice(8,10)) || p.birth_day}日`}
                  {p.age ? ` · 将满 ${p.age} 岁` : (p.birth_year ? '' : ' · 未记年份')}
                </div>
              </div>
              <div className="row-right">
                <span className="count-text">{p.countdown || '—'}</span>
                <span className="chev"><Icon name="chevron" size={17} /></span>
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
      <div className="page-head"><div><h1>物品</h1></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((it) => (
            <button key={it.id} className="row" onClick={() => onOpen('item', it)}>
              <Avatar icon="box" tone="warranty" />
              <div className="row-main">
                <div className="row-title">{it.name} <span className="tag">{it.category}</span></div>
                <div className="row-sub">
                  <span className="used">已用 {it.usedText}</span>
                  <span className={it.warrantyDays < 0 ? 'warranty-over' : ''}> · {it.warrantyText}</span>
                </div>
              </div>
              <span className="chev"><Icon name="chevron" size={17} /></span>
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
      <div className="page-head"><div><h1>会员</h1></div></div>
      {rows.length === 0 ? <Empty text="还没有记录，点右上角新增" /> : (
        <div className="list card-list">
          {rows.map((s) => (
            <button key={s.id} className="row" onClick={() => onOpen('sub', s)}>
              <Avatar icon="card" tone="sub" />
              <div className="row-main">
                <div className="row-title">{s.name} <span className="tag">{(s.duration != null && s.purchase_date) ? `${s.duration}${cycleUnit[s.cycle] || '年'}` : cycleText[s.cycle]}</span></div>
                <div className="row-sub">{s.expiry_date} 到期{s.purchase_date ? ` · 购于 ${s.purchase_date}` : ''}{s.cost != null ? ` · ¥${s.cost}` : ''}</div>
              </div>
              <div className="row-right">
                <span className={s.expired ? 'count-text danger' : 'count-text'}>{s.countdown}</span>
                <span className="chev"><Icon name="chevron" size={17} /></span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
