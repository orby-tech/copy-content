const test = require('node:test');
const assert = require('node:assert/strict');
const { prependTitleUrl } = require('./extractors.js');

test('prependTitleUrl: markdown format wraps title and url as link', () => {
  const out = prependTitleUrl('body', 'My Page', 'https://example.com', 'markdown');
  assert.equal(out, '[My Page](https://example.com)\n\nbody');
});

test('prependTitleUrl: text format uses two lines', () => {
  const out = prependTitleUrl('body', 'My Page', 'https://example.com', 'text');
  assert.equal(out, 'My Page\nhttps://example.com\n\nbody');
});

test('prependTitleUrl: missing title uses URL as link text in markdown', () => {
  const out = prependTitleUrl('body', '', 'https://example.com', 'markdown');
  assert.equal(out, '[https://example.com](https://example.com)\n\nbody');
});

test('prependTitleUrl: missing title in text mode emits only URL line', () => {
  const out = prependTitleUrl('body', '', 'https://example.com', 'text');
  assert.equal(out, 'https://example.com\n\nbody');
});

test('prependTitleUrl: missing URL returns content unchanged', () => {
  const out = prependTitleUrl('body', 'My Page', '', 'markdown');
  assert.equal(out, 'body');
});

test('prependTitleUrl: empty content returns header only', () => {
  const out = prependTitleUrl('', 'My Page', 'https://example.com', 'markdown');
  assert.equal(out, '[My Page](https://example.com)');
});

test('prependTitleUrl: trims surrounding whitespace in title and url', () => {
  const out = prependTitleUrl('body', '  Title  ', '  https://example.com  ', 'markdown');
  assert.equal(out, '[Title](https://example.com)\n\nbody');
});

test('prependTitleUrl: null/undefined inputs do not throw', () => {
  assert.equal(prependTitleUrl('body', null, null, 'markdown'), 'body');
  assert.equal(prependTitleUrl('body', undefined, undefined, 'text'), 'body');
});
