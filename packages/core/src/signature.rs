use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPair {
    pub public_key: String,
    pub private_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedCommit {
    pub commit_id: String,
    pub signature: String,
    pub public_key: String,
    pub verified: bool,
}

pub struct SignatureManager {
    keys_dir: PathBuf,
}

impl SignatureManager {
    pub fn new(vfs_dir: PathBuf) -> Self {
        Self {
            keys_dir: vfs_dir.join("keys"),
        }
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(&self.keys_dir)?;
        Ok(())
    }

    pub fn generate_keypair(&self) -> Result<KeyPair, Box<dyn std::error::Error>> {
        let mut csprng = OsRng;
        let signing_key: SigningKey = SigningKey::generate(&mut csprng);
        let verifying_key: VerifyingKey = signing_key.verifying_key();

        let keypair = KeyPair {
            public_key: hex::encode(verifying_key.to_bytes()),
            private_key: hex::encode(signing_key.to_bytes()),
        };

        Ok(keypair)
    }

    pub fn save_keypair(&self, name: &str, keypair: &KeyPair) -> Result<(), Box<dyn std::error::Error>> {
        let key_path = self.keys_dir.join(format!("{}.json", name));
        let json = serde_json::to_string_pretty(keypair)?;
        fs::write(key_path, json)?;
        Ok(())
    }

    pub fn load_keypair(&self, name: &str) -> Result<KeyPair, Box<dyn std::error::Error>> {
        let key_path = self.keys_dir.join(format!("{}.json", name));
        if !key_path.exists() {
            return Err(format!("Key '{}' not found", name).into());
        }
        let json = fs::read_to_string(key_path)?;
        let keypair: KeyPair = serde_json::from_str(&json)?;
        Ok(keypair)
    }

    pub fn list_keys(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        if !self.keys_dir.exists() {
            return Ok(Vec::new());
        }
        let mut keys = Vec::new();
        for entry in fs::read_dir(&self.keys_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                    keys.push(name.to_string());
                }
            }
        }
        Ok(keys)
    }

    pub fn sign_commit(
        &self,
        commit_id: &str,
        keypair: &KeyPair,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let private_key_bytes = hex::decode(&keypair.private_key)?;
        let signing_key = SigningKey::from_bytes(&private_key_bytes.try_into().map_err(|_| "Invalid private key length")?);
        let signature = signing_key.sign(commit_id.as_bytes());
        Ok(hex::encode(signature.to_bytes()))
    }

    pub fn verify_signature(
        &self,
        commit_id: &str,
        signature: &str,
        public_key: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let public_key_bytes = hex::decode(public_key)?;
        let verifying_key = VerifyingKey::from_bytes(&public_key_bytes.try_into().map_err(|_| "Invalid public key length")?)?;
        let signature_bytes = hex::decode(signature)?;
        let signature = Signature::from_bytes(&signature_bytes.try_into().map_err(|_| "Invalid signature length")?);
        Ok(verifying_key.verify(commit_id.as_bytes(), &signature).is_ok())
    }

    pub fn sign_commit_with_key(
        &self,
        commit_id: &str,
        key_name: &str,
    ) -> Result<SignedCommit, Box<dyn std::error::Error>> {
        let keypair = self.load_keypair(key_name)?;
        let signature = self.sign_commit(commit_id, &keypair)?;
        Ok(SignedCommit {
            commit_id: commit_id.to_string(),
            signature,
            public_key: keypair.public_key.clone(),
            verified: true,
        })
    }
}
