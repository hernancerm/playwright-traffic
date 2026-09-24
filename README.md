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
import { expect, test } from '@playwright/test';

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
# 201 Created

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
- Work on an existing Playwright project with no change to its tests.
- Send the request under the cursor to a split in Neovim.

## Limitations

- The test file must be saved, since Playwright reads it from disk. The Neovim runner saves it.
- Only the first project that has the test runs. See [Projects](#projects).
- Only requests sent through `request` are shown, not a page's own. See
  [Browser tests](#browser-tests).
- Node only. Playwright runs under Deno, but wirepeek starts it with `npx`, so the test runs
  under Node.
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

Install it in each project rather than globally: it runs the project's own Playwright, and the
Neovim runner looks for the project's own wirepeek.

## Quickstart

A new project for API tests, from an empty directory:

1. Create a Playwright project. `--quiet` takes the defaults (TypeScript, `tests/`), and
   `--no-browsers` skips the download, since `request` needs no browser:

```text
mkdir my-api && cd my-api
npm init -y playwright@latest -- --quiet --no-browsers
```

2. Install wirepeek, packed as in [Installation](#installation):

```text
npm i -D ~/dev/repos/wirepeek/wirepeek-0.1.0.tgz
```

3. Replace `playwright.config.ts`. The generated one is for browsers: its three projects would run
   every API test three times, and its `html` reporter opens a browser on a failure.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
});
```

4. Replace `tests/example.spec.ts`, a browser test, with a request:

```ts
// tests/todos.spec.ts
import { expect, test } from '@playwright/test';

test('get-todo', async ({ request }) => {
  const res = await request.get('https://jsonplaceholder.typicode.com/todos/1');
  expect(res.status()).toBe(200);
});
```

5. Run it:

```text
npx wirepeek show-test tests/todos.spec.ts:3
npx playwright test
```

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
# fails-on-purpose: Error: expect(received).toMatchObject(expected)

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
with one test that fails on purpose:

```text
npx playwright test
npx wirepeek show-test examples/todos.spec.ts:10
```

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
