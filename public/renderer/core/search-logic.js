'use strict';

var SEARCH_HISTORY_STORE_KEY = 'mineradio-search-history';

function songProviderKey(song) {
  if (song && (song.provider === 'qq' || song.source === 'qq' || song.type === 'qq')) return 'qq';
  return 'netease';
}

function searchResultKey(q, mode) {
  return (mode || 'song') + '|' + String(q || '').trim();
}

function readSearchHistory(storage) {
  try {
    var raw = JSON.parse(storage.getItem(SEARCH_HISTORY_STORE_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(function(v){ return String(v || '').trim(); }).filter(Boolean).slice(0, 10) : [];
  } catch (e) {
    return [];
  }
}

function writeSearchHistory(storage, items) {
  try { storage.setItem(SEARCH_HISTORY_STORE_KEY, JSON.stringify((items || []).slice(0, 10))); } catch (e) {}
}

function rememberSearchQuery(storage, q) {
  q = String(q || '').trim();
  if (!q) return;
  var items = readSearchHistory(storage).filter(function(item){ return item.toLowerCase() !== q.toLowerCase(); });
  items.unshift(q);
  writeSearchHistory(storage, items);
}

function formatProgramTime(sec) {
  sec = Math.max(0, Number(sec) || 0);
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = Math.floor(sec % 60);
  return h ? (h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')) : (m + ':' + String(s).padStart(2, '0'));
}

function podcastMetaText(item) {
  item = item || {};
  var bits = [];
  if (item.djName) bits.push(item.djName);
  if (item.programCount) bits.push(item.programCount + ' episodes');
  if (item.subCount) bits.push(Math.round(item.subCount / 1000) + 'k follows');
  return bits.join('  ·  ');
}

function programMetaText(item) {
  item = item || {};
  var bits = [];
  if (item.radioName || item.artist) bits.push(item.radioName || item.artist);
  if (item.djName && item.djName !== item.artist) bits.push(item.djName);
  if (item.duration) bits.push(formatProgramTime(Math.round(item.duration / 1000)));
  return bits.join('  ·  ');
}

function searchIntentPrefersQQ(q) {
  q = String(q || '').toLowerCase();
  return /(^|\s)qq($|\s)|qq音乐|qq音樂|周杰伦|周杰倫|jay\s*chou|jay/.test(q);
}

function simpleSearchNorm(text) {
  return String(text || '').toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s·・,，。.!！?？'"“”‘’|\-_/]+/g, '');
}

function searchMentionsKnownArtist(q, artist) {
  var rawQ = String(q || '').toLowerCase();
  var rawArtist = String(artist || '').toLowerCase();
  if (!rawArtist) return false;
  if (/周杰伦|周杰倫|jay\s*chou/.test(rawQ) && /周杰伦|周杰倫|jay\s*chou/.test(rawArtist)) return true;
  var nq = simpleSearchNorm(q);
  var na = simpleSearchNorm(artist);
  return !!(na && na.length >= 2 && nq.indexOf(na) >= 0);
}

function searchLooksLikeDerivative(text) {
  return /(翻唱|cover|伴奏|instrumental|remix|片段|demo|女声|男声|karaoke|完整版\s*cover|抖音版|dj版|合唱版|改编版|赵露思版|超燃|硬曲|剪辑|二创|tribute|made\s*famous\s*by)/i.test(String(text || ''));
}

var SEARCH_ORIGINAL_ARTIST_HINTS = [
  { titles: ['日落大道'], artists: ['梁博'] },
  { titles: ['beautyandabeat', 'beauty and a beat'], artists: ['justin bieber', 'nicki minaj'] },
];

function canonicalOriginalArtistsForSearch(q, song) {
  var qNorm = simpleSearchNorm(q);
  var titleNorm = simpleSearchNorm(song && song.name);
  var artists = [];
  SEARCH_ORIGINAL_ARTIST_HINTS.forEach(function(rule) {
    var matched = (rule.titles || []).some(function(title) {
      var nt = simpleSearchNorm(title);
      var titleMatches = !!(titleNorm && (titleNorm === nt || titleNorm.indexOf(nt) >= 0));
      return !!(nt && (qNorm.indexOf(nt) >= 0 || titleMatches));
    });
    if (matched) {
      (rule.artists || []).forEach(function(artist) {
        if (artists.indexOf(artist) < 0) artists.push(artist);
      });
    }
  });
  return artists;
}

function songArtistMatchesAny(song, artists) {
  var songArtist = simpleSearchNorm(song && song.artist);
  if (!songArtist || !artists || !artists.length) return false;
  return artists.some(function(artist) {
    var na = simpleSearchNorm(artist);
    return !!(na && (songArtist.indexOf(na) >= 0 || na.indexOf(songArtist) >= 0));
  });
}

function searchLooksLikeSameTitleCover(song, nq, name, album, raw, originalArtistMatch, sourceIndex) {
  if (!song || !nq || !name || originalArtistMatch) return false;
  var sameTitle = name === nq || nq.indexOf(name) >= 0 || name.indexOf(nq) === 0;
  if (!sameTitle) return false;
  var selfTitledSingle = !!(album && (album === name || album === nq || album.indexOf(name) >= 0 || name.indexOf(album) >= 0));
  return selfTitledSingle || searchLooksLikeDerivative(raw) || (sourceIndex || 0) > 0;
}

function scoreSongSearchResult(song, q, sourceIndex) {
  var nq = simpleSearchNorm(q);
  var name = simpleSearchNorm(song && song.name);
  var artist = simpleSearchNorm(song && song.artist);
  var album = simpleSearchNorm(song && song.album);
  var raw = String(((song && song.name) || '') + ' ' + ((song && song.artist) || '') + ' ' + ((song && song.album) || '')).toLowerCase();
  var qAsksDerivative = /(live|现场|翻唱|cover|伴奏|instrumental|remix|dj|片段|demo|女声|男声|karaoke)/i.test(String(q || ''));
  var derivative = searchLooksLikeDerivative(raw);
  var artistMentioned = searchMentionsKnownArtist(q, song && song.artist);
  var originalArtists = canonicalOriginalArtistsForSearch(q, song);
  var originalArtistMatch = songArtistMatchesAny(song, originalArtists);
  var score = 0;
  if (name === nq) score += 90;
  else if (name.indexOf(nq) === 0) score += 55;
  else if (name.indexOf(nq) >= 0) score += 32;
  if (name && nq && nq.indexOf(name) >= 0) score += name.length >= 2 ? 68 : 18;
  if (originalArtistMatch && name && nq && (name === nq || nq.indexOf(name) >= 0 || name.indexOf(nq) >= 0)) score += 122;
  else if (!qAsksDerivative && originalArtists.length && name && nq && (name === nq || nq.indexOf(name) >= 0 || name.indexOf(nq) >= 0)) score -= 58;
  if (artistMentioned) score += 96;
  else if (artist && nq && nq.indexOf(artist) >= 0) score += 64;
  else if (artist && artist.indexOf(nq) >= 0) score += 22;
  if (artistMentioned && name && nq.indexOf(name) >= 0) score += 34;
  if (/周杰伦|周杰倫|jay\s*chou/i.test(String(q || '')) && !artistMentioned) score -= 28;
  if (album && nq && (album.indexOf(nq) >= 0 || nq.indexOf(album) >= 0)) score += 8;
  if (songProviderKey(song) === 'qq') score += searchIntentPrefersQQ(q) ? 48 : 4;
  if (song && song.playable === false) score -= 12;
  if (!qAsksDerivative) {
    if (derivative) score -= artistMentioned ? 76 : 96;
    if (/(live|现场)/i.test(raw)) score -= artistMentioned ? 28 : 42;
    if (originalArtists.length && searchLooksLikeSameTitleCover(song, nq, name, album, raw, originalArtistMatch, sourceIndex)) score -= 46;
  }
  score -= (sourceIndex || 0) * 0.75;
  return score;
}

function mergeSongSearchResults(neteaseSongs, qqSongs, limit, q) {
  var out = [];
  var seen = {};
  function push(song, sourceIndex) {
    if (!song || !song.name) return;
    var key = songProviderKey(song) + ':' + (song.mid || song.id || (song.name + '|' + song.artist));
    if (seen[key]) return;
    seen[key] = true;
    song._searchScore = scoreSongSearchResult(song, q, sourceIndex);
    out.push(song);
  }
  (neteaseSongs || []).forEach(function(song, i){ push(song, i); });
  (qqSongs || []).forEach(function(song, i){ push(song, i); });
  out.sort(function(a, b){ return (b._searchScore || 0) - (a._searchScore || 0); });
  return out.slice(0, limit);
}

var MineradioSearchLogic = {
  searchResultKey: searchResultKey,
  readSearchHistory: readSearchHistory,
  writeSearchHistory: writeSearchHistory,
  rememberSearchQuery: rememberSearchQuery,
  formatProgramTime: formatProgramTime,
  podcastMetaText: podcastMetaText,
  programMetaText: programMetaText,
  searchIntentPrefersQQ: searchIntentPrefersQQ,
  searchMentionsKnownArtist: searchMentionsKnownArtist,
  searchLooksLikeDerivative: searchLooksLikeDerivative,
  scoreSongSearchResult: scoreSongSearchResult,
  mergeSongSearchResults: mergeSongSearchResults,
  songProviderKey: songProviderKey,
};

if (typeof module !== 'undefined' && module.exports) module.exports = MineradioSearchLogic;
if (typeof window !== 'undefined') window.MineradioSearchLogic = MineradioSearchLogic;
