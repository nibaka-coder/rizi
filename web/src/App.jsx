import React, { useState, useEffect, useCallback } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { OverviewPage, PeoplePage, ItemsPage, SubsPage } from './pages';
import { PersonForm, ItemForm, SubForm } from './forms';
import { DetailDrawer } from './detail';
import { SettingsModal } from './settings';
import { AuthGate } from './auth';
import { Icon } from './icons';

const NAV = [
  { key: 'overview', label: '近期', icon: 'home' },
  { key: 'people', label: '亲人', icon: 'heart' },
  { key: 'items', label: '物品', icon: 'box' },
  { key: 'subs', label: '会员', icon: 'card' },
];

const COLLECTION = { person: 'people', item: 'items', sub: 'subs' };

// 从 URL hash 读取当前页（如 #/people），便于直达与刷新保持
function tabFromHash() {
  const key = window.location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.key === key) ? key : 'overview';
}

export default function App() {
  const [authState, setAuthState] = useState('checking'); // checking | gate | ready
  const [gateMode, setGateMode] = useState('login');       // login | setup
  const [needsSetupKey, setNeedsSetupKey] = useState(false);
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState(tabFromHash);
  const [overview, setOverview] = useState(null);
  const [people, setPeople] = useState(null);
  const [items, setItems] = useState(null);
  const [subs, setSubs] = useState(null);
  const [detail, setDetail] = useState(null); // {type, data}
  const [form, setForm] = useState(null); // {type, initial}
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false); // 首页新增类型选择菜单

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 检查认证状态：没设密码→设置页；没登录→登录页；否则进入应用
  const checkAuth = useCallback(async () => {
    try {
      const s = await api.auth.status();
      if (!s.hasPassword) {
        setGateMode('setup');
        setNeedsSetupKey(!!s.needsSetupKey);
        setAuthState('gate');
      } else if (!s.loggedIn) {
        setGateMode('login');
        setAuthState('gate');
      } else {
        setAuthState('ready');
      }
    } catch (_) {
      // 网络异常时先按未登录处理，让页面显示登录入口而非白屏
      setGateMode('login');
      setAuthState('gate');
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // 任何接口返回 401（会话过期）就切回登录页
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA' });
      }
      setGateMode('login');
      setAuthState('gate');
      setSettingsOpen(false);
      setDetail(null);
      setForm(null);
      setOverview(null); setPeople(null); setItems(null); setSubs(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const onAuthSuccess = () => {
    setAuthState('ready');
    // 认证通过后再加载数据
    load(true);
  };

  // 切换页面时同步 URL hash
  const go = (key) => {
    setTab(key);
    window.location.hash = `/${key}`;
  };

  // 支持浏览器前进/后退
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = useCallback(async (refresh = false) => {
    try {
      const [cfg, ov, p, i, s] = await Promise.all([
        api.config(refresh), api.overview(refresh), api.people.list(refresh),
        api.items.list(refresh), api.subs.list(refresh),
      ]);
      setConfig(cfg);
      setOverview(ov);
      setPeople(p);
      setItems(i);
      setSubs(s);
      document.title = `${cfg.appName} - 家庭时间事件管理器`;
    } catch (e) {
      notify(`加载失败：${e.message}`);
    }
  }, []);

  // 已登录时加载数据（认证通过的场景由 onAuthSuccess 主动触发）
  useEffect(() => { if (authState === 'ready') load(); }, [authState, load]);

  const openForm = (type, initial = null) => { setDetail(null); setAddMenu(false); setForm({ type, initial }); };
  const closeAll = () => { setForm(null); setDetail(null); setAddMenu(false); };

  // 首页新增：弹类型选择菜单；分类页直接打开对应表单
  const handleAdd = () => {
    if (tab === 'overview') { setAddMenu((v) => !v); return; }
    openForm(tab === 'people' ? 'person' : tab === 'items' ? 'item' : 'sub');
  };

  const saveForm = async (data) => {
    try {
      const map = { person: api.people, item: api.items, sub: api.subs };
      const coll = map[form.type];
      if (form.initial) await coll.update(form.initial.id, data);
      else await coll.create(data);
      closeAll();
      await load(true);
      notify('已保存');
    } catch (e) { notify(`保存失败：${e.message}`); }
  };

  const removeRec = async (type, data) => {
    if (!window.confirm(`确定删除「${data.name}」吗？`)) return;
    try {
      await api[COLLECTION[type]].remove(data.id);
      closeAll();
      await load(true);
      notify('已删除');
    } catch (e) { notify(`删除失败：${e.message}`); }
  };

  const renew = async (data) => {
    try {
      const updated = await api.subs.renew(data.id);
      closeAll();
      await load(true);
      notify(`已续费，新到期日 ${updated.expiry_date}`);
    } catch (e) { notify(`操作失败：${e.message}`); }
  };

  const pageProps = { onOpen: (type, data) => setDetail({ type, data }) };

  // 认证检查中 / 需要登录或设置密码
  if (authState === 'checking') {
    return <div className="auth-loading">加载中…</div>;
  }
  if (authState === 'gate') {
    return <AuthGate mode={gateMode} needsSetupKey={needsSetupKey}
      appName={config?.appName} onSuccess={onAuthSuccess} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="clock" size={22} /></span><span className="brand-name">{config?.appName || '时间管理局'}</span></div>
        <nav>
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item ${tab === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
              <span className="nav-icon"><Icon name={n.icon} size={19} /></span><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="sidebar-setting" onClick={() => setSettingsOpen(true)}>
            <span className="nav-icon"><Icon name="gear" size={18} /></span><span>数据与备份</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">{config?.appName || '时间管理局'}</div>
          <div className="topbar-actions">
            <button className="icon-btn top-setting" onClick={() => setSettingsOpen(true)} title="数据与备份" aria-label="数据与备份"><Icon name="gear" size={20} /></button>
            <div className="add-wrap">
              <button className="btn primary add-btn" onClick={handleAdd}><Icon name="plus" size={17} /> 新增</button>
              {addMenu && tab === 'overview' && (
                <div className="add-menu">
                  <button onClick={() => openForm('person')}><span><Icon name="heart" size={17} /></span>亲人</button>
                  <button onClick={() => openForm('item')}><span><Icon name="box" size={17} /></span>物品</button>
                  <button onClick={() => openForm('sub')}><span><Icon name="card" size={17} /></span>会员</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          {tab === 'overview' && <OverviewPage data={overview} config={config} {...pageProps} />}
          {tab === 'people' && <PeoplePage rows={people} {...pageProps} />}
          {tab === 'items' && <ItemsPage rows={items} {...pageProps} />}
          {tab === 'subs' && <SubsPage rows={subs} {...pageProps} />}
        </div>
      </main>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button key={n.key} className={`tab ${tab === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
            <span className="tab-icon"><Icon name={n.icon} size={22} /></span><span>{n.label}</span>
          </button>
        ))}
      </nav>
      {addMenu && tab === 'overview' && (
        <div className="fab-menu">
          <button onClick={() => openForm('person')}><span><Icon name="heart" size={17} /></span>亲人</button>
          <button onClick={() => openForm('item')}><span><Icon name="box" size={17} /></span>物品</button>
          <button onClick={() => openForm('sub')}><span><Icon name="card" size={17} /></span>会员</button>
        </div>
      )}
      <button className={`fab ${addMenu ? 'fab-open' : ''}`} onClick={handleAdd}><Icon name="plus" size={26} strokeWidth={2.2} /></button>
      {addMenu && <div className="menu-backdrop" onClick={() => setAddMenu(false)} />}

      {detail && (
        <DetailDrawer type={detail.type} data={detail.data}
          onClose={() => setDetail(null)}
          onEdit={(type, data) => openForm(type, data)}
          onDelete={removeRec} onRenew={renew} />
      )}
      {form && (
        <>
          {form.type === 'person' && <PersonForm initial={form.initial} config={config} onSave={saveForm} onClose={closeAll} />}
          {form.type === 'item' && <ItemForm initial={form.initial} config={config} onSave={saveForm} onClose={closeAll} />}
          {form.type === 'sub' && <SubForm initial={form.initial} config={config} onSave={saveForm} onClose={closeAll} />}
        </>
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} onImported={() => load(true)} notify={notify}
          onLogout={async () => {
            try { await api.auth.logout(); } catch (_) {}
            // 清空 Service Worker 里的数据缓存，杜绝登出后从缓存看到旧数据
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA' });
            }
            setSettingsOpen(false);
            setGateMode('login');
            setAuthState('gate');
            setOverview(null); setPeople(null); setItems(null); setSubs(null);
          }} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
