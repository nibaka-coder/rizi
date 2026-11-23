// 统一的 API 请求封装
async function request(path, opts = {}) {
  const { refresh, ...rest } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (refresh) headers['X-Rizi-Refresh'] = '1';
  const res = await fetch(path, {
    headers,
    ...rest,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
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
