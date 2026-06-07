import React from 'react';
import { FileStatus, DiffEntry } from '../types';

interface StatusPanelProps {
  status: FileStatus[];
  workingDiff: DiffEntry[];
  onAddFile: (filePath: string) => void;
  commitMessage: string;
  setCommitMessage: (msg: string) => void;
  author: string;
  setAuthor: (author: string) => void;
  onCommit: () => void;
  onSignedCommit: () => void;
  useSignedCommit: boolean;
  setUseSignedCommit: (value: boolean) => void;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  keys: string[];
  newKeyName: string;
  setNewKeyName: (name: string) => void;
  onGenerateKey: () => void;
  newBranchName: string;
  setNewBranchName: (name: string) => void;
  onCreateBranch: () => void;
  disabled?: boolean;
}

export default function StatusPanel({
  status,
  workingDiff,
  onAddFile,
  commitMessage,
  setCommitMessage,
  author,
  setAuthor,
  onCommit,
  onSignedCommit,
  useSignedCommit,
  setUseSignedCommit,
  selectedKey,
  setSelectedKey,
  keys,
  newKeyName,
  setNewKeyName,
  onGenerateKey,
  newBranchName,
  setNewBranchName,
  onCreateBranch,
  disabled,
}: StatusPanelProps) {
  const stagedFiles = status.filter((s) => s.staged);
  const unstagedFiles = status.filter((s) => !s.staged && s.status !== 'untracked');
  const untrackedFiles = status.filter((s) => s.status === 'untracked');

  const handleStageAll = () => {
    if (!disabled) {
      [...unstagedFiles, ...untrackedFiles].forEach((s) => onAddFile(s.path));
    }
  };

  return (
    <div className="status-panel">
      <div className="status-section">
        <h2>Staged Changes ({stagedFiles.length})</h2>
        <div className="status-list">
          {stagedFiles.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#6c7086' }}>
              No files staged
            </div>
          ) : (
            stagedFiles.map((s, idx) => (
              <div key={`${s.path}-${idx}`} className="status-item">
                <span className={`tree-status status-${s.status}`}>
                  {s.status}
                </span>
                <span className="path">{s.path}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="status-section">
        <h2>Unstaged Changes ({unstagedFiles.length + untrackedFiles.length})</h2>
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={handleStageAll}>
            Stage All
          </button>
        </div>
        <div className="status-list">
          {unstagedFiles.length === 0 && untrackedFiles.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#6c7086' }}>
              No uncommitted changes
            </div>
          ) : (
            [...unstagedFiles, ...untrackedFiles].map((s, idx) => (
              <div key={`${s.path}-${idx}`} className="status-item">
                <span className={`tree-status status-${s.status}`}>
                  {s.status}
                </span>
                <span className="path">{s.path}</span>
                <button
                  className="btn btn-success"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => onAddFile(s.path)}
                  disabled={disabled}
                >
                  + Stage
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="commit-section">
        <h2>Commit</h2>
        <div className="form-group">
          <label>Commit Message</label>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Describe your changes..."
            disabled={disabled}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Name <email@example.com>"
              disabled={disabled}
            />
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={onCommit}
              disabled={stagedFiles.length === 0 || !commitMessage.trim() || disabled}
            >
              Commit
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #313244' }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#89b4fa' }}>
            数字签名
          </h3>
          <div className="form-row" style={{ alignItems: 'center', marginBottom: 12 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useSignedCommit}
                onChange={(e) => setUseSignedCommit(e.target.checked)}
                disabled={disabled || keys.length === 0}
              />
              使用数字签名提交
            </label>
          </div>
          {useSignedCommit && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>签名密钥</label>
                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    disabled={disabled}
                  >
                    {keys.length === 0 && (
                      <option value="">请先生成密钥</option>
                    )}
                    {keys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={onSignedCommit}
                    disabled={stagedFiles.length === 0 || !commitMessage.trim() || !selectedKey || disabled}
                  >
                    签名并提交
                  </button>
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 13, marginBottom: 8, color: '#a6e3a1' }}>
              生成新密钥
            </h4>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="密钥名称 (如: my-key)"
                  disabled={disabled}
                />
              </div>
              <button
                className="btn btn-success"
                onClick={onGenerateKey}
                disabled={!newKeyName.trim() || disabled}
                style={{ whiteSpace: 'nowrap', marginLeft: 12 }}
              >
                生成 Ed25519 密钥
              </button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #313244' }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#89b4fa' }}>
            Create Branch
          </h3>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Branch name..."
                disabled={disabled}
              />
            </div>
            <button
              className="btn"
              onClick={onCreateBranch}
              disabled={!newBranchName.trim() || disabled}
              style={{ whiteSpace: 'nowrap', marginLeft: 12 }}
            >
              Create Branch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
