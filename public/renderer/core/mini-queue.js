'use strict';

function fallbackEscHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function miniQueueCountText(playQueue, currentIdx) {
  var total = Array.isArray(playQueue) ? playQueue.length : 0;
  return total ? (total + ' 首' + (currentIdx >= 0 ? ' · 正在播放 ' + (currentIdx + 1) : '')) : '0 首';
}

function renderMiniQueueEmptyHtml() {
  return '<div class="mini-queue-empty">队列为空，先搜索或打开歌单</div>';
}

function renderMiniQueueItemsHtml(playQueue, currentIdx, deps) {
  deps = deps || {};
  var queue = Array.isArray(playQueue) ? playQueue : [];
  var escHtml = deps.escHtml || fallbackEscHtml;
  var songCoverSrc = deps.songCoverSrc || function() { return ''; };

  return queue.map(function(song, i) {
    var thumb = songCoverSrc(song, 60);
    var imgTag = thumb
      ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">'
      : '<div class="mini-queue-cover"></div>';
    return '<div class="mini-queue-item' + (i === currentIdx ? ' now' : '') + '" onclick="playQueueAt(' + i + ')">' +
      imgTag +
      '<div class="mini-queue-info"><div class="mini-queue-name">' + escHtml(song && song.name) + '</div><div class="mini-queue-sub">' + escHtml((song && song.artist) || '') + '</div></div>' +
      '<button class="mini-queue-remove mini-queue-next" onclick="event.stopPropagation();queueIndexNext(' + i + ')" title="下一首播放">下</button>' +
      '<button class="mini-queue-remove" onclick="event.stopPropagation();removeFromQueue(' + i + ')" title="移除">×</button>' +
    '</div>';
  }).join('');
}

var MineradioMiniQueue = {
  miniQueueCountText: miniQueueCountText,
  renderMiniQueueEmptyHtml: renderMiniQueueEmptyHtml,
  renderMiniQueueItemsHtml: renderMiniQueueItemsHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioMiniQueue = MineradioMiniQueue;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioMiniQueue;
}
