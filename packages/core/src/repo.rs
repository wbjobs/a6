use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use walkdir::WalkDir;

use crate::branch::BranchManager;
use crate::commit::CommitStore;
use crate::diff::DiffCalculator;
use crate::objects::{Blob, Commit, Tree, TreeNode, VfsObject};
use crate::signature::{KeyPair, SignatureManager};
use crate::staging::StagingArea;
use crate::storage::Storage;
use crate::{BranchInfo, DiffEntry, FileStatus};

pub struct Repository {
    root: PathBuf,
    vfs_dir: PathBuf,
    storage: Storage,
    staging: StagingArea,
    branch_manager: BranchManager,
    commit_store: CommitStore,
    diff_calc: DiffCalculator,
    signature_manager: SignatureManager,
}

impl Repository {
    pub fn new(root: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let vfs_dir = root.join(".vfs");
        Ok(Self {
            root: root.clone(),
            vfs_dir: vfs_dir.clone(),
            storage: Storage::new(vfs_dir.clone()),
            staging: StagingArea::new(vfs_dir.clone()),
            branch_manager: BranchManager::new(vfs_dir.clone()),
            commit_store: CommitStore::new(vfs_dir.clone()),
            diff_calc: DiffCalculator::new(vfs_dir.clone()),
            signature_manager: SignatureManager::new(vfs_dir.clone()),
        })
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(&self.vfs_dir)?;
        self.storage.init()?;
        self.staging.init()?;
        self.branch_manager.init()?;
        self.signature_manager.init()?;
        Ok(())
    }

    pub fn is_initialized(&self) -> bool {
        self.vfs_dir.exists()
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn vfs_dir(&self) -> &Path {
        &self.vfs_dir
    }

    pub fn hash_object(&self, content: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
        let blob = Blob::new(content.to_vec());
        Ok(blob.hash())
    }

    pub fn write_object<T: VfsObject>(&self, obj: &T) -> Result<String, Box<dyn std::error::Error>> {
        self.storage.write_object(obj)
    }

    pub fn read_object<T: VfsObject>(&self, hash: &str) -> Result<T, Box<dyn std::error::Error>> {
        self.storage.read_object(hash)
    }

    pub fn add_file(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let full_path = self.root.join(path);
        if !full_path.exists() {
            return Err(format!("File not found: {}", path.display()).into());
        }
        if full_path.is_dir() {
            return Err(format!("Path is a directory: {}", path.display()).into());
        }

        let content = fs::read(&full_path)?;
        let blob = Blob::new(content.clone());
        let hash = self.storage.write_object(&blob)?;

        let metadata = fs::metadata(&full_path)?;
        let size = metadata.len();
        let modified = metadata
            .modified()?
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs() as i64;

        let relative_path = path.to_string_lossy().replace('\\', "/");
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;
        staging.add(&relative_path, hash, size, modified);
        staging.save()?;

        Ok(())
    }

    pub fn remove_file(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let relative_path = path.to_string_lossy().replace('\\', "/");
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;
        staging.remove(&relative_path);
        staging.save()?;
        Ok(())
    }

    pub fn get_staged_files(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;
        Ok(staging.files())
    }

    pub fn get_status(&self) -> Result<Vec<FileStatus>, Box<dyn std::error::Error>> {
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;

        let mut working_files = HashMap::new();
        for entry in WalkDir::new(&self.root)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            if let Some(relative) = path.strip_prefix(&self.root).ok() {
                let rel_str = relative.to_string_lossy().replace('\\', "/");
                if rel_str.starts_with(".vfs/") || rel_str == ".vfs" {
                    continue;
                }
                if let Ok(content) = fs::read(path) {
                    let blob = Blob::new(content.clone());
                    let hash = blob.hash();
                    working_files.insert(rel_str.clone(), (hash, content));
                }
            }
        }

        let mut status = Vec::new();
        let head_commit = self.branch_manager.get_head_commit().ok();

        if let Some(head_commit) = &head_commit {
            let head_tree = self.commit_store.get_commit_tree(head_commit)?;
            let head_files: HashMap<String, String> = self
                .commit_store
                .get_all_files_in_tree(&head_tree, "")?
                .into_iter()
                .collect();

            for (path, head_hash) in &head_files {
                let staged_entry = staging.get(path);
                let working_entry = working_files.get(path);

                if let Some((working_hash, _)) = working_entry {
                    if let Some(staged) = staged_entry {
                        if &staged.hash != working_hash {
                            status.push(FileStatus {
                                path: path.clone(),
                                status: "modified".to_string(),
                                staged: &staged.hash != head_hash,
                            });
                        } else if &staged.hash != head_hash {
                            status.push(FileStatus {
                                path: path.clone(),
                                status: "modified".to_string(),
                                staged: true,
                            });
                        }
                    } else if working_hash != head_hash {
                        status.push(FileStatus {
                            path: path.clone(),
                            status: "modified".to_string(),
                            staged: false,
                        });
                    }
                } else if staged_entry.is_some() {
                    status.push(FileStatus {
                        path: path.clone(),
                        status: "deleted".to_string(),
                        staged: true,
                    });
                } else {
                    status.push(FileStatus {
                        path: path.clone(),
                        status: "deleted".to_string(),
                        staged: false,
                    });
                }
            }

            for (path, (_working_hash, _)) in &working_files {
                if !head_files.contains_key(path) {
                    if staging.has(path) {
                        status.push(FileStatus {
                            path: path.clone(),
                            status: "added".to_string(),
                            staged: true,
                        });
                    } else {
                        status.push(FileStatus {
                            path: path.clone(),
                            status: "untracked".to_string(),
                            staged: false,
                        });
                    }
                }
            }
        } else {
            for (path, _) in &working_files {
                if staging.has(path) {
                    status.push(FileStatus {
                        path: path.clone(),
                        status: "added".to_string(),
                        staged: true,
                    });
                } else {
                    status.push(FileStatus {
                        path: path.clone(),
                        status: "untracked".to_string(),
                        staged: false,
                    });
                }
            }
        }

        status.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(status)
    }

    pub fn commit(
        &self,
        message: &str,
        author: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;

        if staging.entries.is_empty() {
            return Err("No files staged for commit".into());
        }

        let parents = match self.branch_manager.get_head_commit() {
            Ok(head) => vec![head],
            Err(_) => Vec::new(),
        };

        let tree = if parents.is_empty() {
            self.build_tree_from_staging(&staging)?
        } else {
            self.build_tree_from_staging_with_parent(&staging, &parents[0])?
        };
        let tree_hash = self.storage.write_object(&tree)?;

        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs() as i64;

        let commit_id =
            self.commit_store
                .write_commit(tree_hash, parents, author, message, timestamp)?;

        let current_branch = self.branch_manager.get_current_branch();
        match current_branch {
            Ok(branch) => {
                if self.branch_manager.branch_exists(&branch) {
                    self.branch_manager.update_branch(&branch, &commit_id)?;
                } else {
                    self.branch_manager.create_branch(&branch, &commit_id)?;
                }
            }
            Err(_) => {
                self.branch_manager.set_head_commit(&commit_id)?;
            }
        }

        staging.clear();
        staging.save()?;

        Ok(commit_id)
    }

    pub fn commit_signed(
        &self,
        message: &str,
        author: &str,
        key_name: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.load()?;

        if staging.entries.is_empty() {
            return Err("No files staged for commit".into());
        }

        let parents = match self.branch_manager.get_head_commit() {
            Ok(head) => vec![head],
            Err(_) => Vec::new(),
        };

        let tree = if parents.is_empty() {
            self.build_tree_from_staging(&staging)?
        } else {
            self.build_tree_from_staging_with_parent(&staging, &parents[0])?
        };
        let tree_hash = self.storage.write_object(&tree)?;

        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)?
            .as_secs() as i64;

        let commit = Commit::new(tree_hash.clone(), parents.clone(), author.to_string(), message.to_string(), timestamp);
        let commit_id_for_signing = commit.hash();

        let signed = self.signature_manager.sign_commit_with_key(&commit_id_for_signing, key_name)?;
        let signed_commit = commit.with_signature(signed.signature.clone(), signed.public_key.clone());

        let final_commit_id = signed_commit.hash();
        self.storage.write_object(&signed_commit)?;

        let current_branch = self.branch_manager.get_current_branch();
        match current_branch {
            Ok(branch) => {
                if self.branch_manager.branch_exists(&branch) {
                    self.branch_manager.update_branch(&branch, &final_commit_id)?;
                } else {
                    self.branch_manager.create_branch(&branch, &final_commit_id)?;
                }
            }
            Err(_) => {
                self.branch_manager.set_head_commit(&final_commit_id)?;
            }
        }

        staging.clear();
        staging.save()?;

        Ok(final_commit_id)
    }

    pub fn verify_commit(&self, commit_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let commit = self.commit_store.read_commit(commit_id)?;

        if !commit.is_signed() {
            return Ok(false);
        }

        let signature = commit.signature.as_ref().ok_or("No signature found")?;
        let public_key = commit.public_key.as_ref().ok_or("No public key found")?;

        let commit_for_verify = Commit::new(
            commit.tree_hash.clone(),
            commit.parents.clone(),
            commit.author.clone(),
            commit.message.clone(),
            commit.timestamp,
        );
        let commit_id_for_verify = commit_for_verify.hash();

        self.signature_manager.verify_signature(
            &commit_id_for_verify,
            signature,
            public_key,
        )
    }

    pub fn generate_keypair(&self, name: &str) -> Result<KeyPair, Box<dyn std::error::Error>> {
        let keypair = self.signature_manager.generate_keypair()?;
        self.signature_manager.save_keypair(name, &keypair)?;
        Ok(keypair)
    }

    pub fn list_keys(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        self.signature_manager.list_keys()
    }

    pub fn get_commit_at_time(
        &self,
        timestamp: i64,
    ) -> Result<Option<Commit>, Box<dyn std::error::Error>> {
        let history = self.get_commit_history(None)?;
        let mut result: Option<Commit> = None;
        let mut min_diff = i64::MAX;

        for commit in history {
            let diff = (commit.timestamp - timestamp).abs();
            if diff < min_diff {
                min_diff = diff;
                result = Some(commit);
            }
        }

        Ok(result)
    }

    pub fn get_file_tree_at_commit(
        &self,
        commit_id: &str,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        self.get_file_tree(Some(commit_id))
    }

    pub fn get_commit(&self, commit_id: &str) -> Result<Commit, Box<dyn std::error::Error>> {
        self.commit_store.read_commit(commit_id)
    }

    pub fn get_commit_history(
        &self,
        branch: Option<&str>,
    ) -> Result<Vec<Commit>, Box<dyn std::error::Error>> {
        let start_commit = if let Some(branch_name) = branch {
            self.branch_manager.get_branch_commit(branch_name)?
        } else {
            self.branch_manager.get_head_commit()?
        };
        self.commit_store.get_commit_history(&start_commit)
    }

    pub fn create_branch(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let head_commit = self.branch_manager.get_head_commit()?;
        self.branch_manager.create_branch(name, &head_commit)
    }

    pub fn switch_branch(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        if !self.branch_manager.branch_exists(name) {
            return Err(format!("Branch '{}' does not exist", name).into());
        }
        let commit_id = self.branch_manager.get_branch_commit(name)?;
        self.checkout(&commit_id)?;
        self.branch_manager.set_current_branch(name)?;
        Ok(())
    }

    pub fn get_branches(&self) -> Result<Vec<BranchInfo>, Box<dyn std::error::Error>> {
        let branches = self.branch_manager.list_branches()?;
        let current = self.branch_manager.get_current_branch().ok();
        let mut result = Vec::new();
        for name in branches {
            let commit_id = self.branch_manager.get_branch_commit(&name)?;
            result.push(BranchInfo {
                name: name.clone(),
                current: current.as_deref() == Some(&name),
                commit_id,
            });
        }
        result.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(result)
    }

    pub fn get_current_branch(&self) -> Result<String, Box<dyn std::error::Error>> {
        self.branch_manager.get_current_branch()
    }

    pub fn get_diff(
        &self,
        old_commit: &str,
        new_commit: &str,
    ) -> Result<Vec<DiffEntry>, Box<dyn std::error::Error>> {
        self.diff_calc.diff_commits(old_commit, new_commit)
    }

    pub fn get_working_diff(&self) -> Result<Vec<DiffEntry>, Box<dyn std::error::Error>> {
        let mut working_files = HashMap::new();
        for entry in WalkDir::new(&self.root)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            if let Some(relative) = path.strip_prefix(&self.root).ok() {
                let rel_str = relative.to_string_lossy().replace('\\', "/");
                if rel_str.starts_with(".vfs/") || rel_str == ".vfs" {
                    continue;
                }
                if let Ok(content) = fs::read(path) {
                    let blob = Blob::new(content.clone());
                    let hash = blob.hash();
                    working_files.insert(rel_str, (hash, content));
                }
            }
        }

        let head_commit = self.branch_manager.get_head_commit()?;
        self.diff_calc.diff_tree_working(&head_commit, &working_files)
    }

    pub fn checkout(&self, commit_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let tree = self.commit_store.get_commit_tree(commit_id)?;
        let files = self.commit_store.get_all_files_in_tree(&tree, "")?;
        let file_map: HashMap<String, String> = files.into_iter().collect();

        let mut existing_files = HashSet::new();
        for entry in WalkDir::new(&self.root)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_dir() {
                continue;
            }
            if let Some(relative) = path.strip_prefix(&self.root).ok() {
                let rel_str = relative.to_string_lossy().replace('\\', "/");
                if rel_str.starts_with(".vfs/") || rel_str == ".vfs" {
                    continue;
                }
                existing_files.insert(rel_str.clone());
            }
        }

        for (path, hash) in &file_map {
            let full_path = self.root.join(path);
            if let Some(parent) = full_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let blob = self.commit_store.read_blob(hash)?;
            fs::write(&full_path, &blob.content)?;
            existing_files.remove(path);
        }

        for path in &existing_files {
            let full_path = self.root.join(path);
            if full_path.exists() {
                fs::remove_file(&full_path)?;
            }
        }

        let mut staging = StagingArea::new(self.vfs_dir.clone());
        staging.clear();
        staging.save()?;

        Ok(())
    }

    pub fn get_file_tree(
        &self,
        commit_id: Option<&str>,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let tree = if let Some(cid) = commit_id {
            self.commit_store.get_commit_tree(cid)?
        } else {
            let head_commit = self.branch_manager.get_head_commit()?;
            self.commit_store.get_commit_tree(&head_commit)?
        };

        let root_node = self.build_tree_node(&tree, "", "")?;
        Ok(serde_json::to_value(root_node)?)
    }

    fn build_tree_from_staging(
        &self,
        staging: &StagingArea,
    ) -> Result<Tree, Box<dyn std::error::Error>> {
        use std::collections::BTreeMap;

        struct DirNode {
            entries: BTreeMap<String, (String, bool)>,
        }

        let mut root: BTreeMap<String, DirNode> = BTreeMap::new();
        root.insert(
            String::new(),
            DirNode {
                entries: BTreeMap::new(),
            },
        );

        for (path, entry) in &staging.entries {
            let normalized_path = path.replace('\\', "/");
            let parts: Vec<&str> = normalized_path.split('/').collect();
            if parts.is_empty() {
                continue;
            }
            let file_name = parts[parts.len() - 1];
            let dir_path = if parts.len() > 1 {
                parts[0..parts.len() - 1].join("/")
            } else {
                String::new()
            };

            if parts.len() > 1 {
                let mut current_path = String::new();
                for i in 0..parts.len() - 1 {
                    if i > 0 {
                        current_path.push('/');
                    }
                    current_path.push_str(parts[i]);
                    if !root.contains_key(&current_path) {
                        root.insert(
                            current_path.clone(),
                            DirNode {
                                entries: BTreeMap::new(),
                            },
                        );
                    }
                }
            }

            let dir = root.get_mut(&dir_path).ok_or_else(|| {
                format!("Directory not found in tree structure: {}", dir_path)
            })?;
            dir.entries.insert(
                file_name.to_string(),
                (entry.hash.clone(), false),
            );
        }

        let mut dir_paths: Vec<String> = root.keys().cloned().collect();
        dir_paths.sort_by(|a, b| b.len().cmp(&a.len()));

        let mut tree_hashes: BTreeMap<String, String> = BTreeMap::new();

        for dir_path in dir_paths {
            let dir = root.get(&dir_path).ok_or_else(|| {
                format!("Directory not found: {}", dir_path)
            })?;
            let mut tree = Tree::new();

            for (name, (hash, is_dir)) in &dir.entries {
                tree.entries.insert(
                    name.clone(),
                    TreeNode {
                        name: name.clone(),
                        hash: if *is_dir {
                            let full_path = if dir_path.is_empty() {
                                name.clone()
                            } else {
                                format!("{}/{}", dir_path, name)
                            };
                            tree_hashes.get(&full_path).cloned().unwrap_or_else(|| hash.clone())
                        } else {
                            hash.clone()
                        },
                        is_dir: *is_dir,
                    },
                );
            }

            let subdirs: Vec<String> = root
                .keys()
                .filter(|p| {
                    p.starts_with(&format!("{}/", dir_path))
                        && p.split('/').count() == dir_path.split('/').count() + 1
                })
                .cloned()
                .collect();

            for subdir_path in &subdirs {
                let subdir_name = subdir_path
                    .split('/')
                    .last()
                    .ok_or_else(|| format!("Invalid subdirectory path: {}", subdir_path))?
                    .to_string();
                let subdir_hash = tree_hashes
                    .get(subdir_path)
                    .cloned()
                    .ok_or_else(|| format!("Subdirectory hash not found: {}", subdir_path))?;
                tree.entries.insert(
                    subdir_name.clone(),
                    TreeNode {
                        name: subdir_name,
                        hash: subdir_hash,
                        is_dir: true,
                    },
                );
            }

            let tree_hash = self.storage.write_object(&tree)?;
            tree_hashes.insert(dir_path, tree_hash);
        }

        let root_hash = tree_hashes
            .get("")
            .ok_or_else(|| "Root tree hash not found".to_string())?;
        self.storage.read_object::<Tree>(root_hash)
    }

    fn build_tree_from_staging_with_parent(
        &self,
        staging: &StagingArea,
        parent_commit_id: &str,
    ) -> Result<Tree, Box<dyn std::error::Error>> {
        use std::collections::BTreeMap;
        use std::collections::HashSet;

        let parent_commit = self.commit_store.read_commit(parent_commit_id)?;
        let parent_tree = self.commit_store.read_tree(&parent_commit.tree_hash)?;

        let mut all_files: BTreeMap<String, String> = BTreeMap::new();
        self.collect_files_from_tree(&parent_tree, "", &mut all_files)?;

        let mut deleted_files: HashSet<String> = HashSet::new();
        for (path, entry) in &staging.entries {
            let normalized_path = path.replace('\\', "/");
            if entry.hash == "" {
                deleted_files.insert(normalized_path);
            } else {
                all_files.insert(normalized_path, entry.hash.clone());
            }
        }

        for path in &deleted_files {
            all_files.remove(path);
        }

        let mut root: BTreeMap<String, BTreeMap<String, (String, bool)>> = BTreeMap::new();
        root.insert(String::new(), BTreeMap::new());

        for (path, hash) in &all_files {
            let parts: Vec<&str> = path.split('/').collect();
            if parts.is_empty() {
                continue;
            }
            let file_name = parts[parts.len() - 1];
            let dir_path = if parts.len() > 1 {
                parts[0..parts.len() - 1].join("/")
            } else {
                String::new()
            };

            if parts.len() > 1 {
                let mut current_path = String::new();
                for i in 0..parts.len() - 1 {
                    if i > 0 {
                        current_path.push('/');
                    }
                    current_path.push_str(parts[i]);
                    if !root.contains_key(&current_path) {
                        root.insert(current_path.clone(), BTreeMap::new());
                    }
                }
            }

            let dir = root.get_mut(&dir_path).ok_or_else(|| {
                format!("Directory not found in tree structure: {}", dir_path)
            })?;
            dir.insert(file_name.to_string(), (hash.clone(), false));
        }

        let mut dir_paths: Vec<String> = root.keys().cloned().collect();
        dir_paths.sort_by(|a, b| b.len().cmp(&a.len()));

        let mut tree_hashes: BTreeMap<String, String> = BTreeMap::new();

        for dir_path in &dir_paths {
            let dir = root.get(dir_path).ok_or_else(|| {
                format!("Directory not found: {}", dir_path)
            })?;
            let mut tree = Tree::new();

            for (name, (hash, is_dir)) in dir {
                tree.entries.insert(
                    name.clone(),
                    TreeNode {
                        name: name.clone(),
                        hash: if *is_dir {
                            let full_path = if dir_path.is_empty() {
                                name.clone()
                            } else {
                                format!("{}/{}", dir_path, name)
                            };
                            tree_hashes.get(&full_path).cloned().unwrap_or_else(|| hash.clone())
                        } else {
                            hash.clone()
                        },
                        is_dir: *is_dir,
                    },
                );
            }

            let subdirs: Vec<String> = root
                .keys()
                .filter(|p| {
                    p.starts_with(&format!("{}/", dir_path))
                        && p.split('/').count() == dir_path.split('/').count() + 1
                })
                .cloned()
                .collect();

            for subdir_path in &subdirs {
                let subdir_name = subdir_path
                    .split('/')
                    .last()
                    .ok_or_else(|| format!("Invalid subdirectory path: {}", subdir_path))?
                    .to_string();
                let subdir_hash = tree_hashes
                    .get(subdir_path)
                    .cloned()
                    .ok_or_else(|| format!("Subdirectory hash not found: {}", subdir_path))?;
                tree.entries.insert(
                    subdir_name.clone(),
                    TreeNode {
                        name: subdir_name,
                        hash: subdir_hash,
                        is_dir: true,
                    },
                );
            }

            let tree_hash = self.storage.write_object(&tree)?;
            tree_hashes.insert(dir_path.clone(), tree_hash);
        }

        let root_hash = tree_hashes
            .get("")
            .ok_or_else(|| "Root tree hash not found".to_string())?;
        self.storage.read_object::<Tree>(root_hash)
    }

    fn collect_files_from_tree(
        &self,
        tree: &Tree,
        path_prefix: &str,
        files: &mut BTreeMap<String, String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for (name, entry) in &tree.entries {
            let full_path = if path_prefix.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", path_prefix, name)
            };

            if entry.is_dir {
                let sub_tree = self.commit_store.read_tree(&entry.hash)?;
                self.collect_files_from_tree(&sub_tree, &full_path, files)?;
            } else {
                files.insert(full_path, entry.hash.clone());
            }
        }
        Ok(())
    }

    fn build_tree_node(
        &self,
        tree: &Tree,
        name: &str,
        path: &str,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let mut children = Vec::new();
        for (entry_name, entry) in &tree.entries {
            let entry_path = if path.is_empty() {
                entry_name.clone()
            } else {
                format!("{}/{}", path, entry_name)
            };
            if entry.is_dir {
                let sub_tree = self.commit_store.read_tree(&entry.hash)?;
                let child = self.build_tree_node(&sub_tree, entry_name, &entry_path)?;
                children.push(child);
            } else {
                children.push(serde_json::json!({
                    "name": entry_name,
                    "path": entry_path,
                    "is_dir": false,
                    "hash": entry.hash,
                    "children": null
                }));
            }
        }
        Ok(serde_json::json!({
            "name": name,
            "path": path,
            "is_dir": true,
            "hash": tree.hash(),
            "children": children
        }))
    }
}
