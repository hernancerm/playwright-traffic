# playwright-traffic

Runs the Playwright test nearest to `file:line` and prints what it sent and got back, as JSON.

## Usage

```text
playwright-traffic [--format=<format>] <file>:<line>
```

The test run is the nearest one that starts at or above the line, so any line inside a test works.
Without `:<line>`, every test in the file runs.

```ts
// tests/todos.spec.ts
import { expect, test } from '@playwright/test';

const base = 'https://jsonplaceholder.typicode.com';

test('create-todo', async ({ request }) => {
  const res = await request.post(`${base}/todos`, {
    data: { title: 'Buy milk', completed: false },
  });
  expect(res.status()).toBe(201);
});
```

```text
playwright-traffic tests/todos.spec.ts:7
```

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

### Exit codes

- `0`: the test passed.
- `1`: the test failed.
- `2`: no test at or above the line, or no `playwright.config.ts` above the file.

Only the JSON goes to stdout. When there is none, e.g. Playwright could not start, the reason goes
to stderr.

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

In markdown, each request gets a heading like `# POST /todos · 201 Created · 142 ms · 83 B`. The
query string, bodies, headers and a `curl` command that sends the same request are folded under it.
JSON bodies are indented without being parsed, so big numbers and key order are kept.

### Notes

- Requests are read from the Playwright trace, so headers Playwright adds itself show up.
- Only requests sent through `request` are shown, not the ones a page loads.
- Only the first project that has the test runs, so a `POST` is not sent once per project. Its
  setup dependencies still run, but their requests are left out.
- The test file must be saved, since Playwright reads it from disk.
- Node only: the test runs with `npx playwright`.

## Requirements

- Node >= 22.18
- `@playwright/test` >= 1.50, in the project. Verified against 1.50.0 and 1.63.0.
- `unzip` on `PATH`, to read the trace.

## Installation

Not on npm yet. Clone the repo and add an alias:

```text
git clone https://github.com/hernancerm/playwright-traffic.git ~/dev/repos/playwright-traffic
```

```sh
alias playwright-traffic='node ~/dev/repos/playwright-traffic/src/cli/main.ts'
```

Nothing to build. Node runs the `.ts` sources as they are, and there are no dependencies.

## Develop

```text
npm install
npm run check
npm test
npm run fmt
npm run build
```

`examples/` is a Playwright suite against [JSONPlaceholder](https://jsonplaceholder.typicode.com),
with one test that fails on purpose:

```text
playwright-traffic examples/todos.spec.ts:10
```

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
