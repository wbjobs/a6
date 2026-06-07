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

export class VfsRepo {
  constructor(rootPath: string);
  init(): void;
  isInitialized(): boolean;
  hashObject(content: string): string;
  writeBlob(content: string): string;
  readBlob(hash: string): string;
  addFile(filePath: string): void;
  removeFile(filePath: string): void;
  getStagedFiles(): string[];
  getStatus(): FileStatus[];
  commit(message: string, author: string): string;
  getCommit(commitId: string): CommitInfo;
  getCommitHistory(branch?: string | null): CommitInfo[];
  createBranch(name: string): void;
  switchBranch(name: string): void;
  getBranches(): BranchInfo[];
  getCurrentBranch(): string;
  getDiff(oldCommit: string, newCommit: string): DiffEntry[];
  getWorkingDiff(): DiffEntry[];
  checkout(commitId: string): void;
  getFileTree(commitId?: string | null): any;
}

export function loadVfsModule(): { VfsRepo: typeof VfsRepo };
