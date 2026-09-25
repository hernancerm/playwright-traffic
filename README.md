# playwright-traffic

See what a Playwright test sent and got back, as JSON. Run one from your editor, check them all
with Playwright.

## Problem

Postman keeps my requests outside the repo, and its test report is a stand-in for a real test
runner. Playwright has the runner, the report and the syntax people already know, but running one
API test tells me whether it passed, not what went over the wire.

## Solution

Write the requests as Playwright tests. `playwright-traffic` runs the one at a line and prints each
request it sent as JSON: status, url, both bodies, both sets of headers. Pipe it to `jq`, turn it
into whatever you like to read, or ask for markdown with `--format=markdown+vim-folds`.

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
npx playwright-traffic tests/todos.spec.ts:10
npx playwright test
```

```json
{
  "tests": [
    {
      "title": "create-todo",
      "file": "/home/me/my-api/tests/todos.spec.ts",
      "line": 10,
      "project": "",
      "status": "passed",
      "errors": [],
      "exchanges": [
        {
          "request": {
            "method": "POST",
            "url": "https://jsonplaceholder.typicode.com/todos",
            "headers": [
              ["content-type", "application/json"],
              ["content-length", "38"]
            ],
            "body": "{\"title\":\"Buy milk\",\"completed\":false}"
          },
          "response": {
            "status": 201,
            "reason": "Created",
            "headers": [["content-type", "application/json; charset=utf-8"]],
            "body": "{\n  \"title\": \"Buy milk\",\n  \"completed\": false,\n  \"id\": 201\n}"
          }
        }
      ]
    }
  ],
  "errors": []
}
```

## Features

- Print the requests of the test at `file:line`, any line inside it, as the JSON shown above.
- Show the headers as sent, including the ones Playwright adds itself, e.g. `content-type` for
  `data:`.
- Keep bodies as they were sent, and headers in their order, repeats included.
- Work on an existing Playwright project with no change to its tests.
- Print markdown instead, with the details in Vim fold markers. See [Formats](#formats).
- Show the test under the cursor in a Neovim split, as markdown. See [Neovim](#neovim).

## Limitations

- The test file must be saved, since Playwright reads it from disk. The Neovim runner saves it.
- Only the first project that has the test runs. See [Projects](#projects).
- Only requests sent through `request` are shown, not a page's own. See
  [Browser tests](#browser-tests).
- Node only. Playwright runs under Deno, but playwright-traffic starts it with `npx`, so the test
  runs under Node.
- Nothing is published yet. See [Installation](#installation).

## Requirements

- Node >= 22.18
- `@playwright/test` >= 1.50, in the project. Verified against 1.50.0 and 1.63.0.
- `unzip` on `PATH`, to read the trace. macOS and most Linux ship it.
- Neovim >= 0.11 (optional, for the test-under-cursor keymap)

## Installation

playwright-traffic is not on npm yet, so install it from a clone:

1. Clone the repo and pack it:

```text
git clone https://github.com/hernancerm/playwright-traffic.git ~/dev/repos/playwright-traffic
cd ~/dev/repos/playwright-traffic && npm install && npm pack
```

2. Install the tarball in your Playwright project:

```text
npm i -D ~/dev/repos/playwright-traffic/playwright-traffic-0.1.0.tgz
```

3. Verify, with a line inside a test:

```text
npx playwright-traffic tests/some.spec.ts:12
```

Install it in each project rather than globally: it runs the project's own Playwright, and the
Neovim runner looks for the project's own playwright-traffic.

## Quickstart

A new project for API tests, from an empty directory:

1. Create a Playwright project. `--quiet` takes the defaults (TypeScript, `tests/`), and
   `--no-browsers` skips the download, since `request` needs no browser:

```text
mkdir my-api && cd my-api
npm init -y playwright@latest -- --quiet --no-browsers
```

2. Install playwright-traffic, packed as in [Installation](#installation):

```text
npm i -D ~/dev/repos/playwright-traffic/playwright-traffic-0.1.0.tgz
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
npx playwright-traffic tests/todos.spec.ts:3
npx playwright test
```

## Command

```text
playwright-traffic [--format=<format>] <file>:<line>
```

Runs the nearest test at or above the line and prints its requests. The test run is the nearest
one that starts at or above the line, like vim-test's nearest, so any line inside a test names it.
It is then run as Playwright's own `file:line`, so a title repeated in another `describe` is not a
problem. Without `:<line>`, every test in the file runs.

It exits 0 when the test passed, 1 when it failed, and 2 when there is no test at or above the
line or no `playwright.config.ts` above the file. Only the JSON goes to stdout. When there is none,
e.g. Playwright could not start, the reason goes to stderr.

### Output

| Field                 | What it is                                                           |
| --------------------- | -------------------------------------------------------------------- |
| `tests[]`             | Each test run, usually one.                                          |
| `tests[].status`      | Playwright's own: `passed`, `failed`, `timedOut`, `skipped`, ...     |
| `tests[].errors[]`    | Playwright's messages, colors stripped.                              |
| `tests[].exchanges[]` | Each request the test sent through `request`, in order.              |
| `...request.headers`  | `[name, value]` pairs as sent. A name may repeat, e.g. `set-cookie`. |
| `...request.body`     | The text sent, or `null` when there was none.                        |
| `...response`         | `null` when no response came back.                                   |
| `...response.reason`  | E.g. `Created`, from a table since HTTP/2 sends none.                |
| `...response.body`    | The text received, not pretty-printed.                               |
| `...time`             | Milliseconds from sending the request to the end of the response.    |
| `errors[]`            | Errors outside any test, e.g. a failed `globalSetup`.                |

### Formats

| `--format`           | What it prints                                                     |
| -------------------- | ------------------------------------------------------------------ |
| `json`               | The default. One JSON object, see [Output](#output).               |
| `markdown+vim-folds` | Markdown, with bodies and headers in Vim's `{{{`/`}}}` fold marks. |

The `+` names an extra on top of the base format, as in pandoc's `markdown+smart`. The fold markers
are Vim's (`:h fold-marker`), so they get a name of their own: another editor's could come later.

In markdown, a JSON body is indented without being parsed, so a big id like `9007199254740993`
keeps every digit and the keys keep their order.

Each request's heading reads like `# POST /todos → 201 Created · 142 ms · 83 B`, so the outline
tells requests apart. The size is the response body's. The last line is a Vim modeline, so the
output folds when saved to a file and opened again.

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

[`playwright_traffic_runner.lua`](https://github.com/hernancerm/dotfiles) sends the test under the
cursor to a split. It passes the cursor's line, and playwright-traffic finds the test. It asks for
`--format=markdown+vim-folds`, so the header blocks come up folded.

It runs `npx --no-install playwright-traffic` from the directory of the `playwright.config.ts`: npx
finds the project's own playwright-traffic only from there, and `--no-install` stops it fetching one
from npm when the project has none.

## Develop

```text
npm run check
npm test
npm run fmt
npm run build
```

The sources import `./x.ts`, so `node --test` runs them as they are. `npm run build` writes `dist/`,
which the package ships, since Node does not strip types under `node_modules`.
`npx playwright-traffic` in this repo runs `dist/`, so build after an edit.

`examples/` is a Playwright suite against [JSONPlaceholder](https://jsonplaceholder.typicode.com),
with one test that fails on purpose:

```text
npx playwright test
npx playwright-traffic examples/todos.spec.ts:10
```

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
