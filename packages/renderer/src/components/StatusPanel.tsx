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
  newBranchName: string;
  setNewBranchName: (name: string) => void;
  onCreateBranch: () => void;
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
  newBranchName,
  setNewBranchName,
  onCreateBranch,
}: StatusPanelProps) {
  const stagedFiles = status.filter((s) => s.staged);
  const unstagedFiles = status.filter((s) => !s.staged && s.status !== 'untracked');
  const untrackedFiles = status.filter((s) => s.status === 'untracked');

  const handleStageAll = () => {
    [...unstagedFiles, ...untrackedFiles].forEach((s) => onAddFile(s.path));
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
            />
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={onCommit}
              disabled={stagedFiles.length === 0 || !commitMessage.trim()}
            >
              Commit
            </button>
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
              />
            </div>
            <button
              className="btn"
              onClick={onCreateBranch}
              disabled={!newBranchName.trim()}
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
