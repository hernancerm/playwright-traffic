# playwright-traffic

Runs the Playwright test nearest to `file:line` and prints what it sent and got back, as JSON.

## Installation

Requires Node >= 22.18, `@playwright/test` >= 1.50 in the project, and `unzip` on `PATH`.

```sh
npm install -g playwright-traffic
```

## Usage

```text
playwright-traffic [--format=json|markdown+vim-folds] <file>[:<line>]
```

- Runs the nearest test that starts at or above the line. Without `:<line>`, every test in the file runs.
- Exits `0` if the test passed, `1` if it failed, `2` if there is no test at or above the line or
  no `playwright.config.ts` above the file. Only the output goes to stdout, errors go to stderr.
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
            "body": "{\"title\":\"Buy milk\",\"completed\":false}"
          },
          "response": {
            "status": 201,
            "reason": "Created",
            "headers": [["content-type", "application/json; charset=utf-8"]],
            "body": "{\n  \"title\": \"Buy milk\",\n  \"completed\": false,\n  \"id\": 201\n}"
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

A bare project needs only `@playwright/test` and a config. In a new directory:
```sh
npm init -y
npm install -D @playwright/test
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
});
```

`tests/todos.spec.ts`:

```ts
import { test } from '@playwright/test';

test('get-todo', async ({ request }) => {
  await request.get('https://jsonplaceholder.typicode.com/todos/1');
});
```

```sh
playwright-traffic tests/todos.spec.ts:3
```


## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
