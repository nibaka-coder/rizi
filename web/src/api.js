// 统一的 API 请求封装
// 所有请求都带 cookie（HttpOnly 会话），同源自动发送。
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(path, opts = {}) {
  const { refresh, ...rest } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (refresh) headers['X-Rizi-Refresh'] = '1';
  const res = await fetch(path, {
    credentials: 'include',
    headers,
    ...rest,
  });
  if (res.status === 401 && path !== '/api/auth/login') {
    // 会话过期/未登录：通知 App 切回登录页
    if (onUnauthorized) onUnauthorized();
  }
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch (_) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  auth: {
    status: () => request('/api/auth/status'),
    setup: (password, setupKey) => request('/api/auth/setup', {
      method: 'POST', body: JSON.stringify({ password, setupKey }),
    }),
    login: (password) => request('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ password }),
    }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    changePassword: (oldPassword, newPassword) => request('/api/auth/change-password', {
      method: 'POST', body: JSON.stringify({ oldPassword, newPassword }),
    }),
  },
  config: (refresh) => request('/api/config', refresh ? { refresh: true } : {}),
  overview: (refresh) => request('/api/overview', refresh ? { refresh: true } : {}),
  people: {
    list: (refresh) => request('/api/people/view', refresh ? { refresh: true } : {}),
    create: (data) => request('/api/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),
  },
  items: {
    list: (refresh) => request('/api/items/view', refresh ? { refresh: true } : {}),
    create: (data) => request('/api/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/items/${id}`, { method: 'DELETE' }),
  },
  subs: {
    list: (refresh) => request('/api/subscriptions/view', refresh ? { refresh: true } : {}),
    create: (data) => request('/api/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/subscriptions/${id}`, { method: 'DELETE' }),
    renew: (id) => request(`/api/subscriptions/${id}/renew`, { method: 'POST' }),
  },
  backup: {
    status: () => request('/api/backup/status'),
    exportUrl: '/api/backup/export',
    import: (payload, mode) => request('/api/backup/import', {
      method: 'POST', body: JSON.stringify({ payload, mode }),
    }),
    now: () => request('/api/backup/now', { method: 'POST' }),
  },
};
