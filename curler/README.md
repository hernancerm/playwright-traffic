# curler

Builds `curl` command strings. It never runs a request.

You get back a string. What happens to it next is up to you: print it, paste it into a terminal, put
it in a bug report, hand it to `Deno.Command`. This library does not care.

Single file, no dependencies, no runtime APIs.

## Usage

```ts
import { curl } from '../curler/mod.ts';

const cmd = curl('POST', 'http://localhost:8080/api/v1/contacts')
  .headers({
    'Cache-Control': 'nocache',
  })
  .json({
    name: 'John Doe',
    phone: '9992738355',
  });

console.log(cmd);
```

```
curl \
  -X POST \
  'http://localhost:8080/api/v1/contacts' \
  -H 'Cache-Control: nocache' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","phone":"9992738355"}'
```

Not published yet, so that is a path. Inside this repo the workspace name `@hernancerm/curler` works
too. Once it is on JSR the line becomes `jsr:@hernancerm/curler@0.1.0`, pinned: Deno caches an
import the first time it sees it, so a moving target gives you a stale copy until
`deno cache --reload`.

Nothing here touches a runtime API, so this module also runs on Node, Bun and the browser. Only the
commands built on top of it are Deno-only.

## The `curl` function

```ts
curl(url); // method is GET
curl(method, url);
```

The result stringifies itself, so `console.log(cmd)` and `` `${cmd}` `` both work. There is no
`.build()` step. If you want the string explicitly, call `String(cmd)` or `cmd.toString()`.

`-X` is omitted for a plain GET, because that is already curl's default.

## Chain methods

Every one of them returns the builder, so they chain in any order.

- `.headers({ name: value })` adds one `-H` per entry. Call it again to add more. A repeated name
  wins, ignoring case.
- `.header(name, value)` adds one header.
- `.json(value)` sets `-d` to the JSON, plus a `Content-Type: application/json` header.
- `.body(string)` sets `-d` to the string as given. No header is guessed.
- `.form({ name: value })` adds one `-F` per entry. Prefix a value with `@` to send a file.
- `.query({ name: value })` appends to the query string, percent-encoded. Respects a `?` already in
  the url.
- `.auth(user, password)` adds `-u user:password`.
- `.bearer(token)` adds an `Authorization: Bearer` header.
- `.flag('-k', ...)` passes anything else through untouched.
- `.oneLine()` emits one line instead of backslash continuations.
- `.toArgs()` returns the command as an array of quoted arguments.

`.json()` leaves your content type alone if you set one yourself, whatever the order of the calls:

```ts
curl('POST', 'http://x')
  .json({ a: 1 })
  .headers({ 'Content-Type': 'application/vnd.api+json' });
```

## Examples

A GET with query parameters:

```ts
curl('http://localhost:8080/api/v1/contacts').query({ page: 2, q: 'a b' });
```

```
curl \
  'http://localhost:8080/api/v1/contacts?page=2&q=a%20b'
```

A file upload with a token:

```ts
curl('POST', 'http://x/upload')
  .bearer('t0ken')
  .form({ file: '@/tmp/a.png', kind: 'avatar' });
```

```
curl \
  -X POST \
  'http://x/upload' \
  -H 'Authorization: Bearer t0ken' \
  -F 'file=@/tmp/a.png' \
  -F 'kind=avatar'
```

On one line:

```ts
curl('DELETE', 'http://x/api/contacts/7').oneLine();
```

```
curl -X DELETE 'http://x/api/contacts/7'
```

## Quoting

Every value is wrapped in single quotes, and a single quote inside a value becomes `'\''`. That is
the one form `sh` never reinterprets, so an apostrophe, a space, a `$`, a `&` or an accent all
survive intact. The exception is `.flag()`, which is passed through as typed: it exists for flags,
so quoting there is yours to handle.

## Development

`deno task check` and `deno task test` from the repo root.
