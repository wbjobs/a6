import React, { useState, useEffect, useCallback } from 'react';
import './types';
import FileTreeView from './components/FileTreeView';
import DiffView from './components/DiffView';
import CommitGraph from './components/CommitGraph';
import StatusPanel from './components/StatusPanel';
import BranchSelector from './components/BranchSelector';
import { FileStatus, CommitInfo, BranchInfo, DiffEntry, TreeNode } from './types';

type ViewMode = 'files' | 'diff' | 'graph' | 'status';

export default function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [status, setStatus] = useState<FileStatus[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [fileTree, setFileTree] = useState<TreeNode | null>(null);
  const [workingDiff, setWorkingDiff] = useState<DiffEntry[]>([]);
  const [selectedCommits, setSelectedCommits] = useState<[string, string] | null>(null);
  const [commitDiff, setCommitDiff] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [author, setAuthor] = useState('User <user@example.com>');
  const [newBranchName, setNewBranchName] = useState('');

  const refreshData = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const [statusRes, commitsRes, branchesRes, currentBranchRes, treeRes, diffRes] = await Promise.all([
        window.vfsApi.getStatus(),
        window.vfsApi.getCommitHistory(),
        window.vfsApi.getBranches(),
        window.vfsApi.getCurrentBranch(),
        window.vfsApi.getFileTree(),
        window.vfsApi.getWorkingDiff(),
      ]);

      if ('error' in statusRes) throw new Error(statusRes.error);
      if ('error' in commitsRes) throw new Error(commitsRes.error);
      if ('error' in branchesRes) throw new Error(branchesRes.error);
      if ('error' in treeRes) throw new Error(treeRes.error);
      if ('error' in diffRes) throw new Error(diffRes.error);

      setStatus(statusRes);
      setCommits(commitsRes);
      setBranches(branchesRes);
      setFileTree(treeRes);
      setWorkingDiff(diffRes);
      if (typeof currentBranchRes === 'string') {
        setCurrentBranch(currentBranchRes);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleOpenRepo = async () => {
    const result = await window.vfsApi.openRepo();
    if (result && 'path' in result) {
      setRepoPath(result.path);
      setInitialized(result.initialized);
    }
  };

  const handleInitRepo = async () => {
    const result = await window.vfsApi.initRepo();
    if ('success' in result) {
      setInitialized(true);
      refreshData();
    } else if ('error' in result) {
      setError(result.error);
    }
  };

  const handleAddFile = async (filePath: string) => {
    const result = await window.vfsApi.addFile(filePath);
    if ('error' in result) {
      setError(result.error);
    } else {
      refreshData();
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }
    const result = await window.vfsApi.commit(commitMessage.trim(), author);
    if ('error' in result) {
      setError(result.error);
    } else {
      setCommitMessage('');
      refreshData();
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setError('Branch name is required');
      return;
    }
    const result = await window.vfsApi.createBranch(newBranchName.trim());
    if ('error' in result) {
      setError(result.error);
    } else {
      setNewBranchName('');
      refreshData();
    }
  };

  const handleSwitchBranch = async (name: string) => {
    const result = await window.vfsApi.switchBranch(name);
    if ('error' in result) {
      setError(result.error);
    } else {
      refreshData();
    }
  };

  const handleShowDiff = async (oldCommit: string, newCommit: string) => {
    const result = await window.vfsApi.getDiff(oldCommit, newCommit);
    if ('error' in result) {
      setError(result.error);
    } else {
      setSelectedCommits([oldCommit, newCommit]);
      setCommitDiff(result);
      setViewMode('diff');
    }
  };

  if (!repoPath) {
    return (
      <div className="welcome-screen">
        <h1>VFS Desktop</h1>
        <p>Version Control System with Content-Addressable Storage</p>
        <button onClick={handleOpenRepo} className="btn btn-primary">
          Open Repository
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="welcome-screen">
        <h1>Initialize Repository</h1>
        <p>Path: {repoPath}</p>
        <p>This directory is not initialized as a VFS repository.</p>
        <button onClick={handleInitRepo} className="btn btn-primary">
          Initialize Repository
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>VFS Desktop</h1>
          <span className="repo-path">{repoPath}</span>
        </div>
        <div className="header-right">
          <BranchSelector
            branches={branches}
            currentBranch={currentBranch}
            onSwitch={handleSwitchBranch}
          />
          <button onClick={refreshData} className="btn" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${viewMode === 'files' ? 'active' : ''}`}
          onClick={() => setViewMode('files')}
        >
          File Tree
        </button>
        <button
          className={`tab ${viewMode === 'status' ? 'active' : ''}`}
          onClick={() => setViewMode('status')}
        >
          Changes
        </button>
        <button
          className={`tab ${viewMode === 'diff' ? 'active' : ''}`}
          onClick={() => setViewMode('diff')}
        >
          Diff
        </button>
        <button
          className={`tab ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => setViewMode('graph')}
        >
          Commit Graph
        </button>
      </nav>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)} className="close-btn">
            ×
          </button>
        </div>
      )}

      <main className="app-main">
        {viewMode === 'files' && fileTree && (
          <FileTreeView
            tree={fileTree}
            onAddFile={handleAddFile}
            status={status}
          />
        )}
        {viewMode === 'status' && (
          <StatusPanel
            status={status}
            workingDiff={workingDiff}
            onAddFile={handleAddFile}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            author={author}
            setAuthor={setAuthor}
            onCommit={handleCommit}
            newBranchName={newBranchName}
            setNewBranchName={setNewBranchName}
            onCreateBranch={handleCreateBranch}
          />
        )}
        {viewMode === 'diff' && (
          <DiffView
            entries={selectedCommits ? commitDiff : workingDiff}
            title={selectedCommits ? `Diff: ${selectedCommits[0].slice(0, 7)} → ${selectedCommits[1].slice(0, 7)}` : 'Working Changes'}
          />
        )}
        {viewMode === 'graph' && (
          <CommitGraph
            commits={commits}
            branches={branches}
            onSelectDiff={handleShowDiff}
          />
        )}
      </main>
    </div>
  );
}
