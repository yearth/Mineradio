const os = require('os');
const path = require('path');

function defaultBeatMapCacheDir(options = {}) {
  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();

  if (platform === 'win32') return 'D:\\MineradioCache\\beatmaps';
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Mineradio', 'beatmaps');
  }
  return path.join(homeDir, '.mineradio', 'beatmaps');
}

module.exports = {
  defaultBeatMapCacheDir,
};
