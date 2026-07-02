declare const Buffer: any;

import { mapQQSmartSong } from './music-mapper';

export function parseJSONText(text: unknown): any {
  const raw = String(text || '').trim();
  const json = raw.replace(/^callback\(([\s\S]*)\);?$/, '$1');
  return JSON.parse(json);
}

export async function requestQQMusicJson(opts: {
  payload: unknown;
  url: string;
  baseHeaders?: Record<string, string>;
  cookie?: string;
  includeCookie?: boolean;
  requestText: (targetUrl: string, requestOpts: Record<string, unknown>, body: string) => Promise<string>;
}): Promise<any> {
  const body = JSON.stringify(opts.payload);
  const headers: Record<string, string | number> = {
    ...(opts.baseHeaders || {}),
    'Content-Type': 'application/json;charset=UTF-8',
    'Content-Length': Buffer.byteLength(body),
  };
  if (opts.includeCookie && opts.cookie) headers.Cookie = opts.cookie;
  const text = await opts.requestText(opts.url, {
    method: 'POST',
    headers,
  }, body);
  return parseJSONText(text);
}

export async function requestQQGetJson(opts: {
  url: string;
  params?: Record<string, unknown>;
  baseHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  cookie?: string;
  includeCookie?: boolean;
  requestText: (targetUrl: string, requestOpts: Record<string, unknown>) => Promise<string>;
}): Promise<any> {
  const url = new URL(opts.url);
  Object.keys(opts.params || {}).forEach(key => {
    const value = opts.params ? opts.params[key] : undefined;
    if (value != null) url.searchParams.set(key, String(value));
  });
  const headers: Record<string, string> = { ...(opts.baseHeaders || {}), ...(opts.headers || {}) };
  if (opts.includeCookie && opts.cookie) headers.Cookie = opts.cookie;
  const text = await opts.requestText(url.toString(), { headers });
  return parseJSONText(text);
}

export async function requestQQSmartboxSearch(opts: {
  keywords: unknown;
  limit?: unknown;
  url: string;
  headers?: Record<string, string>;
  requestText: (targetUrl: string, requestOpts: Record<string, unknown>) => Promise<string>;
}): Promise<Record<string, unknown>[]> {
  const url = new URL(opts.url);
  url.searchParams.set('format', 'json');
  url.searchParams.set('key', String(opts.keywords || ''));
  url.searchParams.set('g_tk', '5381');
  url.searchParams.set('loginUin', '0');
  url.searchParams.set('hostUin', '0');
  url.searchParams.set('inCharset', 'utf8');
  url.searchParams.set('outCharset', 'utf-8');
  url.searchParams.set('notice', '0');
  url.searchParams.set('platform', 'yqq.json');
  url.searchParams.set('needNewCode', '0');
  const text = await opts.requestText(url.toString(), { headers: opts.headers || {} });
  const json = parseJSONText(text);
  const items = json && json.data && json.data.song && json.data.song.itemlist;
  return (Array.isArray(items) ? items : [])
    .slice(0, Math.max(1, Math.min(Number(opts.limit) || 6, 10)))
    .map(mapQQSmartSong);
}

export function buildQQProfileUrl(uin: unknown): string {
  const url = new URL('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg');
  url.searchParams.set('cid', '205360838');
  url.searchParams.set('userid', String(uin || ''));
  url.searchParams.set('reqfrom', '1');
  url.searchParams.set('g_tk', '5381');
  url.searchParams.set('loginUin', String(uin || ''));
  url.searchParams.set('hostUin', '0');
  url.searchParams.set('format', 'json');
  url.searchParams.set('inCharset', 'utf8');
  url.searchParams.set('outCharset', 'utf-8');
  url.searchParams.set('notice', '0');
  url.searchParams.set('platform', 'yqq.json');
  url.searchParams.set('needNewCode', '0');
  return url.toString();
}

export function audioProxyHeadersFor(audioUrl: unknown, range: unknown, userAgent: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': userAgent, Referer: 'https://music.163.com/' };
  try {
    const host = new URL(String(audioUrl || '')).hostname.toLowerCase();
    if (host.includes('qq.com') || host.includes('qpic.cn')) headers.Referer = 'https://y.qq.com/';
  } catch (e) {}
  if (range) headers.Range = String(range);
  return headers;
}

export function audioContentTypeForUrl(audioUrl: unknown, upstreamType: unknown): string {
  let pathname = '';
  try { pathname = new URL(String(audioUrl || '')).pathname.toLowerCase(); } catch (e) {}
  if (/\.flac$/.test(pathname)) return 'audio/flac';
  if (/\.mp3$/.test(pathname)) return 'audio/mpeg';
  if (/\.(m4a|mp4)$/.test(pathname)) return 'audio/mp4';
  if (/\.ogg$/.test(pathname)) return 'audio/ogg';
  if (/\.wav$/.test(pathname)) return 'audio/wav';
  return upstreamType ? String(upstreamType) : 'audio/mpeg';
}

export function qqSingerAvatar(singerMid: unknown, size?: number): string {
  if (!singerMid) return '';
  const px = size || 300;
  return 'https://y.qq.com/music/photo_new/T001R' + px + 'x' + px + 'M000' + singerMid + '.jpg?max_age=2592000';
}

export function mapQQPlaylist(pl: any, kind: string): Record<string, unknown> {
  pl = pl || {};
  const id = pl.dissid || pl.tid || pl.dirid || pl.id || pl.diss_id;
  return {
    provider: 'qq',
    source: 'qq',
    id: id ? String(id) : '',
    name: pl.diss_name || pl.name || pl.title || '',
    cover: pl.diss_cover || pl.logo || pl.picurl || pl.cover || '',
    trackCount: pl.song_cnt || pl.songnum || pl.total_song_num || pl.song_count || 0,
    playCount: pl.listen_num || pl.visitnum || pl.play_count || 0,
    creator: pl.hostname || pl.nick || pl.creator || 'QQ 音乐',
    subscribed: kind === 'collect',
    specialType: 0,
  };
}

export function mapQQComment(raw: any): Record<string, unknown> {
  raw = raw || {};
  const user = raw.user || raw.uin || {};
  const nickname = raw.nick || raw.nickname || raw.encrypt_uin || user.nick || user.nickname || user.name || 'QQ 音乐用户';
  const avatar = raw.avatarurl || raw.avatar || user.avatarurl || user.avatar || '';
  const timeRaw = Number(raw.time || raw.commenttime || raw.createTime || 0) || 0;
  return {
    id: raw.commentid || raw.commentId || raw.id || '',
    content: raw.rootcommentcontent || raw.content || raw.comment || '',
    likedCount: Number(raw.praisenum || raw.praise_num || raw.likedCount || 0) || 0,
    time: timeRaw && timeRaw < 10000000000 ? timeRaw * 1000 : timeRaw,
    user: {
      id: raw.encrypt_uin || raw.uin || user.uin || '',
      nickname,
      avatar,
    },
  };
}
