#[macro_use]
extern crate napi_derive;

mod objects;
mod storage;
mod repo;
mod staging;
mod branch;
mod commit;
mod diff;
mod signature;

use napi::Result;
use std::path::PathBuf;

pub use objects::{Blob, Commit, Tree, TreeNode};
pub use repo::Repository;

fn normalize_path(path: &str) -> PathBuf {
    PathBuf::from(path.replace('\\', "/"))
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub is_signed: bool,
    pub public_key: Option<String>,
    pub signature: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct KeyPair {
    pub public_key: String,
    pub private_key: String,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct SignatureVerification {
    pub commit_id: String,
    pub is_signed: bool,
    pub verified: bool,
    pub public_key: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct DiffEntry {
    pub path: String,
    pub old_hash: Option<String>,
    pub new_hash: Option<String>,
    pub status: String,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub current: bool,
    pub commit_id: String,
}

#[napi]
pub struct VfsRepo {
    repo: Repository,
}

#[napi]
impl VfsRepo {
    #[napi(constructor)]
    pub fn new(root_path: String) -> Result<Self> {
        let repo = Repository::new(PathBuf::from(root_path))
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(Self { repo })
    }

    #[napi]
    pub fn init(&self) -> Result<()> {
        self.repo.init()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn is_initialized(&self) -> bool {
        self.repo.is_initialized()
    }

    #[napi]
    pub fn hash_object(&self, content: String) -> Result<String> {
        self.repo.hash_object(content.as_bytes())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn write_blob(&self, content: String) -> Result<String> {
        let blob = Blob::new(content.into_bytes());
        self.repo.write_object(&blob)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn read_blob(&self, hash: String) -> Result<String> {
        let blob: Blob = self.repo.read_object(&hash)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        String::from_utf8(blob.content)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn add_file(&self, file_path: String) -> Result<()> {
        self.repo.add_file(&normalize_path(&file_path))
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn remove_file(&self, file_path: String) -> Result<()> {
        self.repo.remove_file(&normalize_path(&file_path))
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_staged_files(&self) -> Result<Vec<String>> {
        self.repo.get_staged_files()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_status(&self) -> Result<Vec<FileStatus>> {
        self.repo.get_status()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn commit(&self, message: String, author: String) -> Result<String> {
        self.repo.commit(&message, &author)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_commit(&self, commit_id: String) -> Result<CommitInfo> {
        let commit = self.repo.get_commit(&commit_id)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        let is_signed = commit.is_signed();
        let public_key = commit.public_key.clone();
        let signature = commit.signature.clone();
        Ok(CommitInfo {
            id: commit.id,
            message: commit.message,
            author: commit.author,
            timestamp: commit.timestamp,
            parents: commit.parents,
            is_signed,
            public_key,
            signature,
        })
    }

    #[napi]
    pub fn get_commit_history(&self, branch: Option<String>) -> Result<Vec<CommitInfo>> {
        let commits = self.repo.get_commit_history(branch.as_deref())
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(commits.into_iter().map(|c| {
            let is_signed = c.is_signed();
            let public_key = c.public_key.clone();
            let signature = c.signature.clone();
            CommitInfo {
                id: c.id,
                message: c.message,
                author: c.author,
                timestamp: c.timestamp,
                parents: c.parents,
                is_signed,
                public_key,
                signature,
            }
        }).collect())
    }

    #[napi]
    pub fn commit_signed(&self, message: String, author: String, key_name: String) -> Result<String> {
        self.repo.commit_signed(&message, &author, &key_name)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn generate_keypair(&self, name: String) -> Result<KeyPair> {
        let keypair = self.repo.generate_keypair(&name)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(KeyPair {
            public_key: keypair.public_key,
            private_key: keypair.private_key,
        })
    }

    #[napi]
    pub fn list_keys(&self) -> Result<Vec<String>> {
        self.repo.list_keys()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn verify_commit(&self, commit_id: String) -> Result<SignatureVerification> {
        let commit = self.repo.get_commit(&commit_id)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        let is_signed = commit.is_signed();
        let verified = if is_signed {
            self.repo.verify_commit(&commit_id)
                .map_err(|e| napi::Error::from_reason(e.to_string()))?
        } else {
            false
        };
        Ok(SignatureVerification {
            commit_id: commit.id.clone(),
            is_signed,
            verified,
            public_key: commit.public_key.clone(),
        })
    }

    #[napi]
    pub fn get_commit_at_time(&self, timestamp: i64) -> Result<Option<CommitInfo>> {
        let commit = self.repo.get_commit_at_time(timestamp)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(commit.map(|c| {
            let is_signed = c.is_signed();
            let public_key = c.public_key.clone();
            let signature = c.signature.clone();
            CommitInfo {
                id: c.id,
                message: c.message,
                author: c.author,
                timestamp: c.timestamp,
                parents: c.parents,
                is_signed,
                public_key,
                signature,
            }
        }))
    }

    #[napi]
    pub fn get_file_tree_at_commit(&self, commit_id: String) -> Result<String> {
        let tree = self.repo.get_file_tree_at_commit(&commit_id)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        serde_json::to_string(&tree)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn create_branch(&self, name: String) -> Result<()> {
        self.repo.create_branch(&name)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn switch_branch(&self, name: String) -> Result<()> {
        self.repo.switch_branch(&name)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_branches(&self) -> Result<Vec<BranchInfo>> {
        self.repo.get_branches()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_current_branch(&self) -> Result<String> {
        self.repo.get_current_branch()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_diff(&self, old_commit: String, new_commit: String) -> Result<Vec<DiffEntry>> {
        self.repo.get_diff(&old_commit, &new_commit)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_working_diff(&self) -> Result<Vec<DiffEntry>> {
        self.repo.get_working_diff()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn checkout(&self, commit_id: String) -> Result<()> {
        self.repo.checkout(&commit_id)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_file_tree(&self, commit_id: Option<String>) -> Result<String> {
        let tree = self.repo.get_file_tree(commit_id.as_deref())
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        serde_json::to_string(&tree)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
