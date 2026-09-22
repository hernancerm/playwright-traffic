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
    await toHurl(fixture, 'getTodo'),
    [
      '# Get todo',
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
  'takes the comment from .name(), and fences a json body',
  needsHurlfmt,
  async () => {
    assertEquals(
      await toHurl(fixture, 'createTodo'),
      [
        '# Make a todo',
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
    '# Plain\nGET https://example.test/ping',
  );
});

// --retry makes hurlfmt write `HTTP *` with `status < 500` of its own.
Deno.test('replaces a response section hurlfmt wrote itself', needsHurlfmt, async () => {
  assertEquals(
    await toHurl(fixture, 'retried'),
    [
      '# Retried',
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

// One file per request, named after the export, is what makes hurl count them
// one by one instead of reporting the whole collection as a single test.
Deno.test('gives every request its own entry, keyed by export name', needsHurlfmt, async () => {
  const entries = await toEntries(fixture);
  assertEquals(
    entries.map((entry) => entry.key),
    ['createTodo', 'getTodo', 'plain', 'retried'],
  );
});

Deno.test('rejects what hurlfmt cannot read', async () => {
  await assertRejects(() => toHurl(gaps, 'uploaded'), Error, '.form()');
  await assertRejects(() => toHurl(gaps, 'multiline'), Error, 'newline');
});

Deno.test('rejects an export name the file does not have', async () => {
  await assertRejects(() => toHurl(fixture, 'nope'), Error, 'Exported requests:');
});
