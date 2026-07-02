type HeaderMap = Record<string, string>;

export type MediaRouteContext = {
  pathname: string;
  url: URL;
  req: {
    headers: Record<string, any>;
  };
  res: {
    writeHead: (status: number, headers?: HeaderMap) => void;
    write: (chunk: any) => void;
    end: (chunk?: any) => void;
  };
  fetch: (targetUrl: string, opts: { headers: HeaderMap }) => Promise<any>;
  audioProxyHeadersFor: (audioUrl: string, range: string, userAgent: string) => HeaderMap;
  audioContentTypeForUrl: (audioUrl: string, upstreamType: unknown) => string;
  userAgent: string;
  logger: Pick<Console, 'error'>;
};

async function pipeResponseBody(body: any, res: MediaRouteContext['res']): Promise<void> {
  const reader = body.getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    res.write(chunk.value);
  }
  res.end();
}

export async function handleMediaRoutes(ctx: MediaRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/cover') {
    try {
      const coverUrl = ctx.url.searchParams.get('url');
      if (!coverUrl || !/^https?:\/\//i.test(coverUrl)) {
        ctx.res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
        ctx.res.end('Invalid cover url');
        return true;
      }
      const resp = await ctx.fetch(coverUrl, { headers: { 'User-Agent': ctx.userAgent, Referer: 'https://music.163.com/' } });
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const contentLength = resp.headers.get('content-length');
      const headers: HeaderMap = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'public, max-age=86400',
      };
      if (contentLength) headers['Content-Length'] = contentLength;
      ctx.res.writeHead(resp.status, headers);
      await pipeResponseBody(resp.body, ctx.res);
    } catch (err: any) {
      ctx.logger.error('[Cover]', err);
      ctx.res.writeHead(500);
      ctx.res.end();
    }
    return true;
  }

  if (ctx.pathname === '/api/audio') {
    try {
      const audioUrl = ctx.url.searchParams.get('url');
      if (!audioUrl) {
        ctx.res.writeHead(400);
        ctx.res.end('Missing url');
        return true;
      }
      const range = ctx.req.headers.range || '';
      const requestHeaders = ctx.audioProxyHeadersFor(audioUrl, range, ctx.userAgent);
      const upstream = await ctx.fetch(audioUrl, { headers: requestHeaders });
      const responseHeaders: HeaderMap = {
        'Content-Type': ctx.audioContentTypeForUrl(audioUrl, upstream.headers.get('content-type')),
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      };
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) responseHeaders['Content-Range'] = contentRange;
      ctx.res.writeHead(upstream.status, responseHeaders);
      await pipeResponseBody(upstream.body, ctx.res);
    } catch (err: any) {
      ctx.logger.error('[Audio]', err);
      ctx.res.writeHead(500);
      ctx.res.end();
    }
    return true;
  }

  return false;
}
