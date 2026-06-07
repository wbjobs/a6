use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub trait VfsObject {
    fn object_type(&self) -> &'static str;
    fn to_bytes(&self) -> Vec<u8>;
    fn from_bytes(bytes: &[u8]) -> Result<Self, String>
    where
        Self: Sized;

    fn hash(&self) -> String {
        let header = format!("{} {}\0", self.object_type(), self.to_bytes().len());
        let mut hasher = Sha256::new();
        hasher.update(header.as_bytes());
        hasher.update(&self.to_bytes());
        hex::encode(hasher.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Blob {
    pub content: Vec<u8>,
}

impl Blob {
    pub fn new(content: Vec<u8>) -> Self {
        Self { content }
    }
}

impl VfsObject for Blob {
    fn object_type(&self) -> &'static str {
        "blob"
    }

    fn to_bytes(&self) -> Vec<u8> {
        self.content.clone()
    }

    fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        Ok(Self {
            content: bytes.to_vec(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeNode {
    pub name: String,
    pub hash: String,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tree {
    pub entries: BTreeMap<String, TreeNode>,
}

impl Tree {
    pub fn new() -> Self {
        Self {
            entries: BTreeMap::new(),
        }
    }

    pub fn insert(&mut self, path: &str, hash: String, is_dir: bool) {
        let normalized_path = path.replace('\\', "/");
        let parts: Vec<&str> = normalized_path.splitn(2, '/').collect();
        if parts.len() == 1 {
            let name = parts[0].to_string();
            self.entries.insert(
                name.clone(),
                TreeNode {
                    name,
                    hash,
                    is_dir,
                },
            );
        } else {
            let dir_name = parts[0];
            let remaining = parts[1];
            let sub_tree = self
                .entries
                .entry(dir_name.to_string())
                .or_insert_with(|| TreeNode {
                    name: dir_name.to_string(),
                    hash: Tree::new().hash(),
                    is_dir: true,
                });
            let mut child_tree: Tree = if !sub_tree.hash.is_empty() {
                Tree::from_hash(&sub_tree.hash).unwrap_or_else(|_| Tree::new())
            } else {
                Tree::new()
            };
            child_tree.insert(remaining, hash, is_dir);
            sub_tree.hash = child_tree.hash();
        }
    }
}

impl Default for Tree {
    fn default() -> Self {
        Self::new()
    }
}

impl VfsObject for Tree {
    fn object_type(&self) -> &'static str {
        "tree"
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        for (_, entry) in &self.entries {
            let kind = if entry.is_dir { "tree" } else { "blob" };
            let line = format!("{} {} {}\n", kind, entry.hash, entry.name);
            bytes.extend_from_slice(line.as_bytes());
        }
        bytes
    }

    fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        let content = String::from_utf8(bytes.to_vec()).map_err(|e| e.to_string())?;
        let mut entries = BTreeMap::new();
        for line in content.lines() {
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() == 3 {
                let kind = parts[0];
                let hash = parts[1].to_string();
                let name = parts[2].to_string();
                let is_dir = kind == "tree";
                entries.insert(
                    name.clone(),
                    TreeNode {
                        name,
                        hash,
                        is_dir,
                    },
                );
            }
        }
        Ok(Self { entries })
    }
}

impl Tree {
    pub fn from_hash(_hash: &str) -> Result<Self, String> {
        Err("Tree::from_hash must be called through Repository".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub id: String,
    pub tree_hash: String,
    pub parents: Vec<String>,
    pub author: String,
    pub message: String,
    pub timestamp: i64,
}

impl Commit {
    pub fn new(
        tree_hash: String,
        parents: Vec<String>,
        author: String,
        message: String,
        timestamp: i64,
    ) -> Self {
        let mut commit = Self {
            id: String::new(),
            tree_hash,
            parents,
            author,
            message,
            timestamp,
        };
        commit.id = commit.hash();
        commit
    }
}

impl VfsObject for Commit {
    fn object_type(&self) -> &'static str {
        "commit"
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut s = String::new();
        s.push_str(&format!("tree {}\n", self.tree_hash));
        for parent in &self.parents {
            s.push_str(&format!("parent {}\n", parent));
        }
        s.push_str(&format!("author {}\n", self.author));
        s.push_str(&format!("timestamp {}\n", self.timestamp));
        s.push('\n');
        s.push_str(&self.message);
        s.into_bytes()
    }

    fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        let content = String::from_utf8(bytes.to_vec()).map_err(|e| e.to_string())?;
        let mut lines = content.lines();
        let mut tree_hash = String::new();
        let mut parents = Vec::new();
        let mut author = String::new();
        let mut timestamp = 0;
        let message;

        while let Some(line) = lines.next() {
            if line.is_empty() {
                break;
            }
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if parts.len() == 2 {
                match parts[0] {
                    "tree" => tree_hash = parts[1].to_string(),
                    "parent" => parents.push(parts[1].to_string()),
                    "author" => author = parts[1].to_string(),
                    "timestamp" => {
                        timestamp = parts[1].parse::<i64>().map_err(|e| e.to_string())?
                    }
                    _ => {}
                }
            }
        }

        message = lines.collect::<Vec<&str>>().join("\n");

        let id = Self {
            id: String::new(),
            tree_hash: tree_hash.clone(),
            parents: parents.clone(),
            author: author.clone(),
            message: message.clone(),
            timestamp,
        }
        .hash();

        Ok(Self {
            id,
            tree_hash,
            parents,
            author,
            message,
            timestamp,
        })
    }
}
