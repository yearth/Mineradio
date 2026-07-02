const test = require('node:test');
const assert = require('node:assert/strict');

const {
  audioContentTypeForUrl,
  audioProxyHeadersFor,
  mapQQComment,
  mapQQPlaylist,
  parseJSONText,
} = require('../server-dist/server/services/qq-utils');

test('parseJSONText preserves JSON and callback wrapper parsing', () => {
  assert.deepEqual(parseJSONText(' {"code":0} '), { code: 0 });
  assert.deepEqual(parseJSONText('callback({"data":{"id":1}});'), { data: { id: 1 } });
});

test('audio proxy helpers preserve referer, range, and content type fallbacks', () => {
  assert.deepEqual(audioProxyHeadersFor('https://ws.stream.qqmusic.qq.com/file.m4a', 'bytes=0-99', 'UA'), {
    'User-Agent': 'UA',
    Referer: 'https://y.qq.com/',
    Range: 'bytes=0-99',
  });
  assert.deepEqual(audioProxyHeadersFor('https://music.163.com/song.mp3', '', 'UA'), {
    'User-Agent': 'UA',
    Referer: 'https://music.163.com/',
  });
  assert.equal(audioContentTypeForUrl('https://cdn.example/song.flac', 'audio/unknown'), 'audio/flac');
  assert.equal(audioContentTypeForUrl('bad-url', 'audio/aac'), 'audio/aac');
  assert.equal(audioContentTypeForUrl('bad-url', ''), 'audio/mpeg');
});

test('mapQQPlaylist preserves legacy created and collected playlist mapping', () => {
  assert.deepEqual(mapQQPlaylist({
    dissid: 123,
    diss_name: 'QQ List',
    diss_cover: 'https://img.example/list.jpg',
    songnum: 9,
    visitnum: 88,
    nick: 'Owner',
  }, 'collect'), {
    provider: 'qq',
    source: 'qq',
    id: '123',
    name: 'QQ List',
    cover: 'https://img.example/list.jpg',
    trackCount: 9,
    playCount: 88,
    creator: 'Owner',
    subscribed: true,
    specialType: 0,
  });
});

test('mapQQComment preserves content, user, likes, and timestamp mapping', () => {
  assert.deepEqual(mapQQComment({
    commentid: 'c1',
    rootcommentcontent: 'Nice rain',
    praisenum: 7,
    time: 1700000000,
    user: { uin: 'u1', nick: 'Nested User', avatar: 'nested.jpg' },
  }), {
    id: 'c1',
    content: 'Nice rain',
    likedCount: 7,
    time: 1700000000000,
    user: {
      id: 'u1',
      nickname: 'Nested User',
      avatar: 'nested.jpg',
    },
  });
});
