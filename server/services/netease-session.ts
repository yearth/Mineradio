import { normalizeApiCode, normalizeApiMessage } from './provider-response';
import { normalizeCookieHeader } from './cookie-session';

const loggedOutDefaults = {
  loggedIn: false,
  vipType: 0,
  vipLevel: 'none',
  isVip: false,
  isSvip: false,
  vipLabel: '无VIP',
};

export interface NeteaseLoginInfoDeps {
  readonly loginStatus: (opts: any) => Promise<any>;
  readonly now?: () => number;
  readonly saveCookie?: (cookie: string) => void;
  readonly userAccount: (opts: any) => Promise<any>;
  readonly warn?: (...args: any[]) => void;
}

function firstPositiveNumberFrom(objects: any[], keys: string[]): number {
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of keys) {
      const value = Number(obj[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return 0;
}

function collectStringValues(value: any, out: string[], depth: number): string[] {
  if (depth > 4 || value == null) return out;
  if (typeof value === 'string') {
    if (value) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectStringValues(item, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(key => collectStringValues(value[key], out, depth + 1));
  }
  return out;
}

function collectVipStringValues(value: any, out: string[], depth: number): string[] {
  if (depth > 4 || value == null) return out;
  if (Array.isArray(value)) {
    value.forEach(item => collectVipStringValues(item, out, depth + 1));
    return out;
  }
  if (typeof value !== 'object') return out;
  Object.keys(value).forEach(key => {
    const child = value[key];
    if (/vip|svip|member|associator|privilege|right|level|package|label|title|type/i.test(key)) {
      collectStringValues(child, out, depth + 1);
    } else if (child && typeof child === 'object') {
      collectVipStringValues(child, out, depth + 1);
    }
  });
  return out;
}

export function normalizeNeteaseVip(profile: any, account: any, extra: any): Record<string, unknown> {
  profile = profile || {};
  account = account || {};
  extra = extra || {};
  const vipInfo = profile.vipInfo || profile.vipinfo || account.vipInfo || account.vipinfo || extra.vipInfo || extra.vipinfo || {};
  const objects = [account, profile, vipInfo, extra];
  const vipType = firstPositiveNumberFrom(objects, [
    'vipType', 'vip_type', 'viptype', 'musicVipType', 'music_vip_type',
    'musicVipLevel', 'music_vip_level', 'redVipLevel', 'red_vip_level',
    'blackVipLevel', 'black_vip_level', 'luxuryVipLevel', 'luxury_vip_level',
    'svipType', 'svip_type',
  ]);
  const text = collectVipStringValues({ account, profile, vipInfo, extra }, [], 0).join(' ').toLowerCase();
  const svipFlag = objects.some(obj => obj && (
    obj.isSvip === true || obj.is_svip === true || obj.svip === true ||
    Number(obj.isSvip || obj.is_svip || obj.svip || obj.svipType || obj.svip_type || 0) > 0
  )) || /svip|supervip|super_vip|blackvip|black_vip|黑胶svip|超级会员/.test(text);
  const vipFlag = objects.some(obj => obj && (
    obj.isVip === true || obj.is_vip === true || obj.vip === true ||
    Number(obj.isVip || obj.is_vip || obj.vip || obj.vipFlag || obj.vipflag || 0) > 0
  )) || /vip|黑胶|会员/.test(text);
  const isSvip = svipFlag || vipType >= 10;
  const isVip = isSvip || vipFlag || vipType > 0;
  const vipLevel = isSvip ? 'svip' : (isVip ? 'vip' : 'none');
  return {
    vipType,
    vipLevel,
    isVip,
    isSvip,
    vipLabel: vipLevel === 'svip' ? 'SVIP' : (vipLevel === 'vip' ? 'VIP' : '无VIP'),
  };
}

export function normalizeLoginInfo(profile: any, account: any, extra: any): Record<string, unknown> {
  profile = profile || {};
  account = account || {};
  const userId = profile.userId || profile.user_id || profile.id || account.userId || account.id || '';
  if (!(userId || userId === 0)) return { loggedIn: false };
  const vip = normalizeNeteaseVip(profile, account, extra);
  return {
    loggedIn: true,
    userId,
    nickname: profile.nickname || profile.userName || '网易云用户',
    avatar: profile.avatarUrl || profile.avatar || '',
    ...vip,
  };
}

export function isNeteaseAuthInvalidPayload(payload: any): boolean {
  const code = normalizeApiCode(payload);
  if (code === 301 || code === 401) return true;
  const msg = normalizeApiMessage(payload);
  return /未登录|需要登录|请先登录|login/i.test(msg) && code >= 300;
}

export function readCookieFromResponse(resp: any): string {
  const candidates = [
    resp && resp.cookie,
    resp && resp.body && resp.body.cookie,
    resp && resp.body && resp.body.data && resp.body.data.cookie,
    resp && resp.body && resp.body.data && resp.body.data.cookies,
  ];
  for (const candidate of candidates) {
    const cookie = normalizeCookieHeader(candidate);
    if (cookie) return cookie;
  }
  return '';
}

export async function getNeteaseLoginInfo(userCookie: string, deps: NeteaseLoginInfoDeps): Promise<Record<string, unknown>> {
  if (!userCookie) return { ...loggedOutDefaults };
  const now = deps.now || Date.now;
  const warn = deps.warn || (() => {});

  // login_status 对二维码 cookie 的资料刷新通常更及时；失败时再降级到 user_account。
  try {
    const st = await deps.loginStatus({ cookie: userCookie, timestamp: now() });
    const body = st.body || {};
    const data = body.data || body;
    const info = normalizeLoginInfo(data.profile || body.profile, data.account || body.account, data);
    if (info.loggedIn) return info;
  } catch (e: any) {
    warn('[Login] login_status failed:', e.message);
  }

  try {
    const acc = await deps.userAccount({ cookie: userCookie, timestamp: now() });
    const body = acc.body || {};
    const info = normalizeLoginInfo(body.profile, body.account, body);
    if (info.loggedIn) return info;
    if (isNeteaseAuthInvalidPayload(acc) && deps.saveCookie) deps.saveCookie('');
    return { ...loggedOutDefaults, hasCookie: !!userCookie };
  } catch (e: any) {
    warn('[Login] account check failed:', e.message);
    return { ...loggedOutDefaults, hasCookie: !!userCookie };
  }
}

export function pendingNeteaseLoginInfo(body?: any): Record<string, unknown> {
  body = body || {};
  return {
    loggedIn: true,
    pendingProfile: true,
    nickname: body.nickname || (body.profile && body.profile.nickname) || '网易云用户',
    avatar: body.avatarUrl || (body.profile && body.profile.avatarUrl) || '',
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  };
}
