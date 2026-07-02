declare function require(name: string): any;

const {
  classifyUpdateError: defaultClassifyUpdateError,
  updateError,
} = require('./update-errors');

export interface LocalUpdateFallbackOptions {
  readonly configured?: boolean;
  readonly preview?: boolean;
  readonly currentVersion: string;
  readonly fallbackNotes: readonly string[];
}

export interface FetchTextOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly fetchWithTimeout: (url: string, opts: any, timeoutMs: number) => Promise<any>;
  readonly classifyUpdateError?: (err: unknown) => { reason: string };
}

export function localUpdateFallback(reason: string, opts: LocalUpdateFallbackOptions) {
  const configured = !!(opts.configured != null ? opts.configured : false);
  return {
    configured,
    preview: opts.preview,
    updateAvailable: false,
    currentVersion: opts.currentVersion,
    latestVersion: opts.currentVersion,
    release: {
      tagName: 'v' + opts.currentVersion,
      name: 'Mineradio v' + opts.currentVersion,
      version: opts.currentVersion,
      htmlUrl: '',
      downloadUrl: '',
      summary: '当前版本，更新检测已就绪。',
      notes: opts.fallbackNotes,
    },
    reason: reason || '',
  };
}

export async function fetchTextFromCandidates(candidates: any, opts: FetchTextOptions) {
  const list = Array.isArray(candidates) && candidates.length ? candidates : [];
  const failures: string[] = [];
  const timeoutMs = opts.timeoutMs || 6500;
  const classifyUpdateError = opts.classifyUpdateError || defaultClassifyUpdateError;
  for (let i = 0; i < list.length; i += 1) {
    const candidate = list[i];
    try {
      const resp = await opts.fetchWithTimeout(candidate.url, {
        headers: { 'User-Agent': opts.userAgent || '' },
      }, timeoutMs);
      if (!resp.ok) throw updateError('HTTP_' + resp.status, 'HTTP ' + resp.status);
      return { text: await resp.text(), candidate };
    } catch (err) {
      const info = classifyUpdateError(err);
      failures.push(candidate.label + ': ' + info.reason);
    }
  }
  throw updateError('UPDATE_ALL_LINES_FAILED', failures.join('；') || 'All update lines failed');
}
