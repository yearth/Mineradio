const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decodeHtmlEntities,
  decodeQQLyricText,
  normalizeQQSongId,
} = require('../server-dist/server/services/lyric-utils');

test('decodeHtmlEntities preserves legacy lyric entity decoding', () => {
  assert.equal(
    decodeHtmlEntities('Rain &amp; Snow &lt;tag&gt; &quot;quoted&quot; &apos;solo&apos; &nbsp;&#x4e2d;&#22269;'),
    'Rain & Snow <tag> "quoted" \'solo\'  中国'
  );
  assert.equal(decodeHtmlEntities(null), '');
});

test('decodeQQLyricText preserves base64, entity, newline, and empty fallbacks', () => {
  const encoded = Buffer.from('\uFEFF[00:00.00]QQ &amp; Rain\r\n[00:01.00]雨').toString('base64');
  assert.equal(decodeQQLyricText(encoded), '[00:00.00]QQ & Rain\n[00:01.00]雨');
  assert.equal(decodeQQLyricText('[00:00.00]Tom &amp; Jerry\r\n'), '[00:00.00]Tom & Jerry');
  assert.equal(decodeQQLyricText(''), '');
});

test('normalizeQQSongId preserves legacy numeric id extraction', () => {
  assert.equal(normalizeQQSongId('song-12001'), 12001);
  assert.equal(normalizeQQSongId(0), 0);
  assert.equal(normalizeQQSongId('abc'), 0);
});
