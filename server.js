const {
  createMineradioServerEntry,
} = require('./server-dist/server/server-entry');

const entry = createMineradioServerEntry({
  rootDir: __dirname,
  env: process.env,
  getFetch: () => fetch,
});

module.exports = entry.server;
if (process.env.NODE_ENV === 'test') {
  module.exports.__test = entry.testRuntime;
}
