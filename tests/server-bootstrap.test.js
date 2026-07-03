const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createServerBootstrap,
} = require('../server-dist/server/server-bootstrap');

test('createServerBootstrap wires request dispatch and listen lifecycle', async () => {
  const events = [];
  const server = { name: 'server' };
  const routeDependencies = { name: 'routes' };
  const env = { NODE_ENV: 'production' };
  const route = {
    req: { url: '/api/search?keywords=rain' },
    res: { name: 'res' },
    url: new URL('http://localhost:1234/api/search?keywords=rain'),
    pathname: '/api/search',
  };
  let capturedHandleRequest;

  const created = createServerBootstrap({
    port: 1234,
    host: '127.0.0.1',
    env,
    hasUserCookie: true,
    routeDependencies,
    createServer: requestHandler => {
      events.push(['createServer', requestHandler]);
      return server;
    },
    createHttpServer: options => {
      events.push(['createHttpServer', options.createServer, options.requestHandler]);
      return options.createServer(options.requestHandler);
    },
    createRequestHandler: options => {
      capturedHandleRequest = options.handleRequest;
      events.push(['createRequestHandler', options.port]);
      return 'request-handler';
    },
    dispatchRootRoute: async (request, deps) => {
      events.push(['dispatchRootRoute', request, deps]);
      return true;
    },
    listenIfNeeded: options => {
      events.push(['listenIfNeeded', options.server, options.env, options.port, options.host, options.hasUserCookie]);
      return true;
    },
  });

  assert.equal(created, server);
  assert.deepEqual(events.slice(0, 4), [
    ['createRequestHandler', 1234],
    ['createHttpServer', events[1][1], 'request-handler'],
    ['createServer', 'request-handler'],
    ['listenIfNeeded', server, env, 1234, '127.0.0.1', true],
  ]);

  assert.equal(await capturedHandleRequest(route), true);
  assert.deepEqual(events.at(-1), [
    'dispatchRootRoute',
    {
      pathname: '/api/search',
      url: route.url,
      req: route.req,
      res: route.res,
    },
    routeDependencies,
  ]);
});
