import { assertEquals } from '@std/assert';
import { render } from '../src/render.ts';
import { withoutLinkerVars } from '../src/env.ts';
import { parseHeaderDump } from '../src/headers.ts';
import { parseRequest } from '../src/request.ts';
import { tokenize } from '../src/tokenize.ts';

Deno.test('renders a json response', () => {
  const out = render({
    stats: { response_code: 200 },
    headers: { 'content-type': ['application/json'] },
    body: '{"id":42,"name":"Martín"}',
    raw: 'RAW',
  });
  assertEquals(
    out,
    [
      '# ✓ 200 OK',
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
      'Raw{{{',
      'RAW',
      '}}}',
      '',
    ].join('\n'),
  );
});

Deno.test('repeated headers each get a line', () => {
  const out = render({
    stats: { response_code: 204 },
    headers: { 'set-cookie': ['a=1', 'b=2'] },
    body: '',
    raw: '',
  });
  assertEquals(out.includes('set-cookie: a=1\nset-cookie: b=2'), true);
  assertEquals(out.includes('(empty body)'), true);
});

Deno.test('non-json body uses a plain fence', () => {
  const out = render({
    stats: { response_code: 404 },
    headers: {},
    body: 'not found',
    raw: '',
  });
  assertEquals(out.startsWith('# ✗ 404 Not Found'), true);
  assertEquals(out.includes('```\nnot found\n```'), true);
});

Deno.test('a failed transfer says why', () => {
  const out = render({
    stats: { response_code: 0, errormsg: 'Could not resolve host: nope' },
    headers: {},
    body: '',
    raw: '',
  });
  assertEquals(out.startsWith('# ✗ (no response) Could not resolve host: nope'), true);
});

Deno.test('tokenize handles quotes and continuations', () => {
  assertEquals(
    tokenize('curl -H \'X-Foo: a b\' -d "{\\"a\\": 1}" \\\n  https://x.test'),
    ['curl', '-H', 'X-Foo: a b', '-d', '{"a": 1}', 'https://x.test'],
  );
  assertEquals(tokenize("curl --data ''  url"), ['curl', '--data', '', 'url']);
});

Deno.test('the target line says what was called', () => {
  const out = render({
    stats: { response_code: 201, method: 'POST', url: 'https://x.test/todos' },
    headers: {},
    body: '',
    raw: '',
  });
  assertEquals(out.split('\n')[2], 'POST https://x.test/todos');
});

Deno.test('a redirect shows where it ended up', () => {
  const out = render({
    stats: {
      response_code: 200,
      method: 'GET',
      url: 'http://x.test/a',
      url_effective: 'https://x.test/b',
    },
    headers: {},
    body: '',
    raw: '',
  });
  assertEquals(out.includes('GET http://x.test/a\n-> https://x.test/b'), true);
});

Deno.test('request folds appear only when there is something to show', () => {
  const get = render({
    stats: { response_code: 200, method: 'GET', url: 'https://x.test/1' },
    headers: {},
    body: '',
    raw: '',
    request: { headers: [] },
  });
  assertEquals(get.includes('Request headers'), false);
  assertEquals(get.includes('Request body'), false);

  const post = render({
    stats: { response_code: 201, method: 'POST', url: 'https://x.test/todos' },
    headers: {},
    body: '',
    raw: '',
    request: { headers: ['Content-Type: application/json'], body: '{"a":1}' },
  });
  assertEquals(post.includes('Request headers{{{\n```http\nContent-Type: application/json'), true);
  assertEquals(post.includes('Request body{{{\n```json\n{\n  "a": 1\n}'), true);
});

Deno.test('parseRequest reads headers and every -d spelling', () => {
  assertEquals(
    parseRequest(['-H', 'A: 1', '--header', 'B: 2', '--data-raw', 'x=1', 'https://x.test']),
    { headers: ['A: 1', 'B: 2'], body: 'x=1' },
  );
  // curl concatenates repeated -d with `&`.
  assertEquals(parseRequest(['-d', 'a=1', '-d', 'b=2']).body, 'a=1&b=2');
  // A form is fields, not one blob, so each gets a line.
  assertEquals(
    parseRequest(['-F', 'file=@a.png', '-F', 'kind=avatar']).body,
    'file=@a.png\nkind=avatar',
  );
  assertEquals(parseRequest(['https://x.test']), { headers: [], body: undefined });
});

Deno.test('body comes before headers on both sides', () => {
  const out = render({
    stats: { response_code: 201, method: 'POST', url: 'https://x.test/todos' },
    headers: { 'content-type': ['application/json'] },
    body: '{"id":1}',
    raw: 'RAW',
    request: { headers: ['Content-Type: application/json'], body: '{"a":1}' },
  });
  const lines = out.split('\n');
  const folds = lines.filter((l) => l.endsWith('{{{')).map((l) => l.slice(0, -3));
  assertEquals(folds, ['Request body', 'Request headers', 'Response headers', 'Raw']);
  // The response body is not folded, so its place is fixed by what follows it.
  assertEquals(lines.indexOf('  "id": 1') < lines.indexOf('Response headers{{{'), true);
});

Deno.test('the dynamic linker vars are the only ones dropped', () => {
  assertEquals(
    withoutLinkerVars({
      HOME: '/home/me',
      https_proxy: 'http://p:8080',
      LD_LIBRARY_PATH: '/opt/lib',
      LD_PRELOAD: '/opt/x.so',
      DYLD_INSERT_LIBRARIES: '/opt/y.dylib',
    }),
    { HOME: '/home/me', https_proxy: 'http://p:8080' },
  );
  assertEquals(withoutLinkerVars({}), {});
});

Deno.test('header dump: names lowercased, repeats kept, status line skipped', () => {
  assertEquals(
    parseHeaderDump(
      'HTTP/2 200 \r\nContent-Type: application/json\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\n\r\n',
    ),
    { 'content-type': ['application/json'], 'set-cookie': ['a=1', 'b=2'] },
  );
});

Deno.test('header dump: a redirect keeps only the final response', () => {
  const dump =
    'HTTP/1.1 301 Moved\nlocation: https://x.test/b\n\nHTTP/2 200\ncontent-type: text/html\n\n';
  assertEquals(parseHeaderDump(dump), { 'content-type': ['text/html'] });
});

Deno.test('header dump: 100 Continue is not the response', () => {
  const dump = 'HTTP/1.1 100 Continue\n\nHTTP/1.1 201 Created\nlocation: /users/1\n\n';
  assertEquals(parseHeaderDump(dump), { location: ['/users/1'] });
});

Deno.test('header dump: a value may hold a colon', () => {
  assertEquals(parseHeaderDump('HTTP/2 200\ndate: Mon, 21 Sep 2026 19:30:54 GMT\n\n'), {
    date: ['Mon, 21 Sep 2026 19:30:54 GMT'],
  });
});

Deno.test('header dump: nothing in, nothing out', () => {
  assertEquals(parseHeaderDump(''), {});
  assertEquals(parseHeaderDump('\n\n'), {});
});
