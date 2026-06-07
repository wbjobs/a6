use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use zstd::stream::{Decoder, Encoder};

use crate::objects::VfsObject;

pub struct Storage {
    path: PathBuf,
}

impl Storage {
    pub fn new(vfs_dir: PathBuf) -> Self {
        let objects_dir = vfs_dir.join("objects");
        Self { path: objects_dir }
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(&self.path)?;
        Ok(())
    }

    fn object_path(&self, hash: &str) -> PathBuf {
        let dir = &hash[0..2];
        let file = &hash[2..];
        self.path.join(dir).join(file)
    }

    pub fn has_object(&self, hash: &str) -> bool {
        self.object_path(hash).exists()
    }

    pub fn write_object<T: VfsObject>(&self, obj: &T) -> Result<String, Box<dyn std::error::Error>> {
        let hash = obj.hash();
        let object_path = self.object_path(&hash);

        if object_path.exists() {
            return Ok(hash);
        }

        if let Some(parent) = object_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let header = format!("{} {}\0", obj.object_type(), obj.to_bytes().len());
        let mut data = Vec::new();
        data.extend_from_slice(header.as_bytes());
        data.extend_from_slice(&obj.to_bytes());

        let compressed = self.compress(&data)?;
        let mut file = fs::File::create(&object_path)?;
        file.write_all(&compressed)?;

        Ok(hash)
    }

    pub fn read_object<T: VfsObject>(
        &self,
        hash: &str,
    ) -> Result<T, Box<dyn std::error::Error>> {
        let object_path = self.object_path(hash);

        if !object_path.exists() {
            return Err(format!("Object not found: {}", hash).into());
        }

        let file = fs::File::open(&object_path)?;
        let reader = BufReader::new(file);
        let decoder = Decoder::new(reader)?;
        let data = self.decompress(decoder)?;

        let null_pos = data
            .iter()
            .position(|&b| b == 0)
            .ok_or("Invalid object format")?;
        let header = &data[..null_pos];
        let header_str = String::from_utf8_lossy(header);
        let parts: Vec<&str> = header_str.splitn(2, ' ').collect();
        if parts.len() != 2 {
            return Err("Invalid object header".into());
        }

        let object_bytes = &data[null_pos + 1..];
        T::from_bytes(object_bytes).map_err(|e| e.into())
    }

    pub fn read_raw_object_type(
        &self,
        hash: &str,
    ) -> Result<(String, Vec<u8>), Box<dyn std::error::Error>> {
        let object_path = self.object_path(hash);

        if !object_path.exists() {
            return Err(format!("Object not found: {}", hash).into());
        }

        let file = fs::File::open(&object_path)?;
        let reader = BufReader::new(file);
        let decoder = Decoder::new(reader)?;
        let data = self.decompress(decoder)?;

        let null_pos = data
            .iter()
            .position(|&b| b == 0)
            .ok_or("Invalid object format")?;
        let header = &data[..null_pos];
        let header_str = String::from_utf8_lossy(header);
        let parts: Vec<&str> = header_str.splitn(2, ' ').collect();
        if parts.len() != 2 {
            return Err("Invalid object header".into());
        }
        let obj_type = parts[0].to_string();
        let object_bytes = data[null_pos + 1..].to_vec();

        Ok((obj_type, object_bytes))
    }

    fn compress(&self, data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let mut encoder = Encoder::new(Vec::new(), 3)?;
        encoder.write_all(data)?;
        let compressed = encoder.finish()?;
        Ok(compressed)
    }

    fn decompress<R: BufRead>(&self, mut decoder: Decoder<'_, R>) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let mut buffer = Vec::new();
        decoder.read_to_end(&mut buffer)?;
        Ok(buffer)
    }
}
