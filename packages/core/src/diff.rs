use std::collections::HashMap;
use std::path::PathBuf;

use crate::commit::CommitStore;
use crate::DiffEntry;

pub struct DiffCalculator {
    commit_store: CommitStore,
}

impl DiffCalculator {
    pub fn new(vfs_dir: PathBuf) -> Self {
        Self {
            commit_store: CommitStore::new(vfs_dir),
        }
    }

    pub fn diff_commits(
        &self,
        old_commit: &str,
        new_commit: &str,
    ) -> Result<Vec<DiffEntry>, Box<dyn std::error::Error>> {
        let old_tree = self.commit_store.get_commit_tree(old_commit)?;
        let new_tree = self.commit_store.get_commit_tree(new_commit)?;

        let old_files: HashMap<String, String> = self
            .commit_store
            .get_all_files_in_tree(&old_tree, "")?
            .into_iter()
            .collect();
        let new_files: HashMap<String, String> = self
            .commit_store
            .get_all_files_in_tree(&new_tree, "")?
            .into_iter()
            .collect();

        let mut entries = Vec::new();

        for (path, old_hash) in &old_files {
            match new_files.get(path) {
                Some(new_hash) => {
                    if old_hash != new_hash {
                        let old_blob = self.commit_store.read_blob(old_hash)?;
                        let new_blob = self.commit_store.read_blob(new_hash)?;
                        entries.push(DiffEntry {
                            path: path.clone(),
                            old_hash: Some(old_hash.clone()),
                            new_hash: Some(new_hash.clone()),
                            status: "modified".to_string(),
                            old_content: Some(String::from_utf8_lossy(&old_blob.content).to_string()),
                            new_content: Some(String::from_utf8_lossy(&new_blob.content).to_string()),
                        });
                    }
                }
                None => {
                    let old_blob = self.commit_store.read_blob(old_hash)?;
                    entries.push(DiffEntry {
                        path: path.clone(),
                        old_hash: Some(old_hash.clone()),
                        new_hash: None,
                        status: "deleted".to_string(),
                        old_content: Some(String::from_utf8_lossy(&old_blob.content).to_string()),
                        new_content: None,
                    });
                }
            }
        }

        for (path, new_hash) in &new_files {
            if !old_files.contains_key(path) {
                let new_blob = self.commit_store.read_blob(new_hash)?;
                entries.push(DiffEntry {
                    path: path.clone(),
                    old_hash: None,
                    new_hash: Some(new_hash.clone()),
                    status: "added".to_string(),
                    old_content: None,
                    new_content: Some(String::from_utf8_lossy(&new_blob.content).to_string()),
                });
            }
        }

        entries.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(entries)
    }

    pub fn diff_tree_working(
        &self,
        commit_id: &str,
        working_files: &HashMap<String, (String, Vec<u8>)>,
    ) -> Result<Vec<DiffEntry>, Box<dyn std::error::Error>> {
        let tree = self.commit_store.get_commit_tree(commit_id)?;
        let tree_files: HashMap<String, String> = self
            .commit_store
            .get_all_files_in_tree(&tree, "")?
            .into_iter()
            .collect();

        let mut entries = Vec::new();

        for (path, tree_hash) in &tree_files {
            match working_files.get(path) {
                Some((working_hash, content)) => {
                    if tree_hash != working_hash {
                        let tree_blob = self.commit_store.read_blob(tree_hash)?;
                        entries.push(DiffEntry {
                            path: path.clone(),
                            old_hash: Some(tree_hash.clone()),
                            new_hash: Some(working_hash.clone()),
                            status: "modified".to_string(),
                            old_content: Some(String::from_utf8_lossy(&tree_blob.content).to_string()),
                            new_content: Some(String::from_utf8_lossy(content).to_string()),
                        });
                    }
                }
                None => {
                    let tree_blob = self.commit_store.read_blob(tree_hash)?;
                    entries.push(DiffEntry {
                        path: path.clone(),
                        old_hash: Some(tree_hash.clone()),
                        new_hash: None,
                        status: "deleted".to_string(),
                        old_content: Some(String::from_utf8_lossy(&tree_blob.content).to_string()),
                        new_content: None,
                    });
                }
            }
        }

        for (path, (working_hash, content)) in working_files {
            if !tree_files.contains_key(path) {
                entries.push(DiffEntry {
                    path: path.clone(),
                    old_hash: None,
                    new_hash: Some(working_hash.clone()),
                    status: "added".to_string(),
                    old_content: None,
                    new_content: Some(String::from_utf8_lossy(content).to_string()),
                });
            }
        }

        entries.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(entries)
    }

    pub fn diff_staged_working(
        &self,
        staged_files: &HashMap<String, String>,
        working_files: &HashMap<String, (String, Vec<u8>)>,
    ) -> Result<Vec<DiffEntry>, Box<dyn std::error::Error>> {
        let mut entries = Vec::new();

        for (path, staged_hash) in staged_files {
            match working_files.get(path) {
                Some((working_hash, content)) => {
                    if staged_hash != working_hash {
                        let staged_blob = self.commit_store.read_blob(staged_hash)?;
                        entries.push(DiffEntry {
                            path: path.clone(),
                            old_hash: Some(staged_hash.clone()),
                            new_hash: Some(working_hash.clone()),
                            status: "modified".to_string(),
                            old_content: Some(String::from_utf8_lossy(&staged_blob.content).to_string()),
                            new_content: Some(String::from_utf8_lossy(content).to_string()),
                        });
                    }
                }
                None => {
                    let staged_blob = self.commit_store.read_blob(staged_hash)?;
                    entries.push(DiffEntry {
                        path: path.clone(),
                        old_hash: Some(staged_hash.clone()),
                        new_hash: None,
                        status: "deleted".to_string(),
                        old_content: Some(String::from_utf8_lossy(&staged_blob.content).to_string()),
                        new_content: None,
                    });
                }
            }
        }

        for (path, (working_hash, content)) in working_files {
            if !staged_files.contains_key(path) {
                entries.push(DiffEntry {
                    path: path.clone(),
                    old_hash: None,
                    new_hash: Some(working_hash.clone()),
                    status: "added".to_string(),
                    old_content: None,
                    new_content: Some(String::from_utf8_lossy(content).to_string()),
                });
            }
        }

        entries.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(entries)
    }
}

pub fn compute_line_diff(old: &str, new: &str) -> Vec<(String, String)> {
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    let mut changes = Vec::new();
    let mut i = 0;
    let mut j = 0;

    while i < old_lines.len() || j < new_lines.len() {
        if i >= old_lines.len() {
            changes.push(("+".to_string(), new_lines[j].to_string()));
            j += 1;
        } else if j >= new_lines.len() {
            changes.push(("-".to_string(), old_lines[i].to_string()));
            i += 1;
        } else if old_lines[i] == new_lines[j] {
            changes.push((" ".to_string(), old_lines[i].to_string()));
            i += 1;
            j += 1;
        } else {
            let mut found_match = false;
            for look_ahead in 1..5 {
                if i + look_ahead < old_lines.len() && old_lines[i + look_ahead] == new_lines[j] {
                    for k in 0..look_ahead {
                        changes.push(("-".to_string(), old_lines[i + k].to_string()));
                    }
                    i += look_ahead;
                    found_match = true;
                    break;
                }
                if j + look_ahead < new_lines.len() && old_lines[i] == new_lines[j + look_ahead] {
                    for k in 0..look_ahead {
                        changes.push(("+".to_string(), new_lines[j + k].to_string()));
                    }
                    j += look_ahead;
                    found_match = true;
                    break;
                }
            }
            if !found_match {
                changes.push(("-".to_string(), old_lines[i].to_string()));
                changes.push(("+".to_string(), new_lines[j].to_string()));
                i += 1;
                j += 1;
            }
        }
    }

    changes
}
