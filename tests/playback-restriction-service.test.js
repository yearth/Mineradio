const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyNeteasePlaybackRestriction,
  classifyQQPlaybackRestriction,
  playbackRestriction,
} = require('../server-dist/server/services/playback-restriction');

test('playbackRestriction builds legacy restriction payloads', () => {
  assert.deepEqual(playbackRestriction('netease', 'custom', 'Message'), {
    provider: 'netease',
    category: 'custom',
    action: '',
    message: 'Message',
  });
  assert.deepEqual(playbackRestriction('qq', 'custom', 'Message', 'login', { code: 1 }), {
    provider: 'qq',
    category: 'custom',
    action: 'login',
    message: 'Message',
    code: 1,
  });
});

test('classifyNeteasePlaybackRestriction preserves legacy categories', () => {
  assert.deepEqual(classifyNeteasePlaybackRestriction({ code: 401, fee: 0 }, null), {
    provider: 'netease',
    category: 'login_required',
    action: 'login',
    message: '网易云需要登录后尝试获取完整播放地址',
    code: 401,
    fee: 0,
  });
  assert.equal(classifyNeteasePlaybackRestriction({ code: 200, fee: 0, freeTrialInfo: {} }, { loggedIn: true }).category, 'trial_only');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 200, fee: 1 }, { loggedIn: true }).category, 'vip_required');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 200, fee: 4 }, { loggedIn: true }).category, 'paid_required');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 200, fee: 8 }, { loggedIn: true }).action, 'purchase');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 403, fee: 0 }, { loggedIn: true }).category, 'copyright_unavailable');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 404, fee: 0 }, { loggedIn: true }).action, 'switch_source');
  assert.equal(classifyNeteasePlaybackRestriction({ code: 0, fee: 0 }, { loggedIn: true }).category, 'url_unavailable');
});

test('classifyQQPlaybackRestriction preserves session and authorization categories', () => {
  assert.deepEqual(classifyQQPlaybackRestriction({ code: 104003, msg: 'need auth' }, false), {
    provider: 'qq',
    category: 'login_required',
    action: 'login',
    message: 'QQ 音乐需要登录或授权后才能获取播放地址',
    code: 104003,
    rawMessage: 'need auth',
  });
  assert.deepEqual(classifyQQPlaybackRestriction({ result: 104003, tips: 'web session only' }, { hasSession: true, hasPlaybackKey: false }), {
    provider: 'qq',
    category: 'login_required',
    action: 'login',
    message: 'QQ 音乐当前只拿到了网页登录状态，还缺少播放授权，请重新打开官方 QQ 音乐登录窗口完成授权',
    code: 104003,
    rawMessage: 'web session only',
    missingPlaybackKey: true,
  });
  assert.equal(classifyQQPlaybackRestriction({ errtype: 104003, errmsg: 'no url' }, { hasSession: true, hasPlaybackKey: true }).category, 'copyright_unavailable');
});

test('classifyQQPlaybackRestriction preserves paid, provider error, and fallback categories', () => {
  assert.equal(classifyQQPlaybackRestriction({ code: 0, message: 'VIP required' }, true).category, 'paid_required');
  assert.equal(classifyQQPlaybackRestriction({ code: 2001, msg: 'region blocked' }, true).message, 'region blocked');
  assert.deepEqual(classifyQQPlaybackRestriction({}, { hasSession: true, hasPlaybackKey: true }), {
    provider: 'qq',
    category: 'url_unavailable',
    action: 'switch_source',
    message: 'QQ 音乐没有返回播放地址，可能受版权、会员或官方客户端限制',
    code: 0,
    rawMessage: '',
  });
});
