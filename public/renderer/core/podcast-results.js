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

var MineradioPodcastResults = {
  renderPodcastThumbHtml: renderPodcastThumbHtml,
  renderPodcastRadioItemsHtml: renderPodcastRadioItemsHtml,
  renderPodcastNoProgramsHtml: renderPodcastNoProgramsHtml,
  renderPodcastProgramsHtml: renderPodcastProgramsHtml,
};

if (typeof window !== 'undefined') {
  window.MineradioPodcastResults = MineradioPodcastResults;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MineradioPodcastResults;
}
