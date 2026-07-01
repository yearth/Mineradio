export interface RouteDescriptor {
  readonly method: 'ANY';
  readonly path: string;
  readonly owner: string;
}

export const routeOwners = [
  'app',
  'update',
  'beatmap',
  'discover',
  'weather',
  'netease',
  'qq',
  'podcast',
  'media'
] as const;

type RouteOwner = (typeof routeOwners)[number];

const apiRoute = (path: string, owner: RouteOwner): RouteDescriptor => ({
  method: 'ANY',
  path,
  owner
});

export const routeDescriptors: RouteDescriptor[] = [
  apiRoute('/api/app/version', 'app'),

  apiRoute('/api/update/latest', 'update'),
  apiRoute('/api/update/download', 'update'),
  apiRoute('/api/update/download/status', 'update'),
  apiRoute('/api/update/patch', 'update'),
  apiRoute('/api/update/patch/status', 'update'),

  apiRoute('/api/beatmap/cache/status', 'beatmap'),
  apiRoute('/api/beatmap/cache', 'beatmap'),

  apiRoute('/api/discover/home', 'discover'),
  apiRoute('/api/weather/radio', 'weather'),
  apiRoute('/api/weather/ip-location', 'weather'),

  apiRoute('/api/search', 'netease'),
  apiRoute('/api/song/url', 'netease'),
  apiRoute('/api/login/cookie', 'netease'),
  apiRoute('/api/login/qr/key', 'netease'),
  apiRoute('/api/login/qr/create', 'netease'),
  apiRoute('/api/login/qr/check', 'netease'),
  apiRoute('/api/login/status', 'netease'),
  apiRoute('/api/logout', 'netease'),
  apiRoute('/api/user/playlists', 'netease'),
  apiRoute('/api/song/like/check', 'netease'),
  apiRoute('/api/song/like', 'netease'),
  apiRoute('/api/playlist/create', 'netease'),
  apiRoute('/api/playlist/add-song', 'netease'),
  apiRoute('/api/lyric', 'netease'),
  apiRoute('/api/song/comments', 'netease'),
  apiRoute('/api/artist/detail', 'netease'),
  apiRoute('/api/playlist/tracks', 'netease'),

  apiRoute('/api/qq/search', 'qq'),
  apiRoute('/api/qq/song/url', 'qq'),
  apiRoute('/api/qq/lyric', 'qq'),
  apiRoute('/api/qq/login/status', 'qq'),
  apiRoute('/api/qq/login/cookie', 'qq'),
  apiRoute('/api/qq/logout', 'qq'),
  apiRoute('/api/qq/user/playlists', 'qq'),
  apiRoute('/api/qq/playlist/tracks', 'qq'),
  apiRoute('/api/qq/artist/detail', 'qq'),
  apiRoute('/api/qq/song/comments', 'qq'),

  apiRoute('/api/podcast/search', 'podcast'),
  apiRoute('/api/podcast/hot', 'podcast'),
  apiRoute('/api/podcast/detail', 'podcast'),
  apiRoute('/api/podcast/programs', 'podcast'),
  apiRoute('/api/podcast/my', 'podcast'),
  apiRoute('/api/podcast/my/items', 'podcast'),
  apiRoute('/api/podcast/dj-beatmap', 'podcast'),

  apiRoute('/api/cover', 'media'),
  apiRoute('/api/audio', 'media')
];
