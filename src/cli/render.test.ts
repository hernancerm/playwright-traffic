import { deepStrictEqual as assertEquals } from 'node:assert';
import { test } from 'node:test';
import { render } from './render.ts';

const get = { method: 'GET', url: 'https://x.test/1' };

test('renders a json response', () => {
  const out = render({
    ...get,
    status: 200,
    headers: { 'content-type': ['application/json'] },
    body: '{"id":42,"name":"Martín"}',
  });
  assertEquals(
    out,
    [
      '# ✓ 200 OK',
      '',
      'GET https://x.test/1',
      '',
      '```json',
      '{\n  "id": 42,\n  "name": "Martín"\n}',
      '```',
      '',
      'Response headers{{{',
      '```http',
      'content-type: application/json',
      '```',
      '}}}',
      '',
    ].join('\n'),
  );
});

test('repeated headers each get a line', () => {
  const out = render({ ...get, status: 204, headers: { 'set-cookie': ['a=1', 'b=2'] }, body: '' });
  assertEquals(out.includes('set-cookie: a=1\nset-cookie: b=2'), true);
  assertEquals(out.includes('(empty body)'), true);
});

test('non-json body uses a plain fence', () => {
  const out = render({ ...get, status: 404, headers: {}, body: 'not found' });
  assertEquals(out.startsWith('# ✗ 404 Not Found'), true);
  assertEquals(out.includes('```\nnot found\n```'), true);
});

test('no response says so', () => {
  assertEquals(
    render({ ...get, status: 0, headers: {}, body: '' }).startsWith('# ✗ (no response)'),
    true,
  );
  assertEquals(
    render({ ...get, status: -1, headers: {}, body: '' }).startsWith('# ✗ (no response)'),
    true,
  );
});

test('request folds appear only when there is something to show', () => {
  const plain = render({ ...get, status: 200, headers: {}, body: '', request: { headers: [] } });
  assertEquals(plain.includes('Request headers'), false);
  assertEquals(plain.includes('Request body'), false);

  const post = render({
    status: 201,
    method: 'POST',
    url: 'https://x.test/todos',
    headers: {},
    body: '',
    request: { headers: ['content-type: application/json'], body: '{"a":1}' },
  });
  assertEquals(post.includes('Request headers{{{\n```http\ncontent-type: application/json'), true);
  assertEquals(post.includes('Request body{{{\n```json\n{\n  "a": 1\n}'), true);
});

test('body comes before headers on both sides', () => {
  const out = render({
    status: 201,
    method: 'POST',
    url: 'https://x.test/todos',
    headers: { 'content-type': ['application/json'] },
    body: '{"id":1}',
    request: { headers: ['content-type: application/json'], body: '{"a":1}' },
  });
  const lines = out.split('\n');
  const folds = lines.filter((l) => l.endsWith('{{{')).map((l) => l.slice(0, -3));
  assertEquals(folds, ['Request body', 'Request headers', 'Response headers']);
  // The response body is not folded, so its place is fixed by what follows it.
  assertEquals(lines.indexOf('  "id": 1') < lines.indexOf('Response headers{{{'), true);
});
