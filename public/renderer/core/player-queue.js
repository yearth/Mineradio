'use strict';

function songProviderKey(song) {
  if (song && (song.provider === 'qq' || song.source === 'qq' || song.type === 'qq')) return 'qq';
  return 'netease';
}

function queueItemKey(song) {
  if (!song) return '';
  if (song.provider === 'qq' || song.source === 'qq' || song.type === 'qq') return 'qq:' + (song.mid || song.songmid || song.id || (song.name + '|' + song.artist));
  if (song.type === 'podcast' && song.programId) return 'podcast:' + song.programId;
  if (song.localKey) return 'local:' + song.localKey;
  if (song.id != null && song.id !== '') return 'song:' + song.id;
  return String(song.name || '') + '|' + String(song.artist || '');
}

function cloneSong(song) {
  return Object.assign({}, song || {});
}

function queueSong(state, song, opts) {
  opts = opts || {};
  if (!song) return -1;
  var cloned = cloneSong(song);
  var playQueue = state.playQueue;
  var currentIdx = state.currentIdx;
  var insertAt = playQueue.length;
  if (opts.position === 'next') {
    var key = queueItemKey(cloned);
    var existing = -1;
    if (key) {
      for (var i = 0; i < playQueue.length; i++) {
        if (queueItemKey(playQueue[i]) === key) { existing = i; break; }
      }
    }
    if (existing === currentIdx) return currentIdx;
    if (existing >= 0) {
      cloned = playQueue.splice(existing, 1)[0];
      if (currentIdx >= 0 && existing < currentIdx) currentIdx -= 1;
    }
    var hasCurrent = currentIdx >= 0 && currentIdx < playQueue.length;
    insertAt = hasCurrent ? Math.min(playQueue.length, currentIdx + 1) : playQueue.length;
    playQueue.splice(insertAt, 0, cloned);
  } else {
    playQueue.push(cloned);
    insertAt = playQueue.length - 1;
  }
  state.currentIdx = currentIdx;
  return insertAt;
}

function queueSongNext(state, song) {
  return queueSong(state, song, { position: 'next' });
}

function moveQueueIndexToTop(state, idx) {
  idx = Number(idx);
  var playQueue = state.playQueue;
  if (!isFinite(idx) || idx < 0 || idx >= playQueue.length) return -1;
  if (idx === 0) return 0;
  var item = playQueue.splice(idx, 1)[0];
  playQueue.unshift(item);
  if (state.currentIdx === idx) state.currentIdx = 0;
  else if (state.currentIdx >= 0 && state.currentIdx < idx) state.currentIdx += 1;
  return 0;
}

function playSearchResultInQueue(state, playlist, i) {
  var song = playlist && playlist[i];
  if (!song) return -1;
  if (!state.playQueue.length) {
    state.playQueue.unshift(cloneSong(song));
    state.currentIdx = 0;
  } else {
    var matchIdx = -1;
    var targetKey = queueItemKey(song);
    for (var j = 0; j < state.playQueue.length; j++) {
      if (queueItemKey(state.playQueue[j]) === targetKey) { matchIdx = j; break; }
    }
    if (matchIdx >= 0) state.currentIdx = moveQueueIndexToTop(state, matchIdx);
    else {
      state.playQueue.unshift(cloneSong(song));
      state.currentIdx = 0;
    }
  }
  return state.currentIdx;
}

function playbackProviderLabel(song) {
  return songProviderKey(song) === 'qq' ? 'QQ 音乐' : '网易云';
}

function playbackLoginProvider(song) {
  return songProviderKey(song) === 'qq' ? 'qq' : 'netease';
}

function playbackRestrictionMessage(song, data) {
  data = data || {};
  var restriction = data.restriction || {};
  var category = data.reason || restriction.category || '';
  var provider = playbackProviderLabel(song);
  var message = data.message || restriction.message || '';
  if (!message) {
    if (category === 'login_required') message = provider + '需要登录后再尝试播放';
    else if (category === 'vip_required') message = provider + '歌曲需要会员权限';
    else if (category === 'paid_required') message = provider + '歌曲需要购买或更高权限';
    else if (category === 'trial_only') message = provider + '仅返回试听片段';
    else if (category === 'copyright_unavailable') message = provider + '版权暂不可播';
    else message = provider + '没有返回可播放地址';
  }
  if (category === 'login_required') return message + ' · 正在打开登录';
  if (category === 'copyright_unavailable' || category === 'url_unavailable') return message + ' · 可以试试另一个平台版本';
  return message;
}

module.exports = {
  queueItemKey: queueItemKey,
  cloneSong: cloneSong,
  queueSong: queueSong,
  queueSongNext: queueSongNext,
  moveQueueIndexToTop: moveQueueIndexToTop,
  playSearchResultInQueue: playSearchResultInQueue,
  playbackProviderLabel: playbackProviderLabel,
  playbackLoginProvider: playbackLoginProvider,
  playbackRestrictionMessage: playbackRestrictionMessage,
};
