# playwright-traffic

Runs the Playwright test nearest to `file:line` and prints what it sent and got back, as JSON.

## Installation

Requires Node >= 22.18, `@playwright/test` >= 1.50 in the project, and `unzip` on `PATH`. Not on
npm yet, so clone the repo and add an alias (nothing to build):

```sh
git clone https://github.com/hernancerm/playwright-traffic.git ~/dev/repos/playwright-traffic
alias playwright-traffic='node ~/dev/repos/playwright-traffic/src/cli/main.ts'
```

## Usage

```text
playwright-traffic [--format=json|markdown+vim-folds] <file>[:<line>]
```

- Runs the nearest test that starts at or above the line. A line between tests (a helper, a hook,
  a blank line) runs the test above it. Without `:<line>`, every test in the file runs.
- Exits `0` if the test passed, `1` if it failed, `2` if there is no test at or above the line or
  no `playwright.config.ts` above the file. Only the output goes to stdout, errors go to stderr.
- Only requests sent through `request` are shown, not the ones a page loads. They come from the
  trace, so headers Playwright adds itself show up.
- Only the first project that has the test runs. Its setup dependencies run too, but their
  requests are left out.
- The file must be saved, since Playwright reads it from disk.

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

`body` and `response` are `null` when there was none. `time` is in milliseconds. The top-level
`errors` are the ones outside any test, e.g. a failed `globalSetup`.

`--format=markdown+vim-folds` prints a heading per request (`# POST /todos · 201 Created · 142 ms ·
83 B`) with the bodies, headers and a `curl` command folded under it.

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
