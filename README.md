# playwright-traffic

Send HTTP requests from a Playwright test and read what went over the wire. Made for people and for LLMs alike.

- **For people:** `--format=markdown+vim-folds` prints info, intended for a `fdm=marker` Vim buf.
- **For LLMs and scripts:** `--format=json` prints one JSON object, easy to parse or pipe to `jq`.

Requests are plain Playwright tests; they run the same for you and for an agent.

## Installation

Requires Node >= 22.18, `@playwright/test` >= 1.50 in the project, and `unzip` on `PATH`.

```sh
npm install -g playwright-traffic
```

## Usage

```text
playwright-traffic [--format=json|markdown+vim-folds] <file>[:<line>]
playwright-traffic [--format=json|markdown+vim-folds] --title=<title> <file>
playwright-traffic init
```

- Runs the nearest test that starts at or above the line. Without `:<line>`, every test in the file runs.
- `-t, --title` runs the test with that exact title, e.g. `--title=create-todo`. When two describes
  have a test with that title, it exits `2` and lists their lines, so you can pick one with `:<line>`.
- Exits `0` if the test passed, `1` if it failed, `2` if no test matches the line or title, or
  there is no `playwright.config.ts` above the file. Only the output goes to stdout, errors go to stderr.
- The file must be saved, since Playwright reads it from disk.

Sample output:

```json
{
  "tests": [
    {
      "title": "create-todo",
      "file": "/home/me/my-api/tests/todos.spec.ts",
      "line": 5,
      "project": "",
      "status": "passed",
      "errors": [],
      "exchanges": [
        {
          "request": {
            "method": "POST",
            "url": "https://jsonplaceholder.typicode.com/todos",
            "headers": [["content-type", "application/json"]],
            "body": "{\"title\":\"Buy milk\"}"
          },
          "response": {
            "status": 201,
            "reason": "Created",
            "headers": [["content-type", "application/json; charset=utf-8"]],
            "body": "{\n  \"title\": \"Buy milk\",\n  \"id\": 201\n}"
          },
          "time": 142
        }
      ]
    }
  ],
  "errors": []
}
```

- `body` and `response` are `null` when there was none.
- The top-level `errors` are the ones outside any test, e.g. a failed `globalSetup`.
- `time` is in milliseconds.

## Setup

To start from an empty folder, run `init` in it:

```sh
playwright-traffic init
```

It creates `package.json`, installs `@playwright/test` and `@types/node`, and writes a
`playwright.config.ts` that finds tests anywhere in the folder and a `tsconfig.json` for the
editor. It skips any of these that is already there. Then write a test, e.g. `todos.spec.ts`:

```ts
import { test } from '@playwright/test';

test('get-todo', async ({ request }) => {
  await request.get('https://jsonplaceholder.typicode.com/todos/1');
});
```

```sh
playwright-traffic --title=get-todo todos.spec.ts
playwright-traffic todos.spec.ts:3
```

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
