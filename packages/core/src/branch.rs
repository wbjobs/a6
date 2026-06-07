use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct BranchManager {
    vfs_dir: PathBuf,
}

impl BranchManager {
    pub fn new(vfs_dir: PathBuf) -> Self {
        Self { vfs_dir }
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        let branches_dir = self.vfs_dir.join("branches");
        fs::create_dir_all(&branches_dir)?;
        let head_path = self.vfs_dir.join("HEAD");
        if !head_path.exists() {
            self.set_current_branch("main")?;
        }
        Ok(())
    }

    pub fn create_branch(&self, name: &str, commit_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let branch_path = self.branch_path(name);
        if branch_path.exists() {
            return Err(format!("Branch '{}' already exists", name).into());
        }
        if let Some(parent) = branch_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&branch_path, commit_id)?;
        Ok(())
    }

    pub fn delete_branch(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let branch_path = self.branch_path(name);
        if !branch_path.exists() {
            return Err(format!("Branch '{}' does not exist", name).into());
        }
        fs::remove_file(&branch_path)?;
        Ok(())
    }

    pub fn get_branch_commit(&self, name: &str) -> Result<String, Box<dyn std::error::Error>> {
        let branch_path = self.branch_path(name);
        if !branch_path.exists() {
            return Err(format!("Branch '{}' does not exist", name).into());
        }
        let commit_id = fs::read_to_string(&branch_path)?;
        Ok(commit_id.trim().to_string())
    }

    pub fn update_branch(&self, name: &str, commit_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let branch_path = self.branch_path(name);
        if !branch_path.exists() {
            return Err(format!("Branch '{}' does not exist", name).into());
        }
        fs::write(&branch_path, commit_id)?;
        Ok(())
    }

    pub fn branch_exists(&self, name: &str) -> bool {
        self.branch_path(name).exists()
    }

    pub fn list_branches(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let branches_dir = self.vfs_dir.join("branches");
        if !branches_dir.exists() {
            return Ok(Vec::new());
        }
        let mut branches = Vec::new();
        for entry in fs::read_dir(&branches_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    branches.push(name.to_string());
                }
            } else if path.is_dir() {
                self.collect_branches_recursive(&path, "", &mut branches)?;
            }
        }
        Ok(branches)
    }

    fn collect_branches_recursive(
        &self,
        dir: &PathBuf,
        prefix: &str,
        branches: &mut Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let full_name = if prefix.is_empty() {
                        name.to_string()
                    } else {
                        format!("{}/{}", prefix, name)
                    };
                    branches.push(full_name);
                }
            } else if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let new_prefix = if prefix.is_empty() {
                        name.to_string()
                    } else {
                        format!("{}/{}", prefix, name)
                    };
                    self.collect_branches_recursive(&path, &new_prefix, branches)?;
                }
            }
        }
        Ok(())
    }

    pub fn get_current_branch(&self) -> Result<String, Box<dyn std::error::Error>> {
        let head_path = self.vfs_dir.join("HEAD");
        if !head_path.exists() {
            return Ok("main".to_string());
        }
        let content = fs::read_to_string(&head_path)?;
        let content = content.trim();
        if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
            Ok(branch.to_string())
        } else {
            Err("HEAD is detached".into())
        }
    }

    pub fn set_current_branch(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let head_path = self.vfs_dir.join("HEAD");
        if let Some(parent) = head_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&head_path, format!("ref: refs/heads/{}", name))?;
        Ok(())
    }

    pub fn get_head_commit(&self) -> Result<String, Box<dyn std::error::Error>> {
        let head_path = self.vfs_dir.join("HEAD");
        if !head_path.exists() {
            return Err("Repository not initialized".into());
        }
        let content = fs::read_to_string(&head_path)?;
        let content = content.trim();
        if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
            self.get_branch_commit(branch)
        } else {
            Ok(content.to_string())
        }
    }

    pub fn set_head_commit(&self, commit_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let current = self.get_current_branch();
        match current {
            Ok(branch) => {
                self.update_branch(&branch, commit_id)?;
            }
            Err(_) => {
                let head_path = self.vfs_dir.join("HEAD");
                fs::write(&head_path, commit_id)?;
            }
        }
        Ok(())
    }

    fn branch_path(&self, name: &str) -> PathBuf {
        self.vfs_dir.join("branches").join(name)
    }
}
