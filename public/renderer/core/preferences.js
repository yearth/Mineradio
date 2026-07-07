(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MineradioPreferences = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';

  var PLAYBACK_QUALITY_STORE_KEY = 'mineradio-playback-quality-v1';

  function createMemoryStorage(seed) {
    var data = Object.assign({}, seed || {});
    return {
      getItem: function(key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : null;
      },
      setItem: function(key, value) {
        data[key] = String(value);
      },
      removeItem: function(key) {
        delete data[key];
      },
      dump: function() {
        return Object.assign({}, data);
      },
    };
  }

  function readSavedVolume(storage) {
    try {
      var v = parseFloat(storage.getItem('apex-player-volume'));
      return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1.0;
    } catch (e) {
      return 1.0;
    }
  }

  function readBooleanPreference(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      if (raw == null) return !!fallback;
      return raw === '1';
    } catch (e) {
      return !!fallback;
    }
  }

  function saveBooleanPreference(storage, key, on) {
    try { storage.setItem(key, on ? '1' : '0'); } catch (e) {}
  }

  function normalizePlaybackQuality(value) {
    value = String(value || '').toLowerCase();
    if (value === 'jymaster' || value === 'master' || value === 'svip') return 'jymaster';
    if (value === 'hires' || value === 'hi-res' || value === 'highres' || value === 'highest') return 'hires';
    if (value === 'lossless' || value === 'flac' || value === 'sq') return 'lossless';
    if (value === 'exhigh' || value === 'high' || value === '320k' || value === 'hq') return 'exhigh';
    if (value === 'standard' || value === 'normal' || value === 'std') return 'standard';
    return 'hires';
  }

  function playbackQualityLabel(value) {
    value = normalizePlaybackQuality(value);
    return {
      jymaster: '超清母带',
      hires: '高清臻音',
      lossless: '无损',
      exhigh: '极高',
      standard: '标准',
    }[value];
  }

  function playbackQualityShortLabel(value) {
    value = normalizePlaybackQuality(value);
    return {
      jymaster: '母带',
      hires: '臻音',
      lossless: 'SQ',
      exhigh: 'HQ',
      standard: 'STD',
    }[value];
  }

  function playbackQualityRank(value) {
    value = normalizePlaybackQuality(value);
    return {
      jymaster: 5,
      hires: 4,
      lossless: 3,
      exhigh: 2,
      standard: 1,
    }[value];
  }

  function playbackQualityWasDowngraded(requested, resolved) {
    return playbackQualityRank(resolved) < playbackQualityRank(requested);
  }

  function playbackBitrateLabel(br) {
    br = Number(br) || 0;
    if (!br) return '';
    if (br >= 1000000) return (br / 1000000).toFixed(br >= 2000000 ? 1 : 2).replace(/\.0+$/, '') + ' Mbps';
    return Math.round(br / 1000) + ' kbps';
  }

  function playbackResolvedQualityText(data, fallbackQuality) {
    data = data || {};
    var label = playbackQualityLabel(data.level || data.quality || fallbackQuality || 'hires');
    var br = playbackBitrateLabel(data.br);
    return br ? (label + ' · ' + br) : label;
  }

  function readPlaybackQualityPreference(storage) {
    try {
      return normalizePlaybackQuality(storage.getItem(PLAYBACK_QUALITY_STORE_KEY) || 'hires');
    } catch (e) {
      return 'hires';
    }
  }

  return {
    PLAYBACK_QUALITY_STORE_KEY: PLAYBACK_QUALITY_STORE_KEY,
    createMemoryStorage: createMemoryStorage,
    readSavedVolume: readSavedVolume,
    readBooleanPreference: readBooleanPreference,
    saveBooleanPreference: saveBooleanPreference,
    normalizePlaybackQuality: normalizePlaybackQuality,
    playbackQualityLabel: playbackQualityLabel,
    playbackQualityShortLabel: playbackQualityShortLabel,
    playbackQualityRank: playbackQualityRank,
    playbackQualityWasDowngraded: playbackQualityWasDowngraded,
    playbackBitrateLabel: playbackBitrateLabel,
    playbackResolvedQualityText: playbackResolvedQualityText,
    readPlaybackQualityPreference: readPlaybackQualityPreference,
  };
});
