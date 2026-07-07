const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSessionRuntime,
} = require('../server-dist/server/runtime/session-runtime');

function fakeCookieRuntime(initial = {}) {
  const calls = [];
  let userCookie = initial.userCookie || '';
  let qqCookie = initial.qqCookie || '';
  return {
    calls,
    runtime: {
      userCookie() {
        calls.push(['userCookie']);
        return userCookie;
      },
      qqCookie() {
        calls.push(['qqCookie']);
        return qqCookie;
      },
      saveCookie(value) {
        calls.push(['saveCookie', value]);
        userCookie = String(value || '').trim();
      },
      saveQQCookie(value) {
        calls.push(['saveQQCookie', value]);
        qqCookie = String(value || '').trim();
      },
      reset() {
        calls.push(['reset']);
        userCookie = '';
        qqCookie = '';
      },
    },
  };
}

test('createSessionRuntime exposes legacy session facade without freezing cookie state', () => {
  const fake = fakeCookieRuntime({
    userCookie: 'MUSIC_U=old',
    qqCookie: 'uin=1',
  });
  const session = createSessionRuntime(fake.runtime);
  const {
    currentUserCookie,
    currentQQCookie,
    saveCookie,
    saveQQCookie,
  } = session;

  assert.deepEqual(Object.keys(session), [
    'currentUserCookie',
    'currentQQCookie',
    'saveCookie',
    'saveQQCookie',
    'reset',
  ]);
  assert.equal(currentUserCookie(), 'MUSIC_U=old');
  assert.equal(currentQQCookie(), 'uin=1');

  saveCookie(' MUSIC_U=new ');
  saveQQCookie(' uin=2 ');

  assert.equal(currentUserCookie(), 'MUSIC_U=new');
  assert.equal(currentQQCookie(), 'uin=2');
  assert.deepEqual(fake.calls, [
    ['userCookie'],
    ['qqCookie'],
    ['saveCookie', ' MUSIC_U=new '],
    ['saveQQCookie', ' uin=2 '],
    ['userCookie'],
    ['qqCookie'],
  ]);
});

test('createSessionRuntime delegates reset to the cookie runtime', () => {
  const fake = fakeCookieRuntime({
    userCookie: 'MUSIC_U=old',
    qqCookie: 'uin=1',
  });
  const session = createSessionRuntime(fake.runtime);

  session.reset();

  assert.equal(session.currentUserCookie(), '');
  assert.equal(session.currentQQCookie(), '');
  assert.deepEqual(fake.calls, [
    ['reset'],
    ['userCookie'],
    ['qqCookie'],
  ]);
});
