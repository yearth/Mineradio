type Logger = Pick<Console, 'warn'>;

type PodcastDeps = {
  cloudsearch: (opts: Record<string, unknown>) => Promise<any>;
  djHot: (opts: Record<string, unknown>) => Promise<any>;
  djDetail: (opts: Record<string, unknown>) => Promise<any>;
  djProgram: (opts: Record<string, unknown>) => Promise<any>;
  mapPodcastRadio: (item: any) => any;
  mapPodcastProgram: (item: any, radio: any) => any;
  getLoginInfo: () => Promise<any>;
  fetchMyPodcastItems: (key: string, info: any, limit: number, offset: number) => Promise<any>;
  podcastCollectionMeta: (key: string, items: any[]) => any;
  userCookie: string;
  timestamp: () => number;
  logger?: Logger;
};

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, parseInt(String(raw || fallback), 10) || fallback));
}

export async function fetchPodcastSearch(
  keywords: unknown,
  limit: unknown,
  deps: Pick<PodcastDeps, 'cloudsearch' | 'mapPodcastRadio' | 'userCookie' | 'timestamp'>
): Promise<Record<string, unknown>> {
  const kw = String(keywords || '').trim();
  const normalizedLimit = clampInt(limit, 18, 6, 30);
  if (!kw) return { podcasts: [] };
  const r = await deps.cloudsearch({ keywords: kw, type: 1009, limit: normalizedLimit, cookie: deps.userCookie, timestamp: deps.timestamp() });
  const result = (r.body && r.body.result) || {};
  const raw = result.djRadios || result.djradios || result.radios || [];
  const podcasts = raw.map(deps.mapPodcastRadio).filter((podcast: any) => podcast.id);
  return { podcasts, total: result.djRadiosCount || result.djradiosCount || podcasts.length };
}

export async function fetchPodcastHot(
  limit: unknown,
  offset: unknown,
  deps: Pick<PodcastDeps, 'djHot' | 'mapPodcastRadio' | 'userCookie' | 'timestamp'>
): Promise<Record<string, unknown>> {
  const normalizedLimit = clampInt(limit, 18, 6, 30);
  const normalizedOffset = Math.max(0, parseInt(String(offset || '0'), 10) || 0);
  const r = await deps.djHot({ limit: normalizedLimit, offset: normalizedOffset, cookie: deps.userCookie, timestamp: deps.timestamp() });
  const body = r.body || {};
  const raw = body.djRadios || body.djradios || body.radios || body.data || [];
  const podcasts = (Array.isArray(raw) ? raw : []).map(deps.mapPodcastRadio).filter((podcast: any) => podcast.id);
  return { podcasts, more: !!body.hasMore };
}

export async function fetchPodcastDetail(
  rid: string,
  deps: Pick<PodcastDeps, 'djDetail' | 'mapPodcastRadio' | 'userCookie' | 'timestamp'>
): Promise<Record<string, unknown>> {
  const r = await deps.djDetail({ rid, cookie: deps.userCookie, timestamp: deps.timestamp() });
  const body = r.body || {};
  const radio = deps.mapPodcastRadio(body.data || body.djRadio || body.radio || body);
  return { podcast: radio };
}

export async function fetchPodcastPrograms(
  rid: string,
  limit: unknown,
  offset: unknown,
  deps: Pick<PodcastDeps, 'djProgram' | 'mapPodcastRadio' | 'mapPodcastProgram' | 'userCookie' | 'timestamp'>
): Promise<Record<string, unknown>> {
  const normalizedLimit = clampInt(limit, 30, 10, 60);
  const normalizedOffset = Math.max(0, parseInt(String(offset || '0'), 10) || 0);
  const r = await deps.djProgram({ rid, limit: normalizedLimit, offset: normalizedOffset, asc: false, cookie: deps.userCookie, timestamp: deps.timestamp() });
  const body = r.body || {};
  const raw = body.programs || (body.data && (body.data.list || body.data.programs)) || [];
  const radio = raw[0] && raw[0].radio ? deps.mapPodcastRadio(raw[0].radio) : { id: rid, rid };
  const programs = (Array.isArray(raw) ? raw : [])
    .map((program: any) => deps.mapPodcastProgram(program, radio))
    .filter((program: any) => program.id && program.name);
  return { radio, programs, more: !!body.more, total: body.count || programs.length };
}

export async function fetchUserPodcastCollections(
  deps: Pick<PodcastDeps, 'getLoginInfo' | 'fetchMyPodcastItems' | 'podcastCollectionMeta' | 'logger'>
): Promise<Record<string, unknown>> {
  const info = await deps.getLoginInfo();
  const keys = ['collect', 'created', 'liked'];
  if (!info.loggedIn || !info.userId) {
    return { loggedIn: false, collections: keys.map(key => deps.podcastCollectionMeta(key, [])) };
  }
  const logger = deps.logger || console;
  const collections = await Promise.all(keys.map(async key => {
    try {
      const data = await deps.fetchMyPodcastItems(key, info, 12, 0);
      return deps.podcastCollectionMeta(key, data.items || []);
    } catch (err: any) {
      logger.warn('[MyPodcast]', key, err.message);
      return deps.podcastCollectionMeta(key, []);
    }
  }));
  return { loggedIn: true, collections };
}

export async function fetchUserPodcastCollectionItems(
  key: string,
  limit: number,
  offset: number,
  deps: Pick<PodcastDeps, 'getLoginInfo' | 'fetchMyPodcastItems' | 'podcastCollectionMeta'>
): Promise<Record<string, unknown>> {
  const info = await deps.getLoginInfo();
  if (!info.loggedIn || !info.userId) return { loggedIn: false, items: [] };
  const data = await deps.fetchMyPodcastItems(key, info, limit, offset);
  return {
    loggedIn: true,
    key,
    ...deps.podcastCollectionMeta(key, data.items || []),
    itemType: data.itemType,
    items: data.items || [],
  };
}
