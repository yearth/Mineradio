'use strict';

function fallbackEscHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function defaultSongProviderKey(song) {
  if (song && (song.provider === 'qq' || song.source === 'qq' || song.type === 'qq')) return 'qq';
  return 'netease';
}

function defaultSongSourceLabel(song) {
  return defaultSongProviderKey(song) === 'qq' ? 'QQ 音乐' : '网易云';
}

function createDeps(deps) {
  deps = deps || {};
  return {
    escHtml: deps.escHtml || fallbackEscHtml,
    songProviderKey: deps.songProviderKey || defaultSongProviderKey,
    songSourceLabel: deps.songSourceLabel || defaultSongSourceLabel,
    songCoverSrc: deps.songCoverSrc || function() { return ''; },
    heartIconSvg: deps.heartIconSvg || function() { return ''; },
    playlistPlusIconSvg: deps.playlistPlusIconSvg || function() { return ''; },
    isSongLiked: deps.isSongLiked || function() { return false; },
  };
}

function songSourceTagHtml(song, deps) {
  deps = createDeps(deps);
  var key = deps.songProviderKey(song);
  var label = key === 'qq' ? 'QQ' : 'NE';
  return '<span class="tag-source ' + key + '">' + label + '</span>';
}

function searchResultMetaText(song, deps) {
  deps = createDeps(deps);
  song = song || {};
  var bits = [];
  if (song.artist) bits.push(song.artist);
  if (song.album) bits.push(song.album);
  if (deps.songProviderKey(song) === 'qq' && !song.playable) bits.push('QQ 播放需会话/授权');
  return bits.join('  ·  ') || deps.songSourceLabel(song);
}

function searchResultMetaHtml(song, index, deps) {
  deps = createDeps(deps);
  song = song || {};
  var artist = String(song.artist || '').trim();
  var bits = [];
  if (song.album) bits.push(song.album);
  if (deps.songProviderKey(song) === 'qq' && !song.playable) bits.push('QQ 播放需会话/授权');
  var tail = bits.length ? (' · ' + deps.escHtml(bits.join('  ·  '))) : '';
  if (!artist) return deps.escHtml(searchResultMetaText(song, deps));
  return '<button class="search-artist-link" type="button" onclick="event.stopPropagation();openSearchResultArtist(' + index + ')">' + deps.escHtml(artist) + '</button>' + tail;
}

function renderSongSearchResultItemHtml(song, index, deps) {
  deps = createDeps(deps);
  song = song || {};
  var vipTag = (song.fee === 1) ? '<span class="tag-vip">VIP</span>' : '';
  var sourceTag = songSourceTagHtml(song, deps);
  var sourceClass = deps.songProviderKey(song) + '-source';
  var thumb = deps.songCoverSrc(song, 80);
  var imgTag = thumb
    ? '<img src="' + thumb + '" alt="" loading="lazy" onerror="this.style.opacity=0.2">'
    : '<div style="width:40px;height:40px;border-radius:6px;background:rgba(255,255,255,0.06);flex-shrink:0"></div>';
  var liked = deps.isSongLiked(song);
  return '<div class="search-result ' + sourceClass + '">' +
    '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0" onclick="playSearchResult(' + index + ')">' +
      imgTag +
      '<div class="search-result-info">' +
        '<div class="search-result-title">' + deps.escHtml(song.name) + sourceTag + vipTag + '</div>' +
        '<div class="search-result-meta">' + searchResultMetaHtml(song, index, deps) + '</div>' +
      '</div>' +
    '</div>' +
    '<button class="song-action-btn' + (liked ? ' liked' : '') + '" data-like-index="' + index + '" title="' + (liked ? '取消红心' : '红心喜欢') + '" onclick="event.stopPropagation();toggleLikeSearchResult(' + index + ')">' + deps.heartIconSvg() + '</button>' +
    '<button class="song-action-btn" title="收藏到歌单" onclick="event.stopPropagation();collectSearchResult(' + index + ')">' + deps.playlistPlusIconSvg() + '</button>' +
    '<button class="add-btn" title="下一首播放" onclick="event.stopPropagation();queueSearchResult(' + index + ')">+</button>' +
  '</div>';
}

function renderSongSearchResultsHtml(songs, deps) {
  return (songs || []).map(function(song, index) {
    return renderSongSearchResultItemHtml(song, index, deps);
  }).join('');
}

var MineradioSearchResults = {
  songSourceTagHtml: songSourceTagHtml,
  searchResultMetaText: searchResultMetaText,
  searchResultMetaHtml: searchResultMetaHtml,
  renderSongSearchResultItemHtml: renderSongSearchResultItemHtml,
  renderSongSearchResultsHtml: renderSongSearchResultsHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioSearchResults = MineradioSearchResults;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioSearchResults;
}
