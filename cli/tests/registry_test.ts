import { assertEquals, assertRejects, assertThrows } from '@std/assert';
import { fromFileUrl } from '@std/path';
import { curl, type Registry } from '@curler/builder';
import { flatten, load, select } from '../registry.ts';

const fixture = fromFileUrl(import.meta.resolve('./fixture.ts'));
const request = curl('https://example.test/a');

Deno.test('flattens nested registries to slash-joined paths, in file order', () => {
  const R: Registry = {};
  R['ping'] = request;
  R['cit'] = { 'get-card': request, 'nested': { deep: request } };
  assertEquals(
    flatten(R).map((entry) => entry.path),
    ['ping', 'cit/get-card', 'cit/nested/deep'],
  );
});

// Every path becomes a file name under the directory hurl runs in, and `/`
// already means nesting.
Deno.test('rejects keys that cannot be a path segment', () => {
  assertThrows(() => flatten({ 'cit/get': request }), Error, '`/`');
  assertThrows(() => flatten({ '': request }), Error, 'is empty');
  assertThrows(() => flatten({ '..': request }), Error, 'directory name');
});

Deno.test('rejects a value that is neither a request nor a registry', () => {
  assertThrows(
    () => flatten({ cit: { get: 'https://example.test/a' } } as unknown as Registry),
    Error,
    'cit/get',
  );
});

Deno.test('rejects a file with no registry as its default export', async () => {
  // Any module without one; this is the rule, not the file.
  const path = fromFileUrl(import.meta.resolve('../hurl.ts'));
  await assertRejects(() => load(path), Error, 'default export');
});

Deno.test('select names the paths the file does have', async () => {
  const found = await load(fixture);
  assertEquals(select(fixture, found, 'cit/retried').path, 'cit/retried');
  // A nested request is not reachable by its last segment alone.
  assertThrows(
    () => select(fixture, found, 'retried'),
    Error,
    'Requests: get-todo, create-todo, plain, cit/retried',
  );
});
