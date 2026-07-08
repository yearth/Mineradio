'use strict';

function fallbackEscHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createDeps(deps) {
  deps = deps || {};
  return {
    escHtml: deps.escHtml || fallbackEscHtml,
    songCoverSrc: deps.songCoverSrc || function() { return ''; },
    heartIconSvg: deps.heartIconSvg || function() { return ''; },
    playlistPlusIconSvg: deps.playlistPlusIconSvg || function() { return ''; },
    isSongLiked: deps.isSongLiked || function() { return false; },
  };
}

function renderQueuePanelEmptyHtml() {
  return '<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.32);font-size:11.5px">队列为空，搜索后点 + 设为下一首</div>';
}

function renderQueuePanelItemsHtml(playQueue, currentIdx, deps) {
  deps = createDeps(deps);
  var queue = Array.isArray(playQueue) ? playQueue : [];
  return queue.map(function(song, i) {
    song = song || {};
    var thumb = deps.songCoverSrc(song, 60);
    var imgTag = thumb
      ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">'
      : '<div style="width:38px;height:38px;border-radius:6px;background:rgba(255,255,255,.06);flex-shrink:0"></div>';
    var liked = deps.isSongLiked(song);
    return '<div class="queue-item' + (i === currentIdx ? ' now' : '') + '" onclick="playQueueAt(' + i + ')">' +
      imgTag +
      '<div class="qi-info"><div class="qi-name">' + deps.escHtml(song.name) + '</div><div class="qi-sub"><button class="queue-artist-link" type="button" onclick="event.stopPropagation();openQueueArtist(' + i + ')">' + deps.escHtml(song.artist || '未知歌手') + '</button></div></div>' +
      '<div class="qi-act">' +
        '<button class="' + (liked ? 'liked' : '') + '" onclick="event.stopPropagation();toggleLikeQueueIndex(' + i + ')" title="' + (liked ? '取消红心' : '红心喜欢') + '">' + deps.heartIconSvg() + '</button>' +
        '<button class="queue-next" onclick="event.stopPropagation();queueIndexNext(' + i + ')" title="下一首播放">下</button>' +
        '<button onclick="event.stopPropagation();collectQueueIndex(' + i + ')" title="收藏到歌单">' + deps.playlistPlusIconSvg() + '</button>' +
        '<button onclick="event.stopPropagation();removeFromQueue(' + i + ')" title="移除">×</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

var MineradioQueuePanel = {
  renderQueuePanelEmptyHtml: renderQueuePanelEmptyHtml,
  renderQueuePanelItemsHtml: renderQueuePanelItemsHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioQueuePanel = MineradioQueuePanel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioQueuePanel;
}
