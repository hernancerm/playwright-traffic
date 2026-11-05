---
name: playwright-traffic
description: Sends HTTP requests written as Playwright tests and prints the full request and response (method, URL, headers, body, status, timing) as JSON. Use when the user wants an API request saved in a file to run again, or needs to see exactly what went over the wire for a request a Playwright test makes. Not for a one-off check of a URL, where curl is faster.
---

# playwright-traffic

Runs one Playwright test and prints every HTTP exchange it made. Run `playwright-traffic --help`
for the full usage.

## When not to use it

- A single quick request with nothing to keep: use `curl`.
- `playwright-traffic` is not on `PATH`: ask the user to install it (`npm install -g
  playwright-traffic`) instead of installing it yourself.

## Setup

Requests live in `*.spec.ts` files under a folder with a `playwright.config.ts`. A test runs
under the nearest config above it.

1. If the user, a runbook or a plan names a folder for requests (e.g. `.temp/<ticket>/reqs/`),
   use it. If it has no `playwright.config.ts` of its own, run `playwright-traffic init` in it,
   even when a parent folder has one: the parent's config may start a web server or not find the
   folder.
2. Otherwise, look for a `playwright.config.ts` in the current folder or above it, and write the
   test there.
3. If there is none, and the folder is empty or new, run `playwright-traffic init` in it. It
   creates `package.json`, runs `npm install` and writes config files, so in any other folder ask
   the user first.

## Writing a request

Give each test a unique title, so you can run it with `--title`:

```ts
import { test } from '@playwright/test';

test('create-todo', async ({ request }) => {
  await request.post('https://jsonplaceholder.typicode.com/todos', {
    data: { title: 'Buy milk' },
  });
});
```

The file must be saved before running it, since Playwright reads it from disk.

## Running it

If the user or a plan says not to run requests, write them and stop here.

```sh
playwright-traffic --format=json --title=create-todo todos.spec.ts
playwright-traffic --format=json todos.spec.ts:5
```

Pass one test, by `--title` or `:<line>`. Without either, every test in the file runs, and the
output can get large.

Exit codes:

- `0`: the test passed.
- `1`: the test failed. The exchanges are still printed, read them along with `errors`.
- `2`: no test matched, or there is no `playwright.config.ts`. The reason is on stderr.

## Reading the output

Bodies can be large. Look at the shape first and read full bodies only when needed:

```sh
playwright-traffic --format=json --title=create-todo todos.spec.ts \
  | jq '.tests[] | {status, errors, exchanges: [.exchanges[] | {method: .request.method, url: .request.url, status: .response.status, time}]}'
```

- `.tests[].exchanges[]` has `request`, `response` and `time` (milliseconds).
- `body` and `response` are `null` when there was none.
- Top-level `.errors` are failures outside any test, e.g. a failed `globalSetup`.
