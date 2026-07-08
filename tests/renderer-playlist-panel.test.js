const test = require('node:test');
const assert = require('node:assert/strict');

const {
  playlistPanelProvider,
  playlistPanelKey,
  playlistPanelProviderId,
  playlistPanelCoverUrl,
  renderPlaylistPanelCardHtml,
  renderPlaylistPanelListHtml,
} = require('../public/renderer/core/playlist-panel');

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deps(overrides = {}) {
  return Object.assign({
    escHtml,
    detailHtml(pl, provider) {
      return `<detail provider="${provider}" id="${pl.id}"></detail>`;
    },
    activeKey: 'qq:q1',
  }, overrides);
}

test('playlist panel provider, key, and cover helpers preserve source rules', () => {
  assert.equal(playlistPanelProvider({ provider: 'qq' }), 'qq');
  assert.equal(playlistPanelProvider({ provider: 'netease' }), 'netease');
  assert.equal(playlistPanelProvider(null), 'netease');
  assert.equal(playlistPanelKey('qq', '42'), 'qq:42');
  assert.equal(playlistPanelKey('netease', '42'), 'netease:42');
  assert.equal(playlistPanelProviderId('qq', '42'), 'qq:42');
  assert.equal(playlistPanelProviderId('netease', '42'), '42');
  assert.equal(playlistPanelCoverUrl({ provider: 'qq', cover: 'https://qq.example/c.jpg' }), 'https://qq.example/c.jpg');
  assert.equal(playlistPanelCoverUrl({ provider: 'netease', cover: 'https://ne.example/c.jpg' }), 'https://ne.example/c.jpg?param=88y88');
  assert.equal(playlistPanelCoverUrl({}), '');
});

test('playlist panel card markup preserves provider badges, data attributes, covers, and detail injection', () => {
  const html = renderPlaylistPanelCardHtml({
    id: 'q1',
    provider: 'qq',
    name: 'QQ <List>',
    creator: 'DJ & Co',
    trackCount: 12,
    cover: 'https://qq.example/c.jpg',
  }, deps());

  assert.match(html, /^<div class="pl-card expanded" data-playlist-provider="qq" data-playlist-id="q1" data-playlist-title="QQ &lt;List&gt;">/);
  assert.match(html, /<img src="https:\/\/qq\.example\/c\.jpg" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-name">QQ &lt;List&gt;<span class="tag-source qq" style="margin-left:6px;vertical-align:1px">QQ<\/span><\/div>/);
  assert.match(html, /<div class="pl-sub">12 首 · DJ &amp; Co<\/div>/);
  assert.match(html, /<detail provider="qq" id="q1"><\/detail>$/);
});

test('playlist panel list markup groups providers, respects render limit, and reports rendered count', () => {
  const result = renderPlaylistPanelListHtml([
    { id: 'n1', name: 'NE One', provider: 'netease', trackCount: 2, creator: 'A' },
    { id: 'q1', name: 'QQ One', provider: 'qq', trackCount: 3, creator: 'B' },
    { id: 'q2', name: 'QQ Two', provider: 'qq', trackCount: 4, creator: 'C' },
  ], 2, deps());

  assert.equal(result.renderedCount, 2);
  assert.match(result.html, /^<div class="pl-section-label">网易云歌单<\/div>/);
  assert.match(result.html, /data-playlist-id="n1"/);
  assert.match(result.html, /<div class="pl-section-label">QQ 音乐歌单<\/div>/);
  assert.match(result.html, /data-playlist-id="q1"/);
  assert.doesNotMatch(result.html, /data-playlist-id="q2"/);
});

test('playlist panel list markup preserves empty fallback and default escaping', () => {
  const result = renderPlaylistPanelListHtml([], 8);
  assert.equal(result.renderedCount, 0);
  assert.equal(result.html, '<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.32);font-size:11.5px">未找到歌单</div>');

  const card = renderPlaylistPanelCardHtml({ id: '1', name: 'A "quote" & <tag>', creator: 'B > C' });
  assert.match(card, /A &quot;quote&quot; &amp; &lt;tag&gt;/);
  assert.match(card, /B &gt; C/);
});
