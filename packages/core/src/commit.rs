use std::collections::HashSet;
use std::path::PathBuf;

use crate::objects::{Blob, Commit, Tree, VfsObject};
use crate::storage::Storage;

pub struct CommitStore {
    storage: Storage,
}

impl CommitStore {
    pub fn new(vfs_dir: PathBuf) -> Self {
        Self {
            storage: Storage::new(vfs_dir),
        }
    }

    pub fn write_commit(
        &self,
        tree_hash: String,
        parents: Vec<String>,
        author: &str,
        message: &str,
        timestamp: i64,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let commit = Commit::new(tree_hash, parents, author.to_string(), message.to_string(), timestamp);
        let hash = self.storage.write_object(&commit)?;
        Ok(hash)
    }

    pub fn read_commit(&self, commit_id: &str) -> Result<Commit, Box<dyn std::error::Error>> {
        let (obj_type, bytes) = self.storage.read_raw_object_type(commit_id)?;
        if obj_type != "commit" {
            return Err(format!("Object {} is not a commit", commit_id).into());
        }
        Commit::from_bytes(&bytes).map_err(|e| e.into())
    }

    pub fn get_commit_history(
        &self,
        start_commit: &str,
    ) -> Result<Vec<Commit>, Box<dyn std::error::Error>> {
        let mut history = Vec::new();
        let mut visited = HashSet::new();
        let mut queue = vec![start_commit.to_string()];

        while let Some(commit_id) = queue.pop() {
            if visited.contains(&commit_id) {
                continue;
            }
            visited.insert(commit_id.clone());

            match self.read_commit(&commit_id) {
                Ok(commit) => {
                    for parent in &commit.parents {
                        if !visited.contains(parent) {
                            queue.push(parent.clone());
                        }
                    }
                    history.push(commit);
                }
                Err(_) => continue,
            }
        }

        history.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(history)
    }

    pub fn commit_exists(&self, commit_id: &str) -> bool {
        match self.storage.read_raw_object_type(commit_id) {
            Ok((obj_type, _)) => obj_type == "commit",
            Err(_) => false,
        }
    }

    pub fn get_commit_tree(&self, commit_id: &str) -> Result<Tree, Box<dyn std::error::Error>> {
        let commit = self.read_commit(commit_id)?;
        self.read_tree(&commit.tree_hash)
    }

    pub fn read_tree(&self, tree_hash: &str) -> Result<Tree, Box<dyn std::error::Error>> {
        let (obj_type, bytes) = self.storage.read_raw_object_type(tree_hash)?;
        if obj_type != "tree" {
            return Err(format!("Object {} is not a tree", tree_hash).into());
        }
        Tree::from_bytes(&bytes).map_err(|e| e.into())
    }

    pub fn read_blob(&self, blob_hash: &str) -> Result<Blob, Box<dyn std::error::Error>> {
        let (obj_type, bytes) = self.storage.read_raw_object_type(blob_hash)?;
        if obj_type != "blob" {
            return Err(format!("Object {} is not a blob", blob_hash).into());
        }
        Blob::from_bytes(&bytes).map_err(|e| e.into())
    }

    pub fn get_all_files_in_tree(
        &self,
        tree: &Tree,
        prefix: &str,
    ) -> Result<Vec<(String, String)>, Box<dyn std::error::Error>> {
        let mut files = Vec::new();
        for (name, entry) in &tree.entries {
            let path = if prefix.is_empty() {
                name.clone()
            } else {
                format!("{}/{}", prefix, name)
            };
            if entry.is_dir {
                let sub_tree = self.read_tree(&entry.hash)?;
                files.extend(self.get_all_files_in_tree(&sub_tree, &path)?);
            } else {
                files.push((path, entry.hash.clone()));
            }
        }
        Ok(files)
    }
}
