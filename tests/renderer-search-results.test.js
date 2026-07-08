const test = require('node:test');
const assert = require('node:assert/strict');

const {
  songSourceTagHtml,
  searchResultMetaText,
  searchResultMetaHtml,
  renderSongSearchResultItemHtml,
  renderSongSearchResultsHtml,
} = require('../public/renderer/core/search-results');

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deps(overrides = {}) {
  return Object.assign({
    escHtml,
    songProviderKey(song) {
      return song && song.provider === 'qq' ? 'qq' : 'netease';
    },
    songSourceLabel(song) {
      return song && song.provider === 'qq' ? 'QQ 音乐' : '网易云';
    },
    songCoverSrc(song, size) {
      assert.equal(size, 80);
      return song && song.cover ? song.cover : '';
    },
    heartIconSvg() {
      return '<svg class="heart"></svg>';
    },
    playlistPlusIconSvg() {
      return '<svg class="plus"></svg>';
    },
    isSongLiked(song) {
      return !!(song && song.liked);
    },
  }, overrides);
}

test('search result source and metadata helpers preserve provider labels and artist links', () => {
  const qqSong = { provider: 'qq', artist: 'Jay & Co', album: 'Album <One>', playable: false };
  const neteaseSong = { artist: '', album: '' };

  assert.equal(songSourceTagHtml(qqSong, deps()), '<span class="tag-source qq">QQ</span>');
  assert.equal(songSourceTagHtml(neteaseSong, deps()), '<span class="tag-source netease">NE</span>');
  assert.equal(searchResultMetaText(qqSong, deps()), 'Jay & Co  ·  Album <One>  ·  QQ 播放需会话/授权');
  assert.equal(searchResultMetaText(neteaseSong, deps()), '网易云');
  assert.equal(
    searchResultMetaHtml(qqSong, 3, deps()),
    '<button class="search-artist-link" type="button" onclick="event.stopPropagation();openSearchResultArtist(3)">Jay &amp; Co</button> · Album &lt;One&gt;  ·  QQ 播放需会话/授权'
  );
  assert.equal(searchResultMetaHtml(neteaseSong, 2, deps()), '网易云');
});

test('search result item markup preserves cover fallback, tags, actions, and escaping', () => {
  const html = renderSongSearchResultItemHtml({
    name: 'Rain <One>',
    artist: 'Artist',
    album: 'Album',
    provider: 'qq',
    fee: 1,
    liked: true,
    cover: 'https://img.example/rain.jpg',
  }, 4, deps());

  assert.match(html, /^<div class="search-result qq-source">/);
  assert.match(html, /onclick="playSearchResult\(4\)"/);
  assert.match(html, /<img src="https:\/\/img\.example\/rain\.jpg" alt="" loading="lazy" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="search-result-title">Rain &lt;One&gt;<span class="tag-source qq">QQ<\/span><span class="tag-vip">VIP<\/span><\/div>/);
  assert.match(html, /class="song-action-btn liked" data-like-index="4" title="取消红心" onclick="event\.stopPropagation\(\);toggleLikeSearchResult\(4\)">/);
  assert.match(html, /<button class="song-action-btn" title="收藏到歌单" onclick="event\.stopPropagation\(\);collectSearchResult\(4\)">/);
  assert.match(html, /<button class="add-btn" title="下一首播放" onclick="event\.stopPropagation\(\);queueSearchResult\(4\)">\+<\/button>/);
});

test('search result list markup joins rows and falls back when covers are missing', () => {
  const html = renderSongSearchResultsHtml([
    { name: 'A', artist: 'One' },
    { name: 'B', artist: '', liked: false },
  ], deps());

  assert.equal((html.match(/class="search-result netease-source"/g) || []).length, 2);
  assert.match(html, /playSearchResult\(0\)/);
  assert.match(html, /playSearchResult\(1\)/);
  assert.match(html, /width:40px;height:40px;border-radius:6px;background:rgba\(255,255,255,0\.06\);flex-shrink:0/);
  assert.match(html, /title="红心喜欢"/);
});

test('search result markup escapes text and labels providers with default dependencies', () => {
  const qqHtml = renderSongSearchResultItemHtml({
    name: 'A "quote" & <tag>',
    artist: 'Artist > One',
    source: 'qq',
    playable: false,
  }, 0);

  assert.match(qqHtml, /<div class="search-result-title">A &quot;quote&quot; &amp; &lt;tag&gt;<span class="tag-source qq">QQ<\/span><\/div>/);
  assert.match(qqHtml, /<button class="search-artist-link" type="button" onclick="event\.stopPropagation\(\);openSearchResultArtist\(0\)">Artist &gt; One<\/button> · QQ 播放需会话\/授权/);
  assert.match(qqHtml, /class="song-action-btn" data-like-index="0" title="红心喜欢"/);
  assert.equal(searchResultMetaText({}), '网易云');
  assert.equal(searchResultMetaText({ type: 'qq', playable: true }), 'QQ 音乐');
});
