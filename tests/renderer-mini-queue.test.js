const test = require('node:test');
const assert = require('node:assert/strict');

const {
  miniQueueCountText,
  renderMiniQueueEmptyHtml,
  renderMiniQueueItemsHtml,
} = require('../public/renderer/core/mini-queue');

test('mini queue count text preserves empty and current index labels', () => {
  assert.equal(miniQueueCountText([], -1), '0 首');
  assert.equal(miniQueueCountText([{ name: 'A' }, { name: 'B' }], -1), '2 首');
  assert.equal(miniQueueCountText([{ name: 'A' }, { name: 'B' }], 1), '2 首 · 正在播放 2');
});

test('mini queue empty markup preserves the current empty-state copy', () => {
  assert.equal(renderMiniQueueEmptyHtml(), '<div class="mini-queue-empty">队列为空，先搜索或打开歌单</div>');
});

test('mini queue item markup preserves current item, cover fallback, handlers, and escaping', () => {
  const songs = [
    { name: 'Rain <One>', artist: 'Artist & Friend', cover: 'https://img.example/rain.jpg' },
    { name: 'No Cover', artist: '' },
  ];
  const html = renderMiniQueueItemsHtml(songs, 0, {
    songCoverSrc(song, size) {
      assert.equal(size, 60);
      return song.cover || '';
    },
    escHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
  });

  assert.match(html, /class="mini-queue-item now" onclick="playQueueAt\(0\)"/);
  assert.match(html, /<img src="https:\/\/img\.example\/rain\.jpg" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="mini-queue-name">Rain &lt;One&gt;<\/div>/);
  assert.match(html, /<div class="mini-queue-sub">Artist &amp; Friend<\/div>/);
  assert.match(html, /class="mini-queue-remove mini-queue-next" onclick="event\.stopPropagation\(\);queueIndexNext\(0\)" title="下一首播放">下<\/button>/);
  assert.match(html, /class="mini-queue-remove" onclick="event\.stopPropagation\(\);removeFromQueue\(0\)" title="移除">×<\/button>/);
  assert.match(html, /class="mini-queue-item" onclick="playQueueAt\(1\)"/);
  assert.match(html, /<div class="mini-queue-cover"><\/div>/);
});

test('mini queue item markup escapes text with default dependencies', () => {
  const html = renderMiniQueueItemsHtml([
    { name: 'A "quote" & <tag>', artist: 'B > C' },
  ], 0);

  assert.match(html, /A &quot;quote&quot; &amp; &lt;tag&gt;/);
  assert.match(html, /B &gt; C/);
  assert.match(html, /<div class="mini-queue-cover"><\/div>/);
});
