const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;

let sourceFilename;
let targetFilename;

if (platform === 'win32') {
  sourceFilename = 'vfs_core.dll';
  targetFilename = 'vfs_core.node';
} else if (platform === 'darwin') {
  sourceFilename = 'libvfs_core.dylib';
  targetFilename = arch === 'arm64' ? 'vfs_core-arm64.node' : 'vfs_core.node';
} else {
  sourceFilename = 'libvfs_core.so';
  targetFilename = arch === 'arm64' ? 'vfs_core-arm64.node' : 'vfs_core.node';
}

const buildType = process.argv.includes('--debug') ? 'debug' : 'release';
const sourcePath = path.join(__dirname, '..', 'target', buildType, sourceFilename);
const targetPath = path.join(__dirname, '..', targetFilename);

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Copied ${sourcePath} -> ${targetPath}`);
} else {
  console.error(`Source file not found: ${sourcePath}`);
  process.exit(1);
}
