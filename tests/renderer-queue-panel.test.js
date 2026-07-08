const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderQueuePanelEmptyHtml,
  renderQueuePanelItemsHtml,
} = require('../public/renderer/core/queue-panel');

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deps(overrides = {}) {
  return Object.assign({
    escHtml,
    songCoverSrc(song, size) {
      assert.equal(size, 60);
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

test('queue panel empty markup preserves the current empty-state copy', () => {
  assert.equal(
    renderQueuePanelEmptyHtml(),
    '<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.32);font-size:11.5px">队列为空，搜索后点 + 设为下一首</div>'
  );
});

test('queue panel item markup preserves current item, cover fallback, handlers, and escaping', () => {
  const html = renderQueuePanelItemsHtml([
    { name: 'Rain <One>', artist: 'Artist & Friend', cover: 'https://img.example/rain.jpg', liked: true },
    { name: 'No Cover', artist: '' },
  ], 0, deps());

  assert.match(html, /^<div class="queue-item now" onclick="playQueueAt\(0\)">/);
  assert.match(html, /<img src="https:\/\/img\.example\/rain\.jpg" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="qi-name">Rain &lt;One&gt;<\/div>/);
  assert.match(html, /<button class="queue-artist-link" type="button" onclick="event\.stopPropagation\(\);openQueueArtist\(0\)">Artist &amp; Friend<\/button>/);
  assert.match(html, /<button class="liked" onclick="event\.stopPropagation\(\);toggleLikeQueueIndex\(0\)" title="取消红心"><svg class="heart"><\/svg><\/button>/);
  assert.match(html, /<button class="queue-next" onclick="event\.stopPropagation\(\);queueIndexNext\(0\)" title="下一首播放">下<\/button>/);
  assert.match(html, /<button onclick="event\.stopPropagation\(\);collectQueueIndex\(0\)" title="收藏到歌单"><svg class="plus"><\/svg><\/button>/);
  assert.match(html, /<button onclick="event\.stopPropagation\(\);removeFromQueue\(0\)" title="移除">×<\/button>/);
  assert.match(html, /class="queue-item" onclick="playQueueAt\(1\)"/);
  assert.match(html, /<button class="queue-artist-link" type="button" onclick="event\.stopPropagation\(\);openQueueArtist\(1\)">未知歌手<\/button>/);
  assert.match(html, /width:38px;height:38px;border-radius:6px;background:rgba\(255,255,255,\.06\);flex-shrink:0/);
  assert.match(html, /title="红心喜欢"/);
});

test('queue panel item markup escapes text with default dependencies', () => {
  const html = renderQueuePanelItemsHtml([
    { name: 'A "quote" & <tag>', artist: 'B > C' },
  ], 0);

  assert.match(html, /A &quot;quote&quot; &amp; &lt;tag&gt;/);
  assert.match(html, /B &gt; C/);
  assert.match(html, /title="红心喜欢"><\/button>/);
});
