export function mapArtists(raw: any[]): any[] {
  return (raw || [])
    .map(a => ({ id: a && a.id, name: (a && a.name) || '' }))
    .filter(a => a.name);
}

export function mapSongRecord(s: any): Record<string, unknown> {
  s = s || {};
  const artists = mapArtists(s.ar || s.artists);
  const album = s.al || s.album || {};
  return {
    provider: 'netease',
    source: 'netease',
    type: 'song',
    id: s.id,
    name: s.name,
    artist: artists.map(a => a.name).join(' / '),
    artists,
    artistId: artists[0] && artists[0].id,
    album: album.name || '',
    cover: album.picUrl || album.coverUrl || '',
    duration: s.dt || s.duration || 0,
    fee: s.fee,
  };
}

export function qqAlbumCover(albumMid: unknown, size?: number): string {
  if (!albumMid) return '';
  const px = size || 300;
  return 'https://y.qq.com/music/photo_new/T002R' + px + 'x' + px + 'M000' + albumMid + '.jpg?max_age=2592000';
}

export function mapQQArtists(raw: any[]): any[] {
  return (raw || [])
    .map(a => ({
      id: a && a.id,
      mid: a && a.mid,
      name: (a && (a.name || a.title)) || '',
    }))
    .filter(a => a.name);
}

export function mapQQSmartSong(item: any): Record<string, unknown> {
  item = item || {};
  const mid = item.mid || item.songmid || item.id || '';
  return {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: mid,
    qqId: item.id || item.docid || '',
    mid,
    songmid: mid,
    name: item.name || item.title || '',
    artist: item.singer || '',
    artists: item.singer ? [{ name: item.singer }] : [],
    album: '',
    cover: '',
    duration: 0,
    fee: 0,
    playable: false,
  };
}

export function mapQQTrack(track: any, fallback: any): Record<string, unknown> {
  track = track || {};
  fallback = fallback || {};
  const album = track.album || {};
  const artists = mapQQArtists(track.singer || []);
  const mid = track.mid || fallback.mid || fallback.songmid || '';
  const albumMid = album.mid || album.pmid || '';
  return {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: mid,
    qqId: track.id || fallback.qqId || fallback.id || '',
    mid,
    songmid: mid,
    mediaMid: track.file && track.file.media_mid,
    name: track.name || track.title || fallback.name || '',
    artist: artists.map(a => a.name).join(' / ') || fallback.artist || '',
    artists: artists.length ? artists : (fallback.artists || []),
    artistId: artists[0] && (artists[0].id || artists[0].mid),
    artistMid: artists[0] && artists[0].mid,
    album: album.name || album.title || fallback.album || '',
    albumMid,
    cover: qqAlbumCover(albumMid, 300) || fallback.cover || '',
    duration: (Number(track.interval) || 0) * 1000,
    fee: track.pay && Number(track.pay.pay_play) ? 1 : 0,
    playable: false,
  };
}

export function mapQQPlaylistTrack(raw: any): Record<string, unknown> {
  raw = raw || {};
  const track = raw.songid || raw.songmid || raw.mid || raw.name ? raw : (raw.track_info || raw.songInfo || raw.songinfo || raw.song || {});
  const album = track.album || {};
  const artists = mapQQArtists(track.singer || track.singers || []);
  const mid = track.mid || track.songmid || raw.mid || raw.songmid || '';
  const albumMid = album.mid || track.albummid || raw.albummid || '';
  return {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: mid || String(track.id || track.songid || raw.id || raw.songid || ''),
    qqId: track.id || track.songid || raw.id || raw.songid || '',
    mid,
    songmid: mid,
    mediaMid: (track.file && track.file.media_mid) || track.strMediaMid || track.media_mid || raw.strMediaMid || '',
    name: track.name || track.songname || raw.songname || '',
    artist: artists.map(a => a.name).join(' / ') || track.singername || raw.singername || '',
    artists,
    artistId: artists[0] && (artists[0].id || artists[0].mid),
    artistMid: artists[0] && artists[0].mid,
    album: album.name || album.title || track.albumname || raw.albumname || '',
    albumMid,
    cover: qqAlbumCover(albumMid, 300),
    duration: (Number(track.interval || raw.interval) || 0) * 1000,
    fee: track.pay && Number(track.pay.pay_play) ? 1 : 0,
    playable: false,
  };
}
