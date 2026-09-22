import { assertEquals } from '@std/assert';
import { curl, isCurl } from './mod.ts';

Deno.test('one arg implies GET and omits -X', () => {
  assertEquals(String(curl('http://x/api')), `curl \\\n  'http://x/api'`);
});

Deno.test('POST with headers and json', () => {
  const cmd = curl('POST', 'http://localhost:8080/api/v1/contacts')
    .headers({ 'Cache-Control': 'nocache' })
    .json({ name: 'John Doe', phone: '9992738355' })
    .oneLine();
  assertEquals(
    String(cmd),
    `curl -X POST 'http://localhost:8080/api/v1/contacts' ` +
      `-H 'Cache-Control: nocache' ` +
      `-H 'Content-Type: application/json' ` +
      `-d '{"name":"John Doe","phone":"9992738355"}'`,
  );
});

Deno.test('an explicit content type wins over json()', () => {
  const cmd = curl('POST', 'http://x').json({ a: 1 })
    .headers({ 'content-type': 'application/vnd.api+json' }).oneLine();
  assertEquals(String(cmd).includes('application/json'), false);
});

Deno.test('single quotes in values are escaped', () => {
  const cmd = curl('POST', 'http://x').body(`it's`).oneLine();
  assertEquals(String(cmd), `curl -X POST 'http://x' -d 'it'\\''s'`);
});

Deno.test('query appends and encodes', () => {
  assertEquals(
    String(curl('http://x/s?a=1').query({ q: 'a b&c' }).oneLine()),
    `curl 'http://x/s?a=1&q=a%20b%26c'`,
  );
});

Deno.test('GET with a body still needs -X', () => {
  assertEquals(String(curl('http://x').body('hi').oneLine()), `curl -X GET 'http://x' -d 'hi'`);
});

Deno.test('auth, bearer, flags and form', () => {
  const cmd = curl('POST', 'http://x').bearer('t').form({ file: '@/tmp/a.png' })
    .auth('u', "p'w").flag('-k').oneLine();
  assertEquals(
    String(cmd),
    `curl -X POST 'http://x' -H 'Authorization: Bearer t' -F 'file=@/tmp/a.png' -u 'u:p'\\''w' -k`,
  );
});

Deno.test('console.log prints the command, not the object', () => {
  const cmd = curl('DELETE', 'http://x/7').oneLine();
  // What `console.log(cmd)` reaches for. Without it the output is `Curl {}`,
  // since every field is private.
  assertEquals(Deno.inspect(cmd), `curl -X DELETE 'http://x/7'`);
});

// The notes are for a runner to read. Nothing about them reaches the command,
// so a builder used on its own is unchanged by having them.
Deno.test('.desc() and .assert() stay out of the command', () => {
  const cmd = curl('http://x').oneLine()
    .desc('A note.')
    .assert('status == 200', 'jsonpath "$.id" == 1');
  assertEquals(String(cmd), `curl 'http://x'`);
  assertEquals(cmd.description, 'A note.');
  assertEquals(cmd.asserts, ['status == 200', 'jsonpath "$.id" == 1']);
});

// A runner holds its own copy of this module, so `instanceof` would be false
// for a command a collection file built. See BRAND.
Deno.test('isCurl tells a command from anything else', () => {
  assertEquals(isCurl(curl('http://x')), true);
  assertEquals(isCurl({ url: 'http://x' }), false);
  assertEquals(isCurl('http://x'), false);
  assertEquals(isCurl(null), false);
});
