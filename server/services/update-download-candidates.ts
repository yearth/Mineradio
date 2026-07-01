export interface DownloadCandidate {
  readonly url: string;
  readonly label: string;
  readonly mirrored: boolean;
}

export interface DownloadCandidateOptions {
  readonly mirrors?: readonly unknown[];
  readonly preferMirrors?: boolean;
  readonly useMirrors?: boolean;
}

export function buildMirrorUrl(originalUrl: unknown, mirror: unknown): string {
  const source = String(originalUrl || '').trim();
  const base = String(mirror || '').trim();
  if (!/^https?:\/\//i.test(source) || !/^https?:\/\//i.test(base)) return '';
  if (base.includes('{encodedUrl}')) return base.replace(/\{encodedUrl\}/g, encodeURIComponent(source));
  if (base.includes('{url}')) return base.replace(/\{url\}/g, source);
  return base.replace(/\/+$/, '/') + source;
}

export function uniqueDownloadCandidates(urls: unknown, opts: DownloadCandidateOptions = {}): DownloadCandidate[] {
  const directUrls = (Array.isArray(urls) ? urls : [urls])
    .map(url => String(url || '').trim())
    .filter(url => /^https?:\/\//i.test(url));
  const directSet = new Set(directUrls.map(url => url.toLowerCase()));
  const mirrors = opts.useMirrors === false ? [] : (opts.mirrors || []);
  const mirrored: DownloadCandidate[] = [];

  directUrls.forEach(source => {
    mirrors.forEach((mirror, index) => {
      const url = buildMirrorUrl(source, mirror);
      if (url) {
        mirrored.push({
          url,
          label: '国内加速线路 ' + (index + 1),
          mirrored: true,
        });
      }
    });
  });

  const direct = directUrls.map(url => ({
    url,
    label: directSet.has(url.toLowerCase()) ? 'GitHub 直连' : '下载线路',
    mirrored: false,
  }));
  const ordered = opts.preferMirrors === false ? direct.concat(mirrored) : mirrored.concat(direct);
  const seen = new Set<string>();

  return ordered.filter(item => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
