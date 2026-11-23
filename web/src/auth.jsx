import React, { useState } from 'react';
import { api } from './api';

// 全屏认证页：mode = 'setup'（首次设置密码）| 'login'（登录）
export function AuthGate({ mode, needsSetupKey, appName, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSetup = mode === 'setup';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSetup && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      if (isSetup) await api.auth.setup(password, needsSetupKey ? setupKey : undefined);
      else await api.auth.login(password);
      onSuccess();
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-gate">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand"><span className="brand-mark">日</span></div>
        <h1>{appName || '日子'}</h1>
        <p className="auth-title">{isSetup ? '设置访问密码' : '欢迎回来'}</p>
        <p className="auth-desc">
          {isSetup
            ? '首次使用，请设置一个密码保护你的数据。请牢记，忘记密码需清空数据重置。'
            : '请输入密码以查看你的数据。'}
        </p>

        <label className="field">
          <span className="field-label">{isSetup ? '设置密码（至少 6 位）' : '密码'}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码" autoComplete={isSetup ? 'new-password' : 'current-password'} required />
        </label>

        {isSetup && (
          <label className="field">
            <span className="field-label">再次输入密码</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="请再次输入" autoComplete="new-password" required />
          </label>
        )}

        {isSetup && needsSetupKey && (
          <label className="field">
            <span className="field-label">初始化密钥</span>
            <input type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)}
              placeholder="服务器配置的初始化密钥" required />
          </label>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button className="btn primary auth-submit" type="submit" disabled={busy}>
          {busy ? '处理中…' : (isSetup ? '设置密码并进入' : '登录')}
        </button>
      </form>
    </div>
  );
}

// 修改密码表单（放在设置弹窗里）
export function ChangePasswordForm({ notify }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) { notify('两次输入的新密码不一致'); return; }
    if (newPassword.length < 6) { notify('新密码至少 6 位'); return; }
    setBusy(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      notify('密码已修改');
      setOldPassword(''); setNewPassword(''); setConfirm('');
    } catch (err) {
      notify(`修改失败：${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="change-pw-form">
      <label className="field">
        <span className="field-label">当前密码</span>
        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">新密码（至少 6 位）</span>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">再次输入新密码</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? '修改中…' : '修改密码'}</button>
    </form>
  );
}
