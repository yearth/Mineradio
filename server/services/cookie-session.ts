const COOKIE_ATTRIBUTE_NAMES = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly']);

function collectCookiePair(picked: Map<string, string>, key: unknown, value: unknown): void {
  const name = String(key || '').trim();
  if (!name || COOKIE_ATTRIBUTE_NAMES.has(name.toLowerCase())) return;
  if (value === null || value === undefined) return;
  picked.set(name, String(value).trim());
}

function collectCookieInput(input: any, picked: Map<string, string>): void {
  if (input === null || input === undefined) return;
  if (Array.isArray(input)) {
    input.forEach(item => collectCookieInput(item, picked));
    return;
  }
  if (typeof input === 'object') {
    if (input.name && Object.prototype.hasOwnProperty.call(input, 'value')) {
      collectCookiePair(picked, input.name, input.value);
      return;
    }
    Object.keys(input).forEach(key => {
      const value = input[key];
      if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
        collectCookiePair(picked, key, value.value);
      } else if (typeof value !== 'object') {
        collectCookiePair(picked, key, value);
      }
    });
    return;
  }
  String(input).split(/\r?\n/).forEach(line => {
    line.split(';').forEach(part => {
      const raw = String(part || '').trim();
      const idx = raw.indexOf('=');
      if (idx <= 0) return;
      collectCookiePair(picked, raw.slice(0, idx), raw.slice(idx + 1));
    });
  });
}

export function normalizeCookieHeader(input: any): string {
  const picked = new Map<string, string>();
  collectCookieInput(input, picked);
  return Array.from(picked.entries())
    .filter(([key, value]) => key && value != null && String(value) !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

export function rawCookieFallback(input: any): string {
  if (typeof input === 'string') return input.trim();
  if (Array.isArray(input) && input.every(item => typeof item === 'string')) return input.join('; ').trim();
  return '';
}

export function parseCookieString(cookieText: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  String(cookieText || '').split(';').forEach(part => {
    const raw = String(part || '').trim();
    if (!raw) return;
    const idx = raw.indexOf('=');
    if (idx <= 0) return;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}

export function serializeCookieObject(obj: Record<string, unknown> | null | undefined): string {
  return Object.keys(obj || {})
    .filter(k => obj![k] != null && String(obj![k]) !== '')
    .map(k => k + '=' + String(obj![k]))
    .join('; ');
}

export function normalizeQQUin(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || digits;
}

export function qqCookieUin(obj: Record<string, unknown> | null | undefined): string {
  const cookie = obj || {};
  const raw = Number(cookie.login_type) === 2 ? (cookie.wxuin || cookie.uin || cookie.p_uin) : (cookie.uin || cookie.qqmusic_uin || cookie.wxuin || cookie.p_uin);
  return normalizeQQUin(raw);
}

export function qqCookieMusicKey(obj: Record<string, unknown> | null | undefined): unknown {
  const cookie = obj || {};
  return cookie.qm_keyst || cookie.qqmusic_key || cookie.music_key || cookie.p_skey || cookie.skey ||
    cookie.psrf_qqaccess_token || cookie.psrf_qqrefresh_token || cookie.wxrefresh_token || cookie.wxskey || '';
}

export function qqCookiePlaybackKey(obj: Record<string, unknown> | null | undefined): unknown {
  const cookie = obj || {};
  return cookie.qm_keyst || cookie.qqmusic_key || cookie.music_key || cookie.wxskey || '';
}

export function decodeQQCookieValue(value: unknown): string {
  try { return decodeURIComponent(String(value || '').replace(/\+/g, '%20')).trim(); }
  catch (e) { return String(value || '').trim(); }
}

export function qqCookieNickname(obj: Record<string, unknown> | null | undefined, uin?: unknown): string {
  const cookie = obj || {};
  const normalizedUin = normalizeQQUin(uin || qqCookieUin(cookie));
  const padded = normalizedUin ? '0' + normalizedUin : '';
  const keys = [
    normalizedUin && ('ptnick_' + normalizedUin),
    padded && ('ptnick_' + padded),
    'ptnick',
    'nick',
    'nickname',
    'qq_nickname',
  ].filter(Boolean) as string[];
  for (const key of keys) {
    if (cookie[key]) {
      const nick = decodeQQCookieValue(cookie[key]);
      if (nick) return nick;
    }
  }
  const ptnickKey = Object.keys(cookie).find(key => /^ptnick_/i.test(key) && cookie[key]);
  return ptnickKey ? decodeQQCookieValue(cookie[ptnickKey]) : '';
}

export function qqCookieAvatar(obj: Record<string, unknown> | null | undefined, uin?: unknown): string {
  const cookie = obj || {};
  const direct = cookie.qqmusic_avatar || cookie.avatar || cookie.avatarUrl || cookie.headpic || '';
  if (direct) return decodeQQCookieValue(direct);
  const normalizedUin = normalizeQQUin(uin || qqCookieUin(cookie));
  return normalizedUin ? `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(normalizedUin)}&s=100` : '';
}

export function normalizeQQCookieInput(cookieText: unknown): string {
  const obj: Record<string, string> = parseCookieString(cookieText);
  if (Number(obj.login_type) === 2 && obj.wxuin && !obj.uin) obj.uin = obj.wxuin;
  if (!obj.uin && (obj.qqmusic_uin || obj.p_uin)) obj.uin = obj.qqmusic_uin || obj.p_uin;
  if (obj.uin) obj.uin = normalizeQQUin(obj.uin);
  return serializeCookieObject(obj);
}
