declare function require(id: string): { extname(filePath: string): string; join(...parts: string[]): string };

const path = require('path');

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

export function contentTypeForPath(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath)] || 'text/plain';
}

export function resolveStaticFilePath(pathname: string, appRoot: string): string {
  if (pathname === '/favicon.ico') {
    return path.join(appRoot, 'build', 'icon.ico');
  }

  const publicPath = pathname === '/' ? '/index.html' : pathname;
  return path.join(appRoot, 'public', publicPath);
}

export interface StaticResponse {
  writeHead(status: number, headers?: Record<string, string>): unknown;
  end(body: unknown): unknown;
}

export interface StaticFileReader {
  readFile(filePath: string, callback: (err: unknown, data?: unknown) => void): unknown;
}

export function serveStatic(res: StaticResponse, filePath: string, fileReader: StaticFileReader): Promise<void> {
  return new Promise(resolve => {
    fileReader.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        resolve();
        return;
      }

      res.writeHead(200, { 'Content-Type': contentTypeForPath(filePath) });
      res.end(data);
      resolve();
    });
  });
}
