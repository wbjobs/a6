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
  is_signed: boolean;
  public_key: string | null;
  signature: string | null;
}

export interface KeyPair {
  public_key: string;
  private_key: string;
}

export interface SignatureVerification {
  commit_id: string;
  is_signed: boolean;
  verified: boolean;
  public_key: string | null;
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

export interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  hash: string;
  children: TreeNode[] | null;
}

declare global {
  interface Window {
    vfsApi: {
      openRepo: () => Promise<{ path: string; initialized: boolean } | { error: string } | null>;
      initRepo: () => Promise<{ success: boolean } | { error: string }>;
      getRepoPath: () => Promise<string | null>;
      isInitialized: () => Promise<boolean>;
      addFile: (filePath: string) => Promise<{ success: boolean } | { error: string }>;
      removeFile: (filePath: string) => Promise<{ success: boolean } | { error: string }>;
      getStagedFiles: () => Promise<string[] | { error: string }>;
      getStatus: () => Promise<FileStatus[] | { error: string }>;
      commit: (message: string, author: string) => Promise<{ commitId: string } | { error: string }>;
      getCommit: (commitId: string) => Promise<CommitInfo | { error: string }>;
      getCommitHistory: (branch?: string) => Promise<CommitInfo[] | { error: string }>;
      createBranch: (name: string) => Promise<{ success: boolean } | { error: string }>;
      switchBranch: (name: string) => Promise<{ success: boolean } | { error: string }>;
      getBranches: () => Promise<BranchInfo[] | { error: string }>;
      getCurrentBranch: () => Promise<string | { error: string }>;
      getDiff: (oldCommit: string, newCommit: string) => Promise<DiffEntry[] | { error: string }>;
      getWorkingDiff: () => Promise<DiffEntry[] | { error: string }>;
      checkout: (commitId: string) => Promise<{ success: boolean } | { error: string }>;
      getFileTree: (commitId?: string) => Promise<TreeNode | { error: string }>;
      readFile: (filePath: string) => Promise<{ content: string } | { error: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean } | { error: string }>;
      listDirectory: (dirPath: string) => Promise<FileEntry[] | { error: string }>;
      getFileSize: (filePath: string) => Promise<{ size: number; isLarge: boolean } | { error: string }>;
      readFileLarge: (filePath: string) => Promise<{ buffer: SharedArrayBuffer; size: number; path: string } | { error: string }>;
      writeFileLarge: (filePath: string, buffer: SharedArrayBuffer, size: number) => Promise<{ success: boolean; size: number } | { error: string }>;
      readBlobLarge: (hash: string) => Promise<{ buffer: SharedArrayBuffer; size: number; hash: string } | { error: string }>;
      enableAutoStaging: () => Promise<{ enabled: boolean }>;
      disableAutoStaging: () => Promise<{ enabled: boolean }>;
      isAutoStagingEnabled: () => Promise<{ enabled: boolean }>;
      commitSigned: (message: string, author: string, keyName: string) => Promise<{ commitId: string } | { error: string }>;
      generateKeypair: (name: string) => Promise<KeyPair | { error: string }>;
      listKeys: () => Promise<string[] | { error: string }>;
      verifyCommit: (commitId: string) => Promise<SignatureVerification | { error: string }>;
      getCommitAtTime: (timestamp: number) => Promise<CommitInfo | null | { error: string }>;
      getFileTreeAtCommit: (commitId: string) => Promise<TreeNode | { error: string }>;
      onStagingUpdated: (callback: () => void) => () => void;
    };
  }
}

export {};
