# curler

Keep HTTP requests as a TypeScript file. Send one from Neovim, or hand the file to Postman.

## Problem

Postman keeps my requests outside the repo, and its `{{variables}}` are a weak stand-in for a
programming language. IntelliJ's HTTP Client fixes the first half: the requests are a file in the
repo. I want that in Neovim, with a real language for the values.

## Solution

A collection is a TypeScript file. Each `export const` is a request. Send the one under the cursor
to a split, or turn the whole file into a Postman collection for someone who wants one.

```ts
// todos.ts
import { curl } from '@hernancerm/curl-collection';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`);

export const createTodo = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false });
```

```text
curler build ./todos.ts getTodoById | curler run
curler export ./todos.ts > todos.postman.json
```

## Features

- Send the request under the cursor to a split in Neovim, unsaved edits included.
- Print a request as a curl command, ready to paste into a terminal or a bug report.
- Render the response as markdown: status line, headers, pretty-printed body, raw output in a fold.
- Export the whole file as a Postman v2.1 collection.
- Substitute values in TypeScript, so a `${id}` reaches curl as the value it had.
- Read a token from `Deno.env`, a file, or a `fetch`, since a collection file is a program.
- Run the builder on Node, Bun or the browser: one file, no dependencies, no runtime APIs.
- Render a pasted "Copy as cURL" too, backslash continuations included.

## Limitations

- The commands are Deno-only.
  - `@hernancerm/curl-builder` is portable, but the CLI loads your file at runtime, which is what
    Deno does well and Node needs a `node_modules` beside every collection file to do.
- Nothing is published yet.
  - A collection file finds this repo through an import map. See
    [Where to keep collection files](#where-to-keep-collection-files).
- `curler build` and `curler export` run your file.
  - Importing a module executes it, so both carry `-A`. See [Permissions](#permissions).
- The fence on `curler run` is not a sandbox.
  - It bounds a bug in the renderer, not a hostile command. See [Permissions](#permissions).

## Requirements

- Deno >= 2.9
- curl >= 7.83 (for `--write-out '%{header_json}'`)
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
curler build ./examples/todos.ts getTodoById | curler run
```

The shim points into the clone, so a `git pull` is the whole upgrade.

> [!NOTE]
> Not `deno install`: its shim runs with `--no-config`, and passing `--config` makes it copy the
> file next to the shim, where this workspace's member paths no longer resolve.

## Collection file

One `export const` per request, and that is the whole convention: no registry to append to, no index
to keep in sync, no file name pattern. The export name becomes the request name, `getTodoById`
reading as `Get todo by id`.

| Method                    | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `.name('Get todo by id')` | Overrides the name derived from the `export const`. |
| `.desc('...')`            | Fills Postman's description.                        |

Every other method is the builder's: `.headers()`, `.json()`, `.query()`, `.bearer()`, `.form()`,
`.auth()`, `.flag()`, `.oneLine()`. See [builder/README.md](./builder/README.md).

## Commands

| Command                       | Alias    | What it does                                          |
| ----------------------------- | -------- | ----------------------------------------------------- |
| `build-curl <file.ts> <name>` | `build`  | Prints one request as a curl command.                 |
| `run-curl`                    | `run`    | Sends a curl command from stdin, prints the response. |
| `export-postman <file.ts>`    | `export` | Prints a Postman v2.1 collection.                     |

The alias is always the full name's first word, so it is guessable.

`curler run` also takes the command as arguments, which is how a pasted "Copy as cURL" works:

```text
pbpaste | curler run
curler run curl -s -H 'X-Foo: bar' https://api.example.com/users/42
```

`curler export` takes `--name` to set the collection name, which otherwise comes from the file name.

## Where to keep collection files

Nothing is published yet, so a collection file reaches this repo through an import map. Put a
`deno.json` beside your collection files, one per directory:

```json
{
  "imports": {
    "@hernancerm/curl-collection": "/Users/you/dev/repos/curler/collection/mod.ts",
    "@hernancerm/curl-builder": "/Users/you/dev/repos/curler/builder/mod.ts"
  }
}
```

That file is also what points your editor at `denols`. See [Editor](#editor).

Files inside this repo need none of it: `examples/todos.ts` uses the same import line and the
workspace resolves it.

Once the packages are published the map is deleted and the specifier becomes
`jsr:@hernancerm/curl-collection@0.1.0`. The import line in your `.ts` does not change.

## Permissions

**One binary, two permission sets.** The shim picks by subcommand, before Deno starts.

| Subcommand                     | Permissions                     | Why                              |
| ------------------------------ | ------------------------------- | -------------------------------- |
| `build-curl`, `export-postman` | `-A`                            | Importing your file runs it.     |
| `run-curl`                     | `--allow-run=curl`, read, write | Spawns curl, writes a temp file. |

`run-curl` needs read and write on top of `--allow-run=curl` because curl's `--dump-header` writes
the header text to a temp file, which is then read and removed.

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
a split. It reads the name off the `export const` around the cursor and writes the buffer to a temp
file, so unsaved edits are what run. The response opens as markdown with `foldmethod=marker`, so the
header and raw blocks come up folded.

## Packages

| Path                          | Package                       | What it is                            |
| ----------------------------- | ----------------------------- | ------------------------------------- |
| [`builder/`](./builder)       | `@hernancerm/curl-builder`    | Builds curl command strings.          |
| [`collection/`](./collection) | `@hernancerm/curl-collection` | A `.ts` file as a collection.         |
| [`reporter/`](./reporter)     | `@hernancerm/curl-reporter`   | Runs a command, renders the response. |

They are split because the builder is worth using on its own: one file, no dependencies, and it
touches no runtime API, so it runs on Deno, Node, Bun and the browser alike.

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
