const path = require('path');
const os = require('os');

function getNativeFilename() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return 'vfs_core.node';
  } else if (platform === 'darwin') {
    return arch === 'arm64' ? 'vfs_core-arm64.node' : 'vfs_core.node';
  } else {
    return arch === 'arm64' ? 'vfs_core-arm64.node' : 'vfs_core.node';
  }
}

function loadVfsModule() {
  const nativePath = path.join(__dirname, getNativeFilename());
  return require(nativePath);
}

module.exports = {
  loadVfsModule,
  ...loadVfsModule()
};
