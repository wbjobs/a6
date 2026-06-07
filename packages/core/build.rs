fn main() {
    println!("cargo:rerun-if-changed=src/lib.rs");
    println!("cargo:rerun-if-changed=src/objects.rs");
    println!("cargo:rerun-if-changed=src/storage.rs");
    println!("cargo:rerun-if-changed=src/staging.rs");
    println!("cargo:rerun-if-changed=src/branch.rs");
    println!("cargo:rerun-if-changed=src/commit.rs");
    println!("cargo:rerun-if-changed=src/diff.rs");
    println!("cargo:rerun-if-changed=src/repo.rs");
}
