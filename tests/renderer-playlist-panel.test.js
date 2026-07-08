const test = require('node:test');
const assert = require('node:assert/strict');

const {
  playlistPanelProvider,
  playlistPanelKey,
  playlistPanelProviderId,
  playlistPanelCoverUrl,
  renderPlaylistPanelCardHtml,
  renderPlaylistPanelDetailHtml,
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

test('playlist panel detail markup preserves inactive and loading states', () => {
  assert.equal(renderPlaylistPanelDetailHtml({
    id: 'n1',
    name: 'List',
  }, 'netease', { key: 'qq:q1' }, {
    initialRender: 2,
    songCoverSrc() {
      throw new Error('songCoverSrc should not run for inactive details');
    },
  }), '');

  const html = renderPlaylistPanelDetailHtml({
    id: 'n1',
    name: 'Loading <List>',
    creator: 'DJ & Co',
    trackCount: 12,
    cover: 'https://ne.example/cover.jpg',
  }, 'netease', {
    key: 'netease:n1',
    loading: true,
    tracks: [{ name: 'Hidden' }],
    renderLimit: 2,
  }, {
    escHtml,
    initialRender: 2,
    songCoverSrc() {
      return '';
    },
  });

  assert.match(html, /^<div class="pl-inline-detail" data-pl-detail="netease:n1">/);
  assert.match(html, /<img class="pl-detail-cover" src="https:\/\/ne\.example\/cover\.jpg\?param=96y96" alt="" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-detail-title">Loading &lt;List&gt;<\/div>/);
  assert.match(html, /<div class="pl-detail-sub">12 首 · DJ &amp; Co<\/div>/);
  assert.match(html, /<div class="pl-detail-count">载入中<\/div>/);
  assert.match(html, /<div class="pl-detail-row-title">正在载入歌单<\/div>/);
  assert.match(html, /<div class="pl-detail-row-artist">请稍候<\/div>/);
});

test('playlist panel detail markup preserves rows, load-more, progress, empty state, and defaults', () => {
  const tracks = [
    { name: 'Song <One>', artist: 'Artist & One', cover: 'cover-1' },
    { name: 'Song Two', artist: '', cover: '' },
    { name: 'Song Three', artist: 'Artist Three', cover: 'cover-3' },
  ];
  const html = renderPlaylistPanelDetailHtml({
    id: 'q1',
    provider: 'qq',
    name: 'QQ "List"',
    cover: 'https://qq.example/cover.jpg',
  }, 'qq', {
    key: 'qq:q1',
    loading: false,
    tracks,
    renderLimit: 2,
  }, {
    escHtml,
    initialRender: 2,
    songCoverSrc(song, size) {
      assert.equal(size, 60);
      return song.cover ? `https://img.example/${song.cover}.jpg` : '';
    },
  });

  assert.match(html, /^<div class="pl-inline-detail" data-pl-detail="qq:q1">/);
  assert.match(html, /<img class="pl-detail-cover" src="https:\/\/qq\.example\/cover\.jpg" alt="" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-detail-title">QQ "List"<\/div>/);
  assert.match(html, /<div class="pl-detail-sub">3 首 · QQ 音乐<\/div>/);
  assert.match(html, /<div class="pl-detail-count">2\/3<\/div>/);
  assert.match(html, /<div class="pl-detail-row" data-pl-detail-row="0">/);
  assert.match(html, /<img src="https:\/\/img\.example\/cover-1\.jpg" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-detail-row-title">Song &lt;One&gt;<\/div>/);
  assert.match(html, /<button type="button" class="pl-detail-row-artist" data-pl-detail-artist="0">Artist &amp; One<\/button>/);
  assert.match(html, /<button type="button" class="pl-detail-row-artist" data-pl-detail-artist="1">未知歌手<\/button>/);
  assert.doesNotMatch(html, /data-pl-detail-row="2"/);
  assert.match(html, /<button type="button" class="fx-mini-btn ghost pl-detail-load-more" data-pl-detail-load-more="1">加载更多 2\/3<\/button>/);

  const complete = renderPlaylistPanelDetailHtml({ id: 'q1' }, 'qq', {
    key: 'qq:q1',
    loading: false,
    tracks,
    renderLimit: 3,
  }, {
    escHtml,
    initialRender: 2,
    songCoverSrc() {
      return '';
    },
  });
  assert.match(complete, /<div class="pl-detail-progress">已显示全部 3 首<\/div>/);

  const empty = renderPlaylistPanelDetailHtml({ id: 'q1' }, 'qq', {
    key: 'qq:q1',
    loading: false,
    tracks: [],
    renderLimit: 2,
  }, {
    escHtml,
    initialRender: 2,
    songCoverSrc() {
      return '';
    },
  });
  assert.match(empty, /歌单暂无可播放歌曲/);

  const defaultEscaped = renderPlaylistPanelDetailHtml({
    id: '1',
    name: 'A "quote" & <tag>',
    creator: 'B > C',
  }, 'netease', {
    key: 'netease:1',
    loading: false,
    tracks: [{ name: 'Track <A>', artist: 'Artist > B' }],
    renderLimit: 64,
  });
  assert.match(defaultEscaped, /A &quot;quote&quot; &amp; &lt;tag&gt;/);
  assert.match(defaultEscaped, /Artist &gt; B/);
});
