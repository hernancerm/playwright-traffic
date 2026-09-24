# wirepeek

See what a Playwright test sent and got back. Run one from Neovim, check them all with Playwright.

## Problem

Postman keeps my requests outside the repo, and its test report is a stand-in for a real test
runner. Playwright has the runner, the report and the syntax people already know, but running one
API test tells me whether it passed, not what went over the wire.

## Solution

Write the requests as Playwright tests. `wirepeek show-test` runs the one at a line and prints each
request it sent as markdown: status, url, both bodies, both sets of headers.

```ts
// tests/todos.spec.ts
import { expect, test } from 'wirepeek';

const base = 'https://jsonplaceholder.typicode.com';

test('get-todo-by-id', async ({ request }) => {
  await request.get(`${base}/todos/1`);
});

test('create-todo', async ({ request }) => {
  const res = await request.post(`${base}/todos`, {
    data: { title: 'Buy milk', completed: false },
  });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ title: 'Buy milk' });
});
```

```text
npx wirepeek show-test tests/todos.spec.ts:10
npx playwright test
```

````text
# ✓ 201 Created

POST https://jsonplaceholder.typicode.com/todos

Request body{{{
```json
{
  "title": "Buy milk",
  "completed": false
}
```
}}}

Request headers{{{
```http
user-agent: Playwright/1.63.0 (arm64; macOS 26.6) node/26.7
accept: */*
accept-encoding: gzip,deflate,br
content-type: application/json
content-length: 38
```
}}}

```json
{
  "title": "Buy milk",
  "completed": false,
  "id": 201
}
```

Response headers{{{
```http
content-type: application/json; charset=utf-8
...
```
}}}
````

## Features

- Print the requests of the test at `file:line`, in the markdown shown above.
- Show the headers as sent, including the ones Playwright adds itself, e.g. `content-type` for
  `data:`.
- Show any text body: JSON is pretty-printed, the rest is shown as it came.
- Work on an existing Playwright project with no change to its tests. The import is optional.
- Fail a test that asserts nothing when the server answers 4xx or 5xx, with the optional import.
- Send the request under the cursor to a split in Neovim.

## Limitations

- The test file must be saved, since Playwright reads it from disk. The Neovim runner saves it.
- Only the first project that has the test runs. See [Projects](#projects).
- Only requests sent through `request` are shown, not a page's own. See
  [Browser tests](#browser-tests).
- The 4xx/5xx rule counts asserts made with wirepeek's `expect`. See [The rule](#the-rule).
- Nothing is published yet. See [Installation](#installation).

## Requirements

- Node >= 22.18
- `@playwright/test` >= 1.50, in the project. Verified against 1.50.0 and 1.63.0.
- `unzip` on `PATH`, to read the trace. macOS and most Linux ship it.
- Neovim >= 0.11 (optional, for the test-under-cursor keymap)

## Installation

wirepeek is not on npm yet, so install it from a clone:

1. Clone the repo and pack it:

```text
git clone https://github.com/hernancerm/curler.git ~/dev/repos/wirepeek
cd ~/dev/repos/wirepeek && npm install && npm pack
```

2. Install the tarball in your Playwright project:

```text
npm i -D ~/dev/repos/wirepeek/wirepeek-0.1.0.tgz
```

3. Verify, with a line that holds a `test(` call:

```text
npx wirepeek show-test tests/some.spec.ts:12
```

Install it in each project rather than globally: `@playwright/test` is a peer dependency, so
wirepeek uses the project's copy. Two copies of Playwright refuse to register tests.

## Command

| Command                   | Alias  | What it does                                     |
| ------------------------- | ------ | ------------------------------------------------ |
| `show-test <file>:<line>` | `show` | Runs the test at that line, prints its requests. |

The line is where the `test(` call starts, which is Playwright's own way to name one test, so a
title repeated in another `describe` is not a problem. A `test.describe(` line runs every test in
it.

It exits 0 when the test passed, 1 when it failed, and 2 when there is no test at that line or no
`playwright.config.ts` above the file. A failure comes first in the output, with Playwright's
message folded under it:

```text
# ✗ fails-on-purpose: Error: expect(received).toMatchObject(expected)

Playwright{{{
- Expected  - 1
+ Received  + 1
...
}}}
```

### How it works

The test runs with `--trace on`, and the requests are read from the trace, not from the test. The
trace records what went over the wire, which is why the headers Playwright adds show up. The run
uses the JSON reporter, which says which trace belongs to which test.

### Projects

A config with several projects, e.g. one per browser, would run the test once per project, and a
`POST` would go out that many times. So a `--list` run, which sends nothing, finds the first
project that has the test, and only that one runs. Its setup dependencies, e.g. a login, still run,
but their requests are left out.

### Browser tests

A test that opens a page records every script, image and font the page loads. Only the requests
sent through `request` are shown, so the calls the test made are not buried.

## The rule

Importing `test` and `expect` from `wirepeek` instead of `@playwright/test` adds one rule: a test
that asserts nothing fails when the server answers 4xx or 5xx.

```ts
import { expect, test } from 'wirepeek';

// Fails: no asserts, and the server answered 404.
test('missing-todo', async ({ request }) => {
  await request.get(`${base}/todos/999999`);
});

// Passes: the 404 is what it asserts.
test('missing-todo-is-404', async ({ request }) => {
  const res = await request.get(`${base}/todos/999999`);
  expect(res.status()).toBe(404);
});
```

That lets a collection start as bare requests, run one at a time from the editor, and gain asserts
later, without being green in the meantime while the server errors.

Asserts are counted by calls to wirepeek's `expect`, including `expect.soft` and `expect.poll`. So
import both from `wirepeek`: an `expect` from `@playwright/test` is not seen, and a test that
asserts only with it fails on a 4xx or 5xx. The rule watches the `request` fixture only, not a
context made with `playwright.request.newContext()`.

## Neovim

[`wirepeek_runner.lua`](https://github.com/hernancerm/dotfiles) sends the test under the cursor to
a split. It climbs the syntax tree from the cursor to the enclosing `test(` call, skipping
`test.step(`, and passes its line. The output opens as markdown with `foldmethod=marker`, so the
header blocks come up folded.

It runs `npx --no-install wirepeek` from the directory of the `playwright.config.ts`: npx finds the
project's own wirepeek only from there, and `--no-install` stops it fetching one from npm when the
project has none.

## Develop

```text
npm run check
npm test
npm run fmt
npm run build
```

The sources import `./x.ts`, so `node --test` runs them as they are. `npm run build` writes `dist/`,
which the package ships, since Node does not strip types under `node_modules`. `npx wirepeek` in
this repo runs `dist/`, so build after an edit.

`examples/` is a Playwright suite against [JSONPlaceholder](https://jsonplaceholder.typicode.com),
with two tests that fail on purpose:

```text
npx playwright test
npx wirepeek show-test examples/todos.spec.ts:10
```

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
