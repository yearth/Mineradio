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
    coverUrlWithSize: deps.coverUrlWithSize || function(src) { return src; },
    podcastMetaText: deps.podcastMetaText || function() { return ''; },
    programMetaText: deps.programMetaText || function() { return ''; },
  };
}

function renderPodcastThumbHtml(src, deps) {
  deps = createDeps(deps);
  return src
    ? '<img src="' + deps.coverUrlWithSize(src, 80) + '" alt="" loading="lazy" onerror="this.style.opacity=0.2">'
    : '<div style="width:40px;height:40px;border-radius:6px;background:rgba(255,255,255,0.06);flex-shrink:0"></div>';
}

function renderPodcastRadioItemsHtml(items, label, deps) {
  deps = createDeps(deps);
  return (items || []).map(function(p, i) {
    p = p || {};
    return '<div class="search-result">' +
      '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0" onclick="openPodcastPrograms(' + i + ')">' +
        renderPodcastThumbHtml(p.cover, deps) +
        '<div class="search-result-info">' +
          '<div class="search-result-title">' + deps.escHtml(p.name || '') + '<span class="tag-podcast">Podcast</span></div>' +
          '<div class="search-result-meta">' + deps.escHtml(deps.podcastMetaText(p) || label || 'NetEase Radio') + '</div>' +
        '</div>' +
      '</div>' +
      '<button class="add-btn" title="Open" onclick="event.stopPropagation();openPodcastPrograms(' + i + ')">›</button>' +
    '</div>';
  }).join('');
}

function renderPodcastNoProgramsHtml(radio, deps) {
  deps = createDeps(deps);
  radio = radio || {};
  return '<div class="podcast-result-head"><button class="podcast-back-btn" onclick="event.stopPropagation();renderPodcastRadios(podcastResults)">‹</button><div class="search-result-info"><div class="search-result-title">' + deps.escHtml(radio.name || 'Podcast') + '</div><div class="search-result-meta">No playable episodes</div></div></div>';
}

function renderPodcastProgramsHtml(radio, programs, deps) {
  deps = createDeps(deps);
  radio = radio || {};
  programs = programs || [];
  return '<div class="podcast-result-head">' +
      '<button class="podcast-back-btn" onclick="event.stopPropagation();renderPodcastRadios(podcastResults)">‹</button>' +
      renderPodcastThumbHtml(radio.cover, deps) +
      '<div class="search-result-info"><div class="search-result-title">' + deps.escHtml(radio.name || 'Podcast') + '<span class="tag-podcast">Podcast</span></div><div class="search-result-meta">' + deps.escHtml(radio.djName || (programs.length + ' episodes')) + '</div></div>' +
    '</div>' +
    programs.map(function(p, i) {
      p = p || {};
      return '<div class="search-result">' +
        '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0" onclick="playPodcastProgram(' + i + ')">' +
          renderPodcastThumbHtml(p.cover, deps) +
          '<div class="search-result-info">' +
            '<div class="search-result-title">' + deps.escHtml(p.name || '') + '</div>' +
            '<div class="search-result-meta">' + deps.escHtml(deps.programMetaText(p)) + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="add-btn" title="下一首播放" onclick="event.stopPropagation();queuePodcastProgram(' + i + ')">+</button>' +
      '</div>';
    }).join('');
}

function renderMyPodcastPanelThumbHtml(src, deps) {
  deps = createDeps(deps);
  return src
    ? '<img src="' + deps.coverUrlWithSize(src, 88) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">'
    : '<div style="width:44px;height:44px;border-radius:8px;background:rgba(0,245,212,.07);flex-shrink:0"></div>';
}

function renderMyPodcastCollectionsHtml(items, deps) {
  deps = createDeps(deps);
  return (items || []).map(function(pc) {
    pc = pc || {};
    return '<div class="pl-card podcast-card" data-podcast-key="' + deps.escHtml(pc.key || '') + '" data-podcast-title="' + deps.escHtml(pc.title || '') + '">' +
      renderMyPodcastPanelThumbHtml(pc.cover, deps) +
      '<div style="flex:1;min-width:0"><div class="pl-name">' + deps.escHtml(pc.title || '') + '</div><div class="pl-sub">' + (pc.count || 0) + ' 项 · ' + deps.escHtml(pc.sub || '') + '</div></div>' +
    '</div>';
  }).join('');
}

function renderMyPodcastRadioHeaderHtml(title, deps) {
  deps = createDeps(deps);
  return '<div class="podcast-inline-head"><div class="pl-section-label">' + deps.escHtml(title || '我的播客') + '</div><button class="fx-mini-btn ghost" data-podcast-back="1" style="height:24px;padding:0 9px;font-size:10.5px">返回</button></div>';
}

function renderMyPodcastRadioItemsHtml(title, items, deps) {
  deps = createDeps(deps);
  items = items || [];
  var header = renderMyPodcastRadioHeaderHtml(title, deps);
  if (!items.length) {
    return header + '<div style="text-align:center;padding:14px 0;color:rgba(255,255,255,.28);font-size:11.5px">暂无内容</div>';
  }
  return header + items.map(function(r) {
    r = r || {};
    return '<div class="pl-card podcast-card podcast-child" data-podcast-radio-id="' + deps.escHtml(String(r.id || r.radioId || '')) + '" data-podcast-title="' + deps.escHtml(r.name || '') + '">' +
      renderMyPodcastPanelThumbHtml(r.cover, deps) +
      '<div style="flex:1;min-width:0"><div class="pl-name">' + deps.escHtml(r.name || '') + '</div><div class="pl-sub">' + deps.escHtml((r.djName || r.artist || 'Podcast') + (r.programCount ? (' · ' + r.programCount + ' 集') : '')) + '</div></div>' +
    '</div>';
  }).join('');
}

var MineradioPodcastResults = {
  renderPodcastThumbHtml: renderPodcastThumbHtml,
  renderPodcastRadioItemsHtml: renderPodcastRadioItemsHtml,
  renderPodcastNoProgramsHtml: renderPodcastNoProgramsHtml,
  renderPodcastProgramsHtml: renderPodcastProgramsHtml,
  renderMyPodcastPanelThumbHtml: renderMyPodcastPanelThumbHtml,
  renderMyPodcastCollectionsHtml: renderMyPodcastCollectionsHtml,
  renderMyPodcastRadioHeaderHtml: renderMyPodcastRadioHeaderHtml,
  renderMyPodcastRadioItemsHtml: renderMyPodcastRadioItemsHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioPodcastResults = MineradioPodcastResults;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioPodcastResults;
}
