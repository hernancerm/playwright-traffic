import { deepStrictEqual as assertEquals } from 'node:assert';
import { test } from 'node:test';
import { exchange } from './output.ts';

const get = { method: 'GET', url: 'https://x.test/1', headers: [] };

test('keeps bodies as sent and headers in order', () => {
  const out = exchange({
    request: {
      method: 'POST',
      url: 'https://x.test/todos',
      headers: [{ name: 'content-type', value: 'application/json' }],
      body: '{"a":1}',
    },
    response: {
      status: 201,
      headers: [
        { name: 'set-cookie', value: 'a=1' },
        { name: 'set-cookie', value: 'b=2' },
      ],
      body: '{"id":1}',
    },
  });
  assertEquals(out, {
    request: {
      method: 'POST',
      url: 'https://x.test/todos',
      headers: [['content-type', 'application/json']],
      body: '{"a":1}',
    },
    response: {
      status: 201,
      reason: 'Created',
      headers: [
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ],
      body: '{"id":1}',
    },
  });
});

test('a request with no body has a null body', () => {
  const response = { status: 200, headers: [], body: '' };
  assertEquals(exchange({ request: get, response }).request.body, null);
  assertEquals(exchange({ request: { ...get, body: '' }, response }).request.body, null);
});

test('no response is null', () => {
  for (const status of [0, -1]) {
    assertEquals(
      exchange({ request: get, response: { status, headers: [], body: '' } }).response,
      null,
    );
  }
});

test('an unknown status has a null reason', () => {
  const out = exchange({ request: get, response: { status: 299, headers: [], body: '' } });
  assertEquals(out.response?.reason, null);
});
