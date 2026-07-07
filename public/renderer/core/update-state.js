'use strict';

function clampRange(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function createDefaultUpdatePreviewState(overrides) {
  return Object.assign({
    visible: false,
    open: false,
    status: 'idle',
    progress: 0,
    downloadJobId: '',
    patchJobId: '',
    mode: 'installer',
    installerPath: '',
    installerOpened: false,
    cached: false,
    currentVersion: '0.9.11',
    version: '1.1.0',
    configured: false,
    preview: true,
    updateAvailable: false,
    releaseUrl: '',
    downloadUrl: '',
    patchAvailable: false,
    patchUrl: '',
    received: 0,
    total: 0,
    speedBps: 0,
    etaSeconds: 0,
    sourceLabel: '',
    attempt: 0,
    attempts: 0,
    errorReason: '',
    errorDetail: '',
    failedAttempts: [],
    message: '',
    restartRequired: false,
    patchFallbackTried: false,
    hero: '当前版本，更新检测已就绪。',
    notes: [
      '安装包文字对比修复',
      '安装目录可自由选择',
      '单实例与快捷方式修复',
    ],
  }, overrides || {});
}

function applyLatestUpdateInfo(state, data) {
  data = data || {};
  var release = data.release || {};
  state.currentVersion = data.currentVersion || state.currentVersion;
  state.version = data.latestVersion || release.version || state.currentVersion;
  state.configured = !!data.configured;
  state.preview = !!data.preview;
  state.updateAvailable = !!data.updateAvailable;
  state.releaseUrl = release.htmlUrl || data.htmlUrl || '';
  state.downloadUrl = release.downloadUrl || data.downloadUrl || '';
  state.patchAvailable = !!(release.patchAvailable && release.patch && release.patch.downloadUrl);
  state.patchUrl = state.patchAvailable ? release.patch.downloadUrl : '';
  state.patchFallbackTried = false;
  state.hero = release.summary || (state.updateAvailable ? '发现新版本，建议更新。' : '当前版本，更新检测已就绪。');
  if (Array.isArray(release.notes) && release.notes.length) {
    state.notes = release.notes.slice(0, 4);
  }
  return state;
}

function resetTransientDownloadFields(state) {
  state.progress = 0;
  state.installerPath = '';
  state.installerOpened = false;
  state.cached = false;
  state.received = 0;
  state.total = 0;
  state.speedBps = 0;
  state.etaSeconds = 0;
  state.sourceLabel = '';
  state.attempt = 0;
  state.attempts = 0;
  state.errorReason = '';
  state.errorDetail = '';
  state.failedAttempts = [];
}

function beginUpdateDownload(state) {
  state.status = 'downloading';
  state.mode = 'installer';
  state.downloadJobId = '';
  resetTransientDownloadFields(state);
  state.message = '正在下载完整安装包';
  return state;
}

function beginUpdatePatch(state) {
  state.status = 'downloading';
  state.mode = 'patch';
  state.patchJobId = '';
  resetTransientDownloadFields(state);
  state.patchFallbackTried = false;
  state.message = '正在下载快速补丁';
  return state;
}

function applyUpdateJobStatus(state, job) {
  job = job || {};
  if (job.status) state.status = job.status;
  if (job.progress != null) state.progress = clampRange(Number(job.progress) || 0, 0, 100);
  if (job.received != null) state.received = Number(job.received) || 0;
  if (job.total != null) state.total = Number(job.total) || 0;
  if (job.speedBps != null) state.speedBps = Number(job.speedBps) || 0;
  if (job.etaSeconds != null) state.etaSeconds = Number(job.etaSeconds) || 0;
  if (job.sourceLabel != null) state.sourceLabel = String(job.sourceLabel || '');
  if (job.attempt != null) state.attempt = Number(job.attempt) || 0;
  if (job.attempts != null) state.attempts = Number(job.attempts) || 0;
  if (job.message != null) state.message = String(job.message || '');
  if (job.cached != null) state.cached = !!job.cached;
  if (job.restartRequired != null) state.restartRequired = !!job.restartRequired;
  if (job.filePath || job.installerPath) state.installerPath = job.filePath || job.installerPath;
  if (state.status === 'ready') state.progress = 100;
  if (state.status === 'error') {
    state.errorReason = job.error || job.errorReason || state.errorReason;
    state.errorDetail = job.errorDetail || job.message || state.errorDetail;
    state.failedAttempts = Array.isArray(job.failedAttempts) ? job.failedAttempts.slice() : state.failedAttempts;
  }
  return state;
}

function formatUpdateBytes(bytes) {
  bytes = Number(bytes) || 0;
  if (bytes < 1024) return Math.round(bytes) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1).replace(/\.0$/, '') + ' KB';
  return (bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1).replace(/\.0$/, '') + ' MB';
}

function formatUpdateSpeed(bytesPerSecond) {
  bytesPerSecond = Number(bytesPerSecond) || 0;
  return bytesPerSecond > 0 ? (formatUpdateBytes(bytesPerSecond) + '/s') : '';
}

function updateProgressDetailText(state) {
  var parts = [];
  if (state.attempts > 1 && state.attempt > 0) {
    parts.push('线路 ' + state.attempt + '/' + state.attempts);
  }
  if (state.sourceLabel) parts.push(state.sourceLabel);
  if (state.received > 0) {
    parts.push(state.total > 0
      ? (formatUpdateBytes(state.received) + ' / ' + formatUpdateBytes(state.total))
      : ('已下载 ' + formatUpdateBytes(state.received)));
  }
  var speed = formatUpdateSpeed(state.speedBps);
  if (speed) parts.push(speed);
  if (state.etaSeconds > 0 && state.etaSeconds < 3600) parts.push('约 ' + state.etaSeconds + ' 秒');
  return parts.join(' · ');
}

module.exports = {
  createDefaultUpdatePreviewState: createDefaultUpdatePreviewState,
  applyLatestUpdateInfo: applyLatestUpdateInfo,
  beginUpdateDownload: beginUpdateDownload,
  beginUpdatePatch: beginUpdatePatch,
  applyUpdateJobStatus: applyUpdateJobStatus,
  updateProgressDetailText: updateProgressDetailText,
  formatUpdateBytes: formatUpdateBytes,
  formatUpdateSpeed: formatUpdateSpeed,
};
