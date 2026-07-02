declare function require(name: string): any;
declare const Buffer: any;
declare const URL: any;

const defaultHttp = require('http');
const defaultHttps = require('https');

export interface RequestClientDeps {
  readonly http?: any;
  readonly https?: any;
  readonly requestText?: (targetUrl: string, opts?: any, body?: any) => Promise<string>;
  readonly timeoutMs?: number;
}

export function requestText(targetUrl: string, opts?: any, body?: any, deps: RequestClientDeps = {}): Promise<string> {
  opts = opts || {};
  const http = deps.http || defaultHttp;
  const https = deps.https || defaultHttps;
  const timeoutMs = deps.timeoutMs || 10000;
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, (response: any) => {
      const chunks: any[] = [];
      response.on('data', (chunk: any) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode >= 400) {
          const err: any = new Error('HTTP ' + response.statusCode);
          err.statusCode = response.statusCode;
          err.body = text;
          reject(err);
          return;
        }
        resolve(text);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function requestJson(targetUrl: string, opts?: any, body?: any, deps?: RequestClientDeps): Promise<any> {
  const readText = deps && deps.requestText || ((url: string, requestOpts?: any, requestBody?: any) => requestText(url, requestOpts, requestBody, deps));
  const text = await readText(targetUrl, opts, body);
  try {
    return JSON.parse(text);
  } catch (e: any) {
    const err: any = new Error('Invalid JSON from ' + targetUrl);
    err.cause = e;
    throw err;
  }
}
