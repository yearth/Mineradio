const test = require('node:test');
const assert = require('node:assert/strict');

const {
  renderPodcastThumbHtml,
  renderPodcastRadioItemsHtml,
  renderPodcastNoProgramsHtml,
  renderPodcastProgramsHtml,
  renderMyPodcastCollectionsHtml,
  renderMyPodcastRadioItemsHtml,
} = require('../public/renderer/core/podcast-results');

function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function deps(overrides = {}) {
  return Object.assign({
    escHtml,
    coverUrlWithSize(src, size) {
      assert.equal(size, 80);
      return `${src}?size=${size}`;
    },
    podcastMetaText(item) {
      return item && item.meta ? item.meta : '';
    },
    programMetaText(item) {
      return item && item.meta ? item.meta : '';
    },
  }, overrides);
}

test('podcast thumb markup preserves cover sizing and fallback', () => {
  assert.equal(
    renderPodcastThumbHtml('https://img.example/p.jpg', deps()),
    '<img src="https://img.example/p.jpg?size=80" alt="" loading="lazy" onerror="this.style.opacity=0.2">'
  );
  assert.equal(
    renderPodcastThumbHtml('', deps()),
    '<div style="width:40px;height:40px;border-radius:6px;background:rgba(255,255,255,0.06);flex-shrink:0"></div>'
  );
});

test('podcast radio list markup preserves open handlers, labels, and escaping', () => {
  const html = renderPodcastRadioItemsHtml([
    { name: 'Talk <One>', cover: 'https://img.example/talk.jpg', meta: 'DJ & 12 episodes' },
    { name: 'No Meta', cover: '' },
  ], 'Hot podcasts', deps());

  assert.match(html, /^<div class="search-result">/);
  assert.match(html, /onclick="openPodcastPrograms\(0\)"/);
  assert.match(html, /<img src="https:\/\/img\.example\/talk\.jpg\?size=80" alt="" loading="lazy" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="search-result-title">Talk &lt;One&gt;<span class="tag-podcast">Podcast<\/span><\/div>/);
  assert.match(html, /<div class="search-result-meta">DJ &amp; 12 episodes<\/div>/);
  assert.match(html, /<button class="add-btn" title="Open" onclick="event\.stopPropagation\(\);openPodcastPrograms\(0\)">›<\/button>/);
  assert.match(html, /onclick="openPodcastPrograms\(1\)"/);
  assert.match(html, /<div class="search-result-meta">Hot podcasts<\/div>/);
});

test('podcast empty program markup preserves back handler and fallback title', () => {
  assert.equal(
    renderPodcastNoProgramsHtml({ name: 'Radio & <One>' }, deps()),
    '<div class="podcast-result-head"><button class="podcast-back-btn" onclick="event.stopPropagation();renderPodcastRadios(podcastResults)">‹</button><div class="search-result-info"><div class="search-result-title">Radio &amp; &lt;One&gt;</div><div class="search-result-meta">No playable episodes</div></div></div>'
  );
});

test('podcast program list markup preserves header, playback handlers, and escaping', () => {
  const html = renderPodcastProgramsHtml({
    name: 'Radio "One"',
    cover: 'https://img.example/radio.jpg',
    djName: 'DJ > Host',
  }, [
    { name: 'Episode & One', cover: 'https://img.example/ep.jpg', meta: '12:30' },
    { name: 'No Cover', meta: '' },
  ], deps());

  assert.match(html, /^<div class="podcast-result-head">/);
  assert.match(html, /<button class="podcast-back-btn" onclick="event\.stopPropagation\(\);renderPodcastRadios\(podcastResults\)">‹<\/button>/);
  assert.match(html, /<div class="search-result-title">Radio "One"<span class="tag-podcast">Podcast<\/span><\/div><div class="search-result-meta">DJ &gt; Host<\/div>/);
  assert.match(html, /onclick="playPodcastProgram\(0\)"/);
  assert.match(html, /<div class="search-result-title">Episode &amp; One<\/div>/);
  assert.match(html, /<div class="search-result-meta">12:30<\/div>/);
  assert.match(html, /<button class="add-btn" title="下一首播放" onclick="event\.stopPropagation\(\);queuePodcastProgram\(0\)">\+<\/button>/);
  assert.match(html, /onclick="playPodcastProgram\(1\)"/);
});

test('podcast markup escapes text with default dependencies', () => {
  const html = renderPodcastProgramsHtml({ name: 'A "quote" & <tag>' }, [
    { name: 'B > C' },
  ]);

  assert.match(html, /A &quot;quote&quot; &amp; &lt;tag&gt;/);
  assert.match(html, /B &gt; C/);
  assert.match(html, /1 episodes/);
});

test('my podcast collection markup preserves cards, cover sizing, data attributes, and escaping', () => {
  const html = renderMyPodcastCollectionsHtml([
    { key: 'liked', title: 'Liked <Shows>', count: 2, sub: 'Voice & Radio', cover: 'https://img.example/liked.jpg' },
    { key: 'empty', title: 'No Cover', count: 0, sub: '' },
  ], deps({
    coverUrlWithSize(src, size) {
      assert.equal(size, 88);
      return `${src}?size=${size}`;
    },
  }));

  assert.match(html, /^<div class="pl-card podcast-card" data-podcast-key="liked" data-podcast-title="Liked &lt;Shows&gt;">/);
  assert.match(html, /<img src="https:\/\/img\.example\/liked\.jpg\?size=88" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-name">Liked &lt;Shows&gt;<\/div>/);
  assert.match(html, /<div class="pl-sub">2 项 · Voice &amp; Radio<\/div>/);
  assert.match(html, /data-podcast-key="empty"/);
  assert.match(html, /<div style="width:44px;height:44px;border-radius:8px;background:rgba\(0,245,212,\.07\);flex-shrink:0"><\/div>/);
});

test('my podcast radio item markup preserves header, back button, radio cards, and empty fallback', () => {
  const html = renderMyPodcastRadioItemsHtml('Collection & <One>', [
    { id: 7, name: 'Radio <One>', djName: 'DJ & Host', programCount: 12, cover: 'https://img.example/radio.jpg' },
    { radioId: 'fallback', name: 'Fallback', artist: 'Artist', programCount: 0 },
  ], deps({
    coverUrlWithSize(src, size) {
      assert.equal(size, 88);
      return `${src}?size=${size}`;
    },
  }));

  assert.match(html, /^<div class="podcast-inline-head"><div class="pl-section-label">Collection &amp; &lt;One&gt;<\/div><button class="fx-mini-btn ghost" data-podcast-back="1" style="height:24px;padding:0 9px;font-size:10.5px">返回<\/button><\/div>/);
  assert.match(html, /class="pl-card podcast-card podcast-child" data-podcast-radio-id="7" data-podcast-title="Radio &lt;One&gt;"/);
  assert.match(html, /<img src="https:\/\/img\.example\/radio\.jpg\?size=88" alt="" loading="lazy" decoding="async" onerror="this\.style\.opacity=0\.2">/);
  assert.match(html, /<div class="pl-sub">DJ &amp; Host · 12 集<\/div>/);
  assert.match(html, /data-podcast-radio-id="fallback"/);
  assert.match(html, /<div class="pl-sub">Artist<\/div>/);

  const empty = renderMyPodcastRadioItemsHtml('', [], deps());
  assert.equal(
    empty,
    '<div class="podcast-inline-head"><div class="pl-section-label">我的播客</div><button class="fx-mini-btn ghost" data-podcast-back="1" style="height:24px;padding:0 9px;font-size:10.5px">返回</button></div><div style="text-align:center;padding:14px 0;color:rgba(255,255,255,.28);font-size:11.5px">暂无内容</div>'
  );
});
