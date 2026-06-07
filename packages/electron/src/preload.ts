import { contextBridge, ipcRenderer } from 'electron';

export interface FileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  timestamp: number;
  parents: string[];
}

export interface DiffEntry {
  path: string;
  old_hash: string | null;
  new_hash: string | null;
  status: string;
  old_content: string | null;
  new_content: string | null;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  commit_id: string;
}

export interface FileEntry {
  name: string;
  isDir: boolean;
  path: string;
}

const api = {
  openRepo: (): Promise<{ path: string; initialized: boolean } | { error: string } | null> =>
    ipcRenderer.invoke('open-repo'),
  initRepo: (): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('init-repo'),
  getRepoPath: (): Promise<string | null> =>
    ipcRenderer.invoke('get-repo-path'),
  isInitialized: (): Promise<boolean> =>
    ipcRenderer.invoke('is-initialized'),
  addFile: (filePath: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('add-file', filePath.replace(/\\/g, '/')),
  removeFile: (filePath: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('remove-file', filePath.replace(/\\/g, '/')),
  getStagedFiles: (): Promise<string[] | { error: string }> =>
    ipcRenderer.invoke('get-staged-files'),
  getStatus: (): Promise<FileStatus[] | { error: string }> =>
    ipcRenderer.invoke('get-status'),
  commit: (message: string, author: string): Promise<{ commitId: string } | { error: string }> =>
    ipcRenderer.invoke('commit', message, author),
  getCommit: (commitId: string): Promise<CommitInfo | { error: string }> =>
    ipcRenderer.invoke('get-commit', commitId),
  getCommitHistory: (branch?: string): Promise<CommitInfo[] | { error: string }> =>
    ipcRenderer.invoke('get-commit-history', branch),
  createBranch: (name: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('create-branch', name),
  switchBranch: (name: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('switch-branch', name),
  getBranches: (): Promise<BranchInfo[] | { error: string }> =>
    ipcRenderer.invoke('get-branches'),
  getCurrentBranch: (): Promise<string | { error: string }> =>
    ipcRenderer.invoke('get-current-branch'),
  getDiff: (oldCommit: string, newCommit: string): Promise<DiffEntry[] | { error: string }> =>
    ipcRenderer.invoke('get-diff', oldCommit, newCommit),
  getWorkingDiff: (): Promise<DiffEntry[] | { error: string }> =>
    ipcRenderer.invoke('get-working-diff'),
  checkout: (commitId: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('checkout', commitId),
  getFileTree: (commitId?: string): Promise<any | { error: string }> =>
    ipcRenderer.invoke('get-file-tree', commitId),
  readFile: (filePath: string): Promise<{ content: string } | { error: string }> =>
    ipcRenderer.invoke('read-file', filePath.replace(/\\/g, '/')),
  writeFile: (filePath: string, content: string): Promise<{ success: boolean } | { error: string }> =>
    ipcRenderer.invoke('write-file', filePath.replace(/\\/g, '/'), content),
  listDirectory: (dirPath: string): Promise<FileEntry[] | { error: string }> =>
    ipcRenderer.invoke('list-directory', dirPath.replace(/\\/g, '/')),
  getFileSize: (filePath: string): Promise<{ size: number; isLarge: boolean } | { error: string }> =>
    ipcRenderer.invoke('get-file-size', filePath.replace(/\\/g, '/')),
  readFileLarge: (filePath: string): Promise<{ buffer: SharedArrayBuffer; size: number; path: string } | { error: string }> =>
    ipcRenderer.invoke('read-file-large', filePath.replace(/\\/g, '/')),
  writeFileLarge: (filePath: string, buffer: SharedArrayBuffer, size: number): Promise<{ success: boolean; size: number } | { error: string }> =>
    ipcRenderer.invoke('write-file-large', filePath.replace(/\\/g, '/'), buffer, size),
  readBlobLarge: (hash: string): Promise<{ buffer: SharedArrayBuffer; size: number; hash: string } | { error: string }> =>
    ipcRenderer.invoke('read-blob-large', hash),
};

contextBridge.exposeInMainWorld('vfsApi', api);

export type VfsApi = typeof api;
