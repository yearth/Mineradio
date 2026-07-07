import {
  createRequestRuntime,
  type RequestRuntime,
} from '../runtime/request-runtime';
import {
  normalizeQQProfile as defaultNormalizeQQProfile,
  parseCookieString as defaultParseCookieString,
  qqCookieMusicKey as defaultQQCookieMusicKey,
  qqCookiePlaybackKey as defaultQQCookiePlaybackKey,
  qqCookieUin as defaultQQCookieUin,
} from '../services/cookie-session';
import {
  fetchQQLoginInfo as defaultFetchQQLoginInfo,
} from '../services/qq-orchestration';
import {
  requestJson as defaultRequestJson,
  requestText as defaultRequestText,
} from '../services/request-client';
import {
  buildQQProfileUrl as defaultBuildQQProfileUrl,
  parseJSONText as defaultParseJSONText,
  requestQQGetJson as defaultRequestQQGetJson,
  requestQQMusicJson as defaultRequestQQMusicJson,
  requestQQSmartboxSearch as defaultRequestQQSmartboxSearch,
} from '../services/qq-utils';
import {
  mapQQTrack as defaultMapQQTrack,
} from '../services/music-mapper';

type AnyFn = (...args: any[]) => any;

export interface QQRequestAdapters {
  readonly requestRuntime: RequestRuntime;
  readonly requestText: AnyFn;
  readonly requestJson: AnyFn;
  readonly qqCookieObject: AnyFn;
  readonly qqCookieUin: AnyFn;
  readonly qqCookieMusicKey: AnyFn;
  readonly qqCookiePlaybackKey: AnyFn;
  readonly qqMusicRequest: AnyFn;
  readonly getQQLoginInfo: AnyFn;
  readonly qqGetJSON: AnyFn;
  readonly qqSmartboxSearch: AnyFn;
  readonly qqSongDetail: AnyFn;
  readonly qqHeaders: Record<string, string>;
}

export interface QQRequestAdapterOptions {
  readonly http: unknown;
  readonly https: unknown;
  readonly userAgent: string;
  readonly getQQCookie: () => string;
  readonly logger: unknown;
  readonly services?: Partial<Record<string, AnyFn>>;
}

const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';

const defaultServices: Record<string, AnyFn> = {
  requestText: defaultRequestText,
  requestJson: defaultRequestJson,
  parseCookieString: defaultParseCookieString,
  qqCookieUin: defaultQQCookieUin,
  qqCookieMusicKey: defaultQQCookieMusicKey,
  qqCookiePlaybackKey: defaultQQCookiePlaybackKey,
  normalizeQQProfile: defaultNormalizeQQProfile,
  buildQQProfileUrl: defaultBuildQQProfileUrl,
  parseJSONText: defaultParseJSONText,
  requestQQMusicJson: defaultRequestQQMusicJson,
  requestQQGetJson: defaultRequestQQGetJson,
  requestQQSmartboxSearch: defaultRequestQQSmartboxSearch,
  fetchQQLoginInfo: defaultFetchQQLoginInfo,
  mapQQTrack: defaultMapQQTrack,
};

export function createQQRequestAdapters(options: QQRequestAdapterOptions): QQRequestAdapters {
  const services = { ...defaultServices, ...(options.services || {}) } as Record<string, AnyFn>;
  const qqHeaders = {
    Referer: 'https://y.qq.com/',
    'User-Agent': options.userAgent,
  };

  function baseRequestText(targetUrl: string, opts?: Record<string, unknown>, body?: unknown): Promise<string> {
    return services.requestText(targetUrl, opts, body, {
      http: options.http,
      https: options.https,
    });
  }

  const requestRuntime = createRequestRuntime({ requestText: baseRequestText });

  function requestText(targetUrl: string, opts?: Record<string, unknown>, body?: unknown): Promise<string> {
    return requestRuntime.requestText(targetUrl, opts, body);
  }

  async function requestJson(targetUrl: string, opts?: Record<string, unknown>, body?: unknown): Promise<unknown> {
    return services.requestJson(targetUrl, opts, body, { requestText });
  }

  function qqCookieObject(): Record<string, unknown> {
    return services.parseCookieString(options.getQQCookie());
  }

  function qqCookieUin(obj?: Record<string, unknown>): unknown {
    return services.qqCookieUin(obj || qqCookieObject());
  }

  function qqCookieMusicKey(obj?: Record<string, unknown>): unknown {
    return services.qqCookieMusicKey(obj || qqCookieObject());
  }

  function qqCookiePlaybackKey(obj?: Record<string, unknown>): unknown {
    return services.qqCookiePlaybackKey(obj || qqCookieObject());
  }

  async function qqMusicRequest(payload: unknown, opts?: { cookie?: boolean }): Promise<unknown> {
    return services.requestQQMusicJson({
      payload,
      url: QQ_MUSICU_URL,
      baseHeaders: qqHeaders,
      cookie: options.getQQCookie(),
      includeCookie: !!(opts && opts.cookie),
      requestText,
    });
  }

  async function getQQLoginInfo(): Promise<unknown> {
    return services.fetchQQLoginInfo({
      getQQCookie: options.getQQCookie,
      qqCookieObject,
      qqCookieUin,
      qqCookieMusicKey,
      normalizeQQProfile: (body: unknown, cookieObj: Record<string, unknown>) => (
        services.normalizeQQProfile(body, cookieObj, !!options.getQQCookie())
      ),
      buildQQProfileUrl: services.buildQQProfileUrl,
      parseJSONText: services.parseJSONText,
      requestText,
      baseHeaders: qqHeaders,
      logger: options.logger,
    });
  }

  async function qqGetJSON(targetUrl: string, params: unknown, opts?: Record<string, any>): Promise<unknown> {
    const resolved = opts || {};
    return services.requestQQGetJson({
      url: targetUrl,
      params,
      baseHeaders: qqHeaders,
      headers: resolved.headers || {},
      cookie: options.getQQCookie(),
      includeCookie: resolved.cookie !== false,
      requestText,
    });
  }

  async function qqSmartboxSearch(keywords: string, limit: unknown): Promise<unknown> {
    return services.requestQQSmartboxSearch({
      keywords,
      limit,
      url: QQ_SMARTBOX_URL,
      headers: qqHeaders,
      requestText,
    });
  }

  async function qqSongDetail(mid: unknown, fallback: unknown): Promise<unknown> {
    if (!mid) return fallback;
    const json = await qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      songinfo: {
        module: 'music.pf_song_detail_svr',
        method: 'get_song_detail_yqq',
        param: { song_mid: mid },
      },
    });
    const data = json && (json as any).songinfo && (json as any).songinfo.data;
    return services.mapQQTrack(data && data.track_info, fallback);
  }

  return {
    requestRuntime,
    requestText,
    requestJson,
    qqCookieObject,
    qqCookieUin,
    qqCookieMusicKey,
    qqCookiePlaybackKey,
    qqMusicRequest,
    getQQLoginInfo,
    qqGetJSON,
    qqSmartboxSearch,
    qqSongDetail,
    qqHeaders,
  };
}
