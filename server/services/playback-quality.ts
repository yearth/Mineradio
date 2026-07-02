export const NETEASE_QUALITY_CANDIDATES = [
  { level: 'jymaster', br: 1999000, label: '超清母带', svip: true },
  { level: 'hires', br: 1999000, label: '高清臻音' },
  { level: 'lossless', br: 1411000, label: '无损' },
  { level: 'exhigh', br: 999000, label: '极高' },
  { level: 'standard', br: 128000, label: '标准' },
];

export const QQ_QUALITY_CANDIDATE_TEMPLATES = [
  { prefix: 'RS01', ext: '.flac', level: 'hires', label: 'Hi-Res FLAC' },
  { prefix: 'F000', ext: '.flac', level: 'lossless', label: '无损 FLAC' },
  { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: '320k MP3' },
  { prefix: 'M500', ext: '.mp3', level: 'standard', label: '128k MP3' },
  { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'AAC/M4A' },
];

export function normalizeQualityPreference(value: unknown): string {
  const raw = String(value || '').toLowerCase().trim();
  if (['jymaster', 'master', 'studio', 'svip'].includes(raw)) return 'jymaster';
  if (['hires', 'hi-res', 'highres', 'zhenyin', 'spatial'].includes(raw)) return 'hires';
  if (['lossless', 'flac', 'sq'].includes(raw)) return 'lossless';
  if (['exhigh', 'high', '320', '320k', 'hq'].includes(raw)) return 'exhigh';
  if (['standard', 'normal', '128', '128k', 'std'].includes(raw)) return 'standard';
  return 'hires';
}

export function qualityCandidatesFrom<T extends { level: string }>(target: unknown, candidates: T[]): T[] {
  const normalized = normalizeQualityPreference(target);
  let start = candidates.findIndex(item => item.level === normalized);
  if (start < 0) start = 0;
  return candidates.slice(start);
}

export function hasNeteaseSvip(loginInfo: any): boolean {
  return !!(loginInfo && loginInfo.loggedIn && (loginInfo.vipLevel === 'svip' || loginInfo.isSvip || Number(loginInfo.vipType || 0) >= 10));
}

export function qqVkeyFileCandidates(songmid: unknown, mediaMid: unknown, qualityPreference: unknown): Record<string, unknown> {
  const requestedQuality = normalizeQualityPreference(qualityPreference);
  const fileMediaMid = String(mediaMid || '').trim();
  const normalizedSongMid = String(songmid || '').trim();
  const mediaIds: string[] = [];
  if (fileMediaMid) mediaIds.push(fileMediaMid);
  if (normalizedSongMid && !mediaIds.includes(normalizedSongMid)) mediaIds.push(normalizedSongMid);
  const fileCandidates = mediaIds.flatMap(mediaId =>
    qualityCandidatesFrom(requestedQuality, QQ_QUALITY_CANDIDATE_TEMPLATES)
      .map(item => ({ ...item, mediaId, filename: item.prefix + mediaId + item.ext }))
  );
  return {
    requestedQuality,
    fileCandidates,
    filenames: fileCandidates.map(item => item.filename),
  };
}
