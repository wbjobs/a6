import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadVfsModule, VfsRepo, FileStatus, CommitInfo, DiffEntry, BranchInfo } from '@vfs/core';

let mainWindow: BrowserWindow | null = null;
let repo: VfsRepo | null = null;
let currentRepoPath: string | null = null;

const { VfsRepo: VfsRepoClass } = loadVfsModule();

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });

  const rendererPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
  if (fs.existsSync(rendererPath)) {
    mainWindow.loadFile(rendererPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('open-repo', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Repository Folder',
  });
  if (result.canceled) return null;
  const repoPath = result.filePaths[0];
  try {
    repo = new VfsRepoClass(repoPath);
    currentRepoPath = repoPath;
    return { path: repoPath, initialized: repo.isInitialized() };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('init-repo', async () => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.init();
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-repo-path', () => {
  return currentRepoPath;
});

ipcMain.handle('is-initialized', () => {
  return repo?.isInitialized() || false;
});

ipcMain.handle('add-file', async (_event, filePath: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.addFile(filePath);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('remove-file', async (_event, filePath: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.removeFile(filePath);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-staged-files', () => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getStagedFiles();
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-status', (): FileStatus[] | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getStatus();
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('commit', async (_event, message: string, author: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    const commitId = repo.commit(message, author);
    return { commitId };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-commit', (_event, commitId: string): CommitInfo | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getCommit(commitId);
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-commit-history', (_event, branch?: string): CommitInfo[] | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getCommitHistory(branch || null);
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('create-branch', async (_event, name: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.createBranch(name);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('switch-branch', async (_event, name: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.switchBranch(name);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-branches', (): BranchInfo[] | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getBranches();
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-current-branch', (): string | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getCurrentBranch();
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-diff', (_event, oldCommit: string, newCommit: string): DiffEntry[] | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getDiff(oldCommit, newCommit);
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-working-diff', (): DiffEntry[] | { error: string } => {
  if (!repo) return { error: 'No repository opened' };
  try {
    return repo.getWorkingDiff();
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('checkout', async (_event, commitId: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    repo.checkout(commitId);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-file-tree', (_event, commitId?: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    const jsonStr = repo.getFileTree(commitId || null);
    return JSON.parse(jsonStr);
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('read-file', async (_event, filePath: string) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const fullPath = path.join(currentRepoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { content };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const fullPath = path.join(currentRepoPath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('list-directory', async (_event, dirPath: string) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const fullPath = dirPath ? path.join(currentRepoPath, dirPath) : currentRepoPath;
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    return entries
      .filter((e) => e.name !== '.vfs')
      .map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: dirPath ? path.join(dirPath, e.name).replace(/\\/g, '/') : e.name,
      }));
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('get-file-size', async (_event, filePath: string) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fullPath = path.join(currentRepoPath, normalizedPath);
    const stats = fs.statSync(fullPath);
    return { size: stats.size, isLarge: stats.size > LARGE_FILE_THRESHOLD };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('read-file-large', async (event, filePath: string) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fullPath = path.join(currentRepoPath, normalizedPath);
    const buffer = fs.readFileSync(fullPath);
    const sharedBuffer = new SharedArrayBuffer(buffer.length);
    const view = new Uint8Array(sharedBuffer);
    view.set(buffer);
    return {
      buffer: sharedBuffer,
      size: buffer.length,
      path: normalizedPath,
    };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('write-file-large', async (event, filePath: string, buffer: SharedArrayBuffer, size: number) => {
  if (!currentRepoPath) return { error: 'No repository opened' };
  try {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fullPath = path.join(currentRepoPath, normalizedPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const view = new Uint8Array(buffer, 0, size);
    fs.writeFileSync(fullPath, view);
    return { success: true, size };
  } catch (e: any) {
    return { error: e.message };
  }
});

ipcMain.handle('read-blob-large', async (event, hash: string) => {
  if (!repo) return { error: 'No repository opened' };
  try {
    const content = repo.readBlob(hash);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(content);
    const sharedBuffer = new SharedArrayBuffer(buffer.length);
    const view = new Uint8Array(sharedBuffer);
    view.set(buffer);
    return {
      buffer: sharedBuffer,
      size: buffer.length,
      hash,
    };
  } catch (e: any) {
    return { error: e.message };
  }
});
