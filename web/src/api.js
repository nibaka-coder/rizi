// 统一的 API 请求封装
async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
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
  config: () => request('/api/config'),
  overview: () => request('/api/overview'),
  people: {
    list: () => request('/api/people/view'),
    create: (data) => request('/api/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),
  },
  items: {
    list: () => request('/api/items/view'),
    create: (data) => request('/api/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/items/${id}`, { method: 'DELETE' }),
  },
  subs: {
    list: () => request('/api/subscriptions/view'),
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
