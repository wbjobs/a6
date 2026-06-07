use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingEntry {
    pub path: String,
    pub hash: String,
    pub size: u64,
    pub modified: i64,
}

#[derive(Debug, Clone)]
pub struct StagingArea {
    path: PathBuf,
    pub entries: BTreeMap<String, StagingEntry>,
}

impl StagingArea {
    pub fn new(vfs_dir: PathBuf) -> Self {
        Self {
            path: vfs_dir.join("index"),
            entries: BTreeMap::new(),
        }
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.path.exists() {
            let empty = StagingArea {
                path: self.path.clone(),
                entries: BTreeMap::new(),
            };
            empty.save()?;
        }
        Ok(())
    }

    pub fn load(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.path.exists() {
            self.entries.clear();
            return Ok(());
        }

        let content = fs::read(&self.path)?;
        let decoded: StagingFile = serde_json::from_slice(&content)?;
        self.entries = decoded
            .entries
            .into_iter()
            .map(|e| (e.path.clone(), e))
            .collect();
        Ok(())
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let entries: Vec<StagingEntry> = self.entries.values().cloned().collect();
        let staging_file = StagingFile { entries };
        let content = serde_json::to_vec_pretty(&staging_file)?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&self.path, content)?;
        Ok(())
    }

    pub fn add(&mut self, path: &str, hash: String, size: u64, modified: i64) {
        self.entries.insert(
            path.to_string(),
            StagingEntry {
                path: path.to_string(),
                hash,
                size,
                modified,
            },
        );
    }

    pub fn remove(&mut self, path: &str) {
        self.entries.remove(path);
    }

    pub fn has(&self, path: &str) -> bool {
        self.entries.contains_key(path)
    }

    pub fn get(&self, path: &str) -> Option<&StagingEntry> {
        self.entries.get(path)
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn files(&self) -> Vec<String> {
        self.entries.keys().cloned().collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StagingFile {
    entries: Vec<StagingEntry>,
}
