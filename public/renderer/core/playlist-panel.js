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
    songCoverSrc: deps.songCoverSrc || function() { return ''; },
    activeKey: deps.activeKey || '',
    initialRender: deps.initialRender || 64,
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

function playlistPanelDetailCoverUrl(pl, provider) {
  if (!pl || !pl.cover) return '';
  return provider === 'qq' ? pl.cover : (pl.cover + '?param=96y96');
}

function renderPlaylistPanelDetailRowsHtml(tracks, renderLimit, deps) {
  deps = createDeps(deps);
  return tracks.slice(0, renderLimit).map(function(song, i) {
    song = song || {};
    var thumb = deps.songCoverSrc(song, 60);
    var imgTag = thumb
      ? '<img src="' + deps.escHtml(thumb) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">'
      : '<div style="width:34px;height:34px;border-radius:7px;background:rgba(255,255,255,.06);flex:0 0 auto"></div>';
    return '<div class="pl-detail-row" data-pl-detail-row="' + i + '">' +
      imgTag +
      '<div style="flex:1;min-width:0"><div class="pl-detail-row-title">' + deps.escHtml(song.name || '') + '</div>' +
      '<button type="button" class="pl-detail-row-artist" data-pl-detail-artist="' + i + '">' + deps.escHtml(song.artist || '未知歌手') + '</button></div>' +
    '</div>';
  }).join('');
}

function renderPlaylistPanelDetailHtml(pl, provider, state, deps) {
  deps = createDeps(deps);
  pl = pl || {};
  state = state || {};
  provider = provider === 'qq' ? 'qq' : 'netease';
  var key = playlistPanelKey(provider, pl && pl.id);
  if (state.key !== key) return '';
  var tracks = state.tracks || [];
  var loading = state.loading;
  var cover = playlistPanelDetailCoverUrl(pl, provider);
  var img = cover
    ? '<img class="pl-detail-cover" src="' + deps.escHtml(cover) + '" alt="" decoding="async" onerror="this.style.opacity=0.2">'
    : '<div class="pl-detail-cover"></div>';
  var renderLimit = loading ? 0 : Math.max(deps.initialRender, state.renderLimit || deps.initialRender);
  renderLimit = Math.min(tracks.length, renderLimit);
  var rows = loading
    ? '<div class="pl-detail-row"><div style="width:34px;height:34px;border-radius:7px;background:rgba(255,255,255,.06)"></div><div style="flex:1;min-width:0"><div class="pl-detail-row-title">正在载入歌单</div><div class="pl-detail-row-artist">请稍候</div></div></div>'
    : renderPlaylistPanelDetailRowsHtml(tracks, renderLimit, deps);
  if (!loading && !rows) rows = '<div style="text-align:center;padding:14px 0;color:rgba(255,255,255,.30);font-size:11.5px">歌单暂无可播放歌曲</div>';
  if (!loading && tracks.length > renderLimit) {
    rows += '<button type="button" class="fx-mini-btn ghost pl-detail-load-more" data-pl-detail-load-more="1">加载更多 ' + renderLimit + '/' + tracks.length + '</button>';
  } else if (!loading && tracks.length > deps.initialRender) {
    rows += '<div class="pl-detail-progress">已显示全部 ' + tracks.length + ' 首</div>';
  }
  return '<div class="pl-inline-detail" data-pl-detail="' + deps.escHtml(key) + '">' +
    '<div class="pl-detail-sticky">' +
      '<div class="pl-detail-head">' + img + '<div style="flex:1;min-width:0"><div class="pl-detail-title">' + deps.escHtml(pl.name || '歌单详情') + '</div><div class="pl-detail-sub">' + deps.escHtml((pl.trackCount || tracks.length || 0) + ' 首 · ' + (pl.creator || (provider === 'qq' ? 'QQ 音乐' : '网易云音乐'))) + '</div></div><div class="pl-detail-count">' + (loading ? '载入中' : (renderLimit + '/' + tracks.length)) + '</div></div>' +
      '<div class="pl-detail-actions"><button class="pl-detail-play" type="button" data-pl-detail-play="' + deps.escHtml(key) + '"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>播放歌单</button><button class="fx-mini-btn ghost pl-detail-top-btn" type="button" data-pl-detail-top="1">回到顶部</button></div>' +
    '</div>' +
    '<div class="pl-detail-list">' + rows + '</div>' +
  '</div>';
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

function closestFromPlaylistPanelClick(event, selector) {
  var target = event && event.target;
  return target && target.closest ? target.closest(selector) : null;
}

function blockPlaylistPanelClick(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (event && event.stopPropagation) event.stopPropagation();
}

function resolvePlaylistPanelClickAction(event) {
  var loadMore = closestFromPlaylistPanelClick(event, '[data-pl-load-more]');
  if (loadMore) {
    blockPlaylistPanelClick(event);
    return { type: 'playlist-load-more' };
  }
  var detailLoadMore = closestFromPlaylistPanelClick(event, '[data-pl-detail-load-more]');
  if (detailLoadMore) {
    blockPlaylistPanelClick(event);
    return { type: 'detail-load-more' };
  }
  var detailTop = closestFromPlaylistPanelClick(event, '[data-pl-detail-top]');
  if (detailTop) {
    blockPlaylistPanelClick(event);
    return { type: 'detail-top' };
  }
  var playDetail = closestFromPlaylistPanelClick(event, '[data-pl-detail-play]');
  if (playDetail) {
    blockPlaylistPanelClick(event);
    return { type: 'detail-play' };
  }
  var artist = closestFromPlaylistPanelClick(event, '[data-pl-detail-artist]');
  if (artist) {
    blockPlaylistPanelClick(event);
    return { type: 'detail-artist', index: Number(artist.getAttribute('data-pl-detail-artist')) };
  }
  var row = closestFromPlaylistPanelClick(event, '[data-pl-detail-row]');
  if (row) {
    blockPlaylistPanelClick(event);
    return { type: 'detail-row', index: Number(row.getAttribute('data-pl-detail-row')) };
  }
  var card = closestFromPlaylistPanelClick(event, '.pl-card');
  if (!card) return null;
  return {
    type: 'playlist-card',
    provider: card.getAttribute('data-playlist-provider') || 'netease',
    playlistId: card.getAttribute('data-playlist-id') || '',
    title: card.getAttribute('data-playlist-title') || '',
  };
}

var MineradioPlaylistPanel = {
  playlistPanelProvider: playlistPanelProvider,
  playlistPanelKey: playlistPanelKey,
  playlistPanelProviderId: playlistPanelProviderId,
  playlistPanelCoverUrl: playlistPanelCoverUrl,
  playlistPanelDetailCoverUrl: playlistPanelDetailCoverUrl,
  playlistPanelEmptyHtml: playlistPanelEmptyHtml,
  resolvePlaylistPanelClickAction: resolvePlaylistPanelClickAction,
  renderPlaylistPanelCardHtml: renderPlaylistPanelCardHtml,
  renderPlaylistPanelDetailRowsHtml: renderPlaylistPanelDetailRowsHtml,
  renderPlaylistPanelDetailHtml: renderPlaylistPanelDetailHtml,
  renderPlaylistPanelListHtml: renderPlaylistPanelListHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioPlaylistPanel = MineradioPlaylistPanel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioPlaylistPanel;
}
