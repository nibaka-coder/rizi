import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { Modal, Field } from './components';

function fmtSize(n) {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SettingsModal({ onClose, onImported, notify }) {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('merge');
  const [payload, setPayload] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const loadStatus = async () => {
    try { setStatus(await api.backup.status()); } catch (e) { notify(`读取备份状态失败：${e.message}`); }
  };
  useEffect(() => { loadStatus(); }, []);

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.format !== 'rizi-backup') throw new Error('不是「日子」的备份文件');
      setPayload(data);
      notify(`已选择备份：${f.name}（${Object.values(data.counts || {}).reduce((a, b) => a + b, 0)} 条记录）`);
    } catch (err) {
      setPayload(null);
      notify(`文件读取失败：${err.message}`);
    }
    e.target.value = '';
  };

  const doImport = async () => {
    if (!payload) { notify('请先选择一个备份文件'); return; }
    if (mode === 'replace' && !window.confirm('「覆盖导入」会清空当前所有数据，确定继续吗？')) return;
    setBusy(true);
    try {
      const r = await api.backup.import(payload, mode);
      notify(`导入完成：新增 ${r.total} 条${Object.keys(r.skipped).some((k) => r.skipped[k]) ? '，跳过重复项' : ''}`);
      await loadStatus();
      if (onImported) await onImported();
      onClose();
    } catch (e) { notify(`导入失败：${e.message}`); }
    finally { setBusy(false); }
  };

  const doBackupNow = async () => {
    setBusy(true);
    try {
      const r = await api.backup.now();
      notify(`已生成快照：${r.file}（${fmtSize(r.size)}）`);
      await loadStatus();
    } catch (e) { notify(`备份失败：${e.message}`); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="数据与备份" onClose={onClose} wide>
      <div className="settings">
        <section className="setting-sec">
          <h4>导出备份</h4>
          <p className="setting-hint">
            把所有亲人、物品、会员数据打包成一个 JSON 文件下载。建议定期下载一份存到网盘或另一台设备，
            换服务器时用它恢复。
          </p>
          <a className="btn primary" href={api.backup.exportUrl} download>⬇ 下载备份文件</a>
        </section>

        <section className="setting-sec">
          <h4>导入恢复</h4>
          <p className="setting-hint">选择之前导出的 JSON 备份文件恢复数据。</p>
          <Field label="备份文件">
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPickFile} />
          </Field>
          {fileName && <p className="setting-file">已选择：{fileName} {payload ? '✓ 校验通过' : '✗ 格式错误'}</p>}
          <Field label="导入方式">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="merge">合并（保留现有数据，只补进新记录）</option>
              <option value="replace">覆盖（清空现有数据后完整恢复）</option>
            </select>
          </Field>
          <button className="btn primary" disabled={busy || !payload} onClick={doImport}>
            {busy ? '处理中…' : '开始导入'}
          </button>
        </section>

        <section className="setting-sec">
          <h4>自动快照</h4>
          <p className="setting-hint">
            服务每天自动把数据库快照到服务器的 <code>{status?.dir || '...'}</code> 目录，
            保留最近 {status?.keep ?? 7} 份。这是防误删、防服务器故障的最后一道保险。
          </p>
          <button className="btn ghost" disabled={busy} onClick={doBackupNow}>📸 立即生成快照</button>
          <div className="backup-list">
            {(status?.backups || []).length === 0 && <p className="setting-hint">还没有快照文件。</p>}
            {status?.backups?.map((b) => (
              <div key={b.file} className="backup-row">
                <span>📦 {b.file}</span>
                <span className="muted">{fmtSize(b.size)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
