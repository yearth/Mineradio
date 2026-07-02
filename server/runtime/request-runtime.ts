export type RequestText = (targetUrl: string, opts?: Record<string, any>, body?: unknown) => Promise<string>;

export type RequestRuntime = {
  requestText: RequestText;
  setRequestText: (fn: RequestText | null | undefined) => void;
  reset: () => void;
};

export function createRequestRuntime(options: { requestText: RequestText }): RequestRuntime {
  let override: RequestText | null = null;

  return {
    requestText(targetUrl: string, opts?: Record<string, any>, body?: unknown): Promise<string> {
      if (override) return override(targetUrl, opts || {}, body);
      return options.requestText(targetUrl, opts, body);
    },
    setRequestText(fn: RequestText | null | undefined): void {
      override = typeof fn === 'function' ? fn : null;
    },
    reset(): void {
      override = null;
    },
  };
}
