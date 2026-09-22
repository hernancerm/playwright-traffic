import { assertEquals, assertRejects } from '@std/assert';
import { fromFileUrl } from '@std/path';
import { toEntries, toHurl } from '../hurl.ts';

const fixture = fromFileUrl(import.meta.resolve('./fixture.ts'));
const gaps = fromFileUrl(import.meta.resolve('./gaps.ts'));

// The conversion is hurlfmt's, so there is nothing to assert without it.
const needsHurlfmt = { ignore: !hasHurlfmt() };

function hasHurlfmt(): boolean {
  try {
    return new Deno.Command('hurlfmt', { args: ['--version'] }).outputSync().success;
  } catch {
    return false;
  }
}

Deno.test('names the entry and appends the response section', needsHurlfmt, async () => {
  assertEquals(
    await toHurl(fixture, 'get-todo'),
    [
      '# get-todo',
      'GET https://example.test/todos/1',
      '',
      'HTTP *',
      '[Asserts]',
      'status == 200',
      'jsonpath "$.id" == 1',
    ].join('\n'),
  );
});

Deno.test(
  'heads the entry with the path and .desc(), and fences a json body',
  needsHurlfmt,
  async () => {
    assertEquals(
      await toHurl(fixture, 'create-todo'),
      [
        '# create-todo',
        '# Fake write.',
        'POST https://example.test/todos',
        'Content-Type: application/json',
        '```',
        '{"title":"Buy milk"}',
        '```',
        '',
        'HTTP *',
        '[Asserts]',
        'status == 201',
      ].join('\n'),
    );
  },
);

Deno.test('leaves out the response section when nothing is asserted', needsHurlfmt, async () => {
  assertEquals(
    await toHurl(fixture, 'plain'),
    '# plain\nGET https://example.test/ping',
  );
});

// --retry makes hurlfmt write `HTTP *` with `status < 500` of its own.
Deno.test('replaces a response section hurlfmt wrote itself', needsHurlfmt, async () => {
  assertEquals(
    await toHurl(fixture, 'cit/retried'),
    [
      '# cit/retried',
      'GET https://example.test/slow',
      '[Options]',
      'retry: 3',
      '',
      'HTTP *',
      '[Asserts]',
      'status == 200',
    ].join('\n'),
  );
});

// One file per request, named after its registry path, is what makes hurl count
// them one by one instead of reporting the whole collection as a single test.
// A nested key is a directory, which is how the HTML report shows folders.
Deno.test('keys every entry by its registry path, in file order', needsHurlfmt, async () => {
  const entries = await toEntries(fixture);
  assertEquals(
    entries.map((entry) => entry.path),
    ['get-todo', 'create-todo', 'plain', 'cit/retried'],
  );
});

Deno.test('rejects what hurlfmt cannot read', async () => {
  await assertRejects(() => toHurl(gaps, 'uploaded'), Error, '.form()');
  await assertRejects(() => toHurl(gaps, 'multiline'), Error, 'newline');
});

Deno.test('rejects a path the registry does not have', async () => {
  await assertRejects(() => toHurl(fixture, 'nope'), Error, 'Requests:');
  // A nested request is only reachable by its full path.
  await assertRejects(() => toHurl(fixture, 'retried'), Error, 'Requests:');
});
