# curler

Keep HTTP requests as a TypeScript file. Send one from Neovim, check them all with hurl.

## Problem

Postman keeps my requests outside the repo, and its `{{variables}}` are a weak stand-in for a
programming language. IntelliJ's HTTP Client fixes the first half: the requests are a file in the
repo. I want that in Neovim, with a real language for the values.

## Solution

A collection is a TypeScript file whose default export is a registry: its keys name the requests,
and a nested registry is a folder. Send the one under the cursor to a split, or check the lot.

```ts
// todos.ts
import { curl, type Registry } from '@curler/builder';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

const R: Registry = {};

R['get-todo-by-id'] = curl(`${base}/todos/${id}`);

R['create-todo'] = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false })
  .assert('status == 201', 'jsonpath "$.title" == "Buy milk"');

export default R;
```

```text
curler build ./todos.ts get-todo-by-id | curler run
curler test ./todos.ts
curler test ./todos.ts -- --report-html ./report
```

## Features

- Send the request under the cursor to a split in Neovim, unsaved edits included.
- Print a request as a curl command, ready to paste into a terminal or a bug report.
- Render the exchange as markdown: the method and url curl used, what was sent, what came back.
- Check the responses with [hurl](https://hurl.dev), which supplies the whole assert language.
- Group requests into folders, which reach hurl as directories and the HTML report as paths.
- Substitute values in TypeScript, so a `${id}` reaches curl as the value it had.
- Read a token from `Deno.env`, a file, or a `fetch`, since a collection file is a program.
- Run the builder on Node, Bun or the browser: one file, no dependencies, no runtime APIs.
- Render a pasted "Copy as cURL" too, backslash continuations included.

## Limitations

- The commands are Deno-only.
  - `@curler/builder` is portable, but the CLI loads your file at runtime, which is what Deno does
    well and Node needs a `node_modules` beside every collection file to do.
- Nothing is published yet.
  - A collection file finds this repo through an import map. See
    [Where to keep collection files](#where-to-keep-collection-files).
- `curler test` cannot send a `.form()` request, or a body holding a newline.
  - Both are gaps in hurlfmt's curl parser, and both fail rather than run. See
    [Verification](#verification).
- `curler build` and `curler test` run your file.
  - Importing a module executes it, so both carry `-A`. See [Permissions](#permissions).
- The fence on `curler run` is not a sandbox.
  - It bounds a bug in the renderer, not a hostile command. See [Permissions](#permissions).

## Requirements

- Deno >= 2.9
- curl >= 7.75 (for `--write-out '%{json}'` carrying the method and url)
- hurl (optional, for `curler test`; `hurlfmt` ships with it). Verified against 8.0.1.
- Neovim >= 0.11 (optional, for the request-under-cursor keymap)

## Installation

1. Clone the repo:

```text
git clone https://github.com/hernancerm/curler.git ~/dev/repos/curler
```

2. Install the `curler` command into `~/.local/bin`:

```text
cd ~/dev/repos/curler && deno task install
```

3. Verify:

```text
curler build ./examples/todos.ts get-todo-by-id | curler run
```

The shim points into the clone, so a `git pull` is the whole upgrade.

> [!NOTE]
> Not `deno install`: its shim runs with `--no-config`, and passing `--config` makes it copy the
> file next to the shim, where this workspace's member paths no longer resolve.

## Collection file

The file's default export is a registry. Keys name the requests and are used verbatim, so the key is
what you type on the command line. A nested registry is a folder.

```ts
const R: Registry = {};

R['get-card-range'] = curl(base);

R['cit'] = {
  'export-card-range': curl(`${base}/export`),
};

export default R;
```

```text
curler build ./cards.ts get-card-range
curler build ./cards.ts cit/export-card-range
```

Keys are yours: `'export card range'` and `'cit:export-card-range'` both work. Only `/` is taken,
because it is how a path names a folder, and a key cannot be empty or `..`. Kebab-case is worth the
habit anyway: no shell quoting, and readable hurl file names.

| Method                    | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `.name('Get todo by id')` | Overrides the name derived from the key.            |
| `.desc('...')`            | A note printed above the request in the hurl file.  |
| `.assert('...')`          | A line for hurl's `[Asserts]`, the status included. |

Every other method is the builder's: `.headers()`, `.json()`, `.query()`, `.bearer()`, `.form()`,
`.auth()`, `.flag()`, `.oneLine()`. See [builder/README.md](./builder/README.md).

## Commands

| Command                       | Alias   | What it does                                          |
| ----------------------------- | ------- | ----------------------------------------------------- |
| `build-curl <file.ts> <path>` | `build` | Prints one request as a curl command.                 |
| `run-curl`                    | `run`   | Sends a curl command from stdin, prints the response. |
| `test-hurl <file.ts> [path]`  | `test`  | Checks the responses with hurl.                       |

The alias is always the full name's first word, so it is guessable. A path is the registry keys
joined with `/`.

`curler run` also takes the command as arguments, which is how a pasted "Copy as cURL" works:

```text
pbpaste | curler run
curler run curl -s -H 'X-Foo: bar' https://api.example.com/users/42
```

## Verification

`.assert()` says what a response has to look like, and `curler test` checks it:

```text
curler test ./examples/todos.ts
curler test ./examples/todos.ts get-todo-by-id
```

curler writes none of that checking. It prints the curl command it always prints, pipes it through
`hurlfmt --in curl` to get a hurl request, appends the `[Asserts]` block, and hands the files to
`hurl --test`, whose exit code becomes curler's. So an assert line is
[hurl's own syntax](https://hurl.dev/docs/asserting-response.html), and jsonpath, xpath, regex,
header, cookie, duration and certificate predicates all work without curler knowing they exist.

```text
$ curler test ./examples/todos.ts get-todo-by-id --print
# Get todo by id
GET https://jsonplaceholder.typicode.com/todos/1

HTTP *
[Asserts]
status == 200
jsonpath "$.id" == 1
header "Content-Type" contains "json"
```

The status is an assert like any other, under hurl's `HTTP *` wildcard. hurl's `HTTP 200` line would
say the same thing and stop the entry there, hiding every other failure behind a wrong status.

Each request gets a hurl file of its own, named after its registry path, because hurl counts files:
a four-request collection in one file reports as a single test, and a failure reads
`cit/missing-todo.hurl:6:0` rather than a line number in the middle of everything. Separate files
also keep the requests independent, each with its own cookie jar.

```text
Failure cit/missing-todo.hurl (1 request(s) in 320 ms)
Success cit/list-users.hurl (1 request(s) in 320 ms)
Success create-todo.hurl (1 request(s) in 364 ms)
Success get-todo.hurl (1 request(s) in 1314 ms)
```

A folder is a directory, and hurl names its files relative to where it runs, which is how the same
paths show up in `--report-html`. That report has no other knobs: no title, no grouping. If it ever
needs them, `--report-json` is the same results as data, to render however you like.

`--print` writes the collection out as one hurl file instead of running it, for a CI job that calls
hurl itself. That one file shares a cookie jar across its requests, where `curler test` does not.
Arguments after `--` go to hurl, which is how `--report-html` and the rest reach it:

```text
curler test ./todos.ts -- --variable env=staging
curler test ./todos.ts -- --report-html ./report
```

Leaning on hurlfmt is also where the two gaps come from. Its curl parser rejects `-F`, so `.form()`
cannot be tested, and it ends a quoted value at the first newline, so a `.body()` holding one cannot
either. Both stop with a message naming the request rather than sending something else.

## Where to keep collection files

Nothing is published yet, so a collection file reaches this repo through an import map. Put a
`deno.json` beside your collection files, one per directory:

```json
{
  "imports": {
    "@curler/builder": "/Users/you/dev/repos/curler/builder/mod.ts"
  }
}
```

That file is also what points your editor at `denols`. See [Editor](#editor).

Files inside this repo need none of it: `examples/todos.ts` uses the same import line and the
workspace resolves it.

Once the package is published the map is deleted and the specifier becomes
`jsr:@curler/builder@0.1.0`. The import line in your `.ts` does not change.

## Permissions

**One binary, two permission sets.** The shim picks by subcommand, before Deno starts.

| Subcommand                | Permissions                          | Why                              |
| ------------------------- | ------------------------------------ | -------------------------------- |
| `build-curl`, `test-hurl` | `-A`                                 | Importing your file runs it.     |
| `run-curl`                | `--allow-run=curl`, read, write, env | Spawns curl, writes a temp file. |

`run-curl` needs read and write on top of `--allow-run=curl` because curl's `--dump-header` writes
the header text to a temp file, which is then read and removed. It needs env to hand curl its
environment minus the `LD_*` and `DYLD_*` variables, which Deno will not let an allow-listed spawn
inherit. See [reporter/README.md](./reporter/README.md).

That fence is worth what it is and no more. It bounds a bug in the renderer's own code. It does
**not** contain a hostile curl command, because curl reads any file over `file://` and writes
anywhere with `-o`. Treat a command you paste in as code you are about to run.

## Editor

This is a Deno workspace, so the editor needs `denols`, not a Node TypeScript server. A Node server
resolves `Request` to the browser global and reports the collection API as missing.

In Neovim with [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig), enabling both is safe:

```lua
vim.lsp.enable({ "vtsls", "denols" })
```

They never both attach. Each one's `root_dir` looks for the other's marker and bows out: `denols`
needs a `deno.json`, `deno.jsonc` or `deno.lock`, and `vtsls` returns early when it finds one.

## Neovim

[`curler_runner.lua`](https://github.com/hernancerm/dotfiles) sends the request under the cursor to
a split. It reads the key off the `R['...']` line around the cursor and writes the buffer to a temp
file, so unsaved edits are what run. The response opens as markdown with `foldmethod=marker`, so the
header blocks come up folded.

## Packages

| Path                      | Package            | What it is                              |
| ------------------------- | ------------------ | --------------------------------------- |
| [`builder/`](./builder)   | `@curler/builder`  | Builds curl commands. The only library. |
| [`cli/`](./cli)           | `@curler/cli`      | `build-curl` and `test-hurl`.           |
| [`reporter/`](./reporter) | `@curler/reporter` | Runs a command, renders the response.   |

A collection file imports the builder and nothing else. It is one file, no dependencies, and it
touches no runtime API, so it runs on Deno, Node, Bun and the browser alike. The other two are the
commands, which are Deno-only.

## Develop

```text
deno task check
deno task test
deno fmt
deno lint
```

Before publishing, `deno doc --lint <entry>` is what JSR runs. It catches undocumented exports and
public types that reference private ones.

## Contributing

I welcome issues requesting any behavior change. However, please do not submit a PR unless it's for
a trivial fix.

## License

[MIT](./LICENSE)
