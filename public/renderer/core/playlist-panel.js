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
    detailHtml: deps.detailHtml || function() { return ''; },
    activeKey: deps.activeKey || '',
  };
}

function playlistPanelProvider(pl) {
  return pl && pl.provider === 'qq' ? 'qq' : 'netease';
}

function playlistPanelKey(provider, id) {
  return (provider === 'qq' ? 'qq' : 'netease') + ':' + String(id || '');
}

function playlistPanelProviderId(provider, id) {
  return provider === 'qq' ? ('qq:' + id) : id;
}

function playlistPanelCoverUrl(pl) {
  var provider = playlistPanelProvider(pl);
  if (!pl || !pl.cover) return '';
  return provider === 'qq' ? pl.cover : (pl.cover + '?param=88y88');
}

function renderPlaylistPanelCardHtml(pl, deps) {
  deps = createDeps(deps);
  pl = pl || {};
  var provider = playlistPanelProvider(pl);
  var providerLabel = provider === 'qq' ? 'QQ' : 'NE';
  var thumb = playlistPanelCoverUrl(pl);
  var imgTag = thumb
    ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">'
    : '<div style="width:44px;height:44px;border-radius:8px;background:rgba(255,255,255,.06);flex-shrink:0"></div>';
  var key = playlistPanelKey(provider, pl.id);
  var expanded = deps.activeKey === key ? ' expanded' : '';
  return '<div class="pl-card' + expanded + '" data-playlist-provider="' + provider + '" data-playlist-id="' + deps.escHtml(String(pl.id || '')) + '" data-playlist-title="' + deps.escHtml(pl.name || '') + '">' +
    imgTag +
    '<div style="flex:1;min-width:0"><div class="pl-name">' + deps.escHtml(pl.name) + '<span class="tag-source ' + provider + '" style="margin-left:6px;vertical-align:1px">' + providerLabel + '</span></div><div class="pl-sub">' + pl.trackCount + ' 首 · ' + deps.escHtml(pl.creator || '') + '</div></div>' +
  '</div>' + deps.detailHtml(pl, provider);
}

function playlistPanelEmptyHtml() {
  return '<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.32);font-size:11.5px">未找到歌单</div>';
}

function renderPlaylistPanelListHtml(playlists, renderLimit, deps) {
  playlists = Array.isArray(playlists) ? playlists : [];
  deps = createDeps(deps);
  if (!playlists.length) {
    return { html: playlistPanelEmptyHtml(), renderedCount: 0 };
  }
  renderLimit = Math.max(0, renderLimit || 0);
  var renderedCount = 0;
  function visibleGroupItems(items) {
    var room = renderLimit - renderedCount;
    if (room <= 0) return [];
    var visible = items.slice(0, room);
    renderedCount += visible.length;
    return visible;
  }
  var groups = [
    { label: '网易云歌单', items: playlists.filter(function(pl) { return playlistPanelProvider(pl) !== 'qq'; }) },
    { label: 'QQ 音乐歌单', items: playlists.filter(function(pl) { return playlistPanelProvider(pl) === 'qq'; }) },
  ];
  var html = groups.map(function(group) {
    var items = visibleGroupItems(group.items);
    if (!items.length) return '';
    return '<div class="pl-section-label">' + group.label + '</div>' + items.map(function(pl) {
      return renderPlaylistPanelCardHtml(pl, deps);
    }).join('');
  }).join('') || playlistPanelEmptyHtml();
  return { html: html, renderedCount: renderedCount };
}

var MineradioPlaylistPanel = {
  playlistPanelProvider: playlistPanelProvider,
  playlistPanelKey: playlistPanelKey,
  playlistPanelProviderId: playlistPanelProviderId,
  playlistPanelCoverUrl: playlistPanelCoverUrl,
  playlistPanelEmptyHtml: playlistPanelEmptyHtml,
  renderPlaylistPanelCardHtml: renderPlaylistPanelCardHtml,
  renderPlaylistPanelListHtml: renderPlaylistPanelListHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioPlaylistPanel = MineradioPlaylistPanel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioPlaylistPanel;
}
