# curler

An HTTP client whose collection format is a TypeScript file, like IntelliJ's HTTP Client but with a
real language for the values.

```ts
// todos.ts
import { curl } from '@hernancerm/curl-collection';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`);
```

```sh
curler build ./todos.ts getTodoById | curler run  # send it, see the response
curler export ./todos.ts > todos.postman.json     # hand it to someone on Postman
```

See [Where to keep collection files](#where-to-keep-collection-files) for the `deno.json` that makes
that import resolve.

Because the file is TypeScript, a `${id}` is substituted before curl ever sees it. There are no
`{{variables}}` to fill in on the other side, and a token can come from `Deno.env` or a fetch you
wrote yourself.

## Packages

| Path                          | Package                       | What it is                                                                     |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| [`builder/`](./builder)       | `@hernancerm/curl-builder`    | Builds curl command strings. No deps, no runtime APIs, runs anywhere.          |
| [`collection/`](./collection) | `@hernancerm/curl-collection` | A `.ts` file as a request collection. The `curler` command.                    |
| [`reporter/`](./reporter)     | `@hernancerm/curl-reporter`   | Runs a curl command, prints the response as markdown. Backs `curler run-curl`. |

They are split because `curler/` is worth using on its own: it is one file that only builds a
string, so it works on Deno, Node, Bun and the browser alike.

## Where to keep collection files

Not published anywhere yet, so a collection file finds this repo through an import map. Put a
`deno.json` beside your collection files, once per directory:

```json
{
  "imports": {
    "@hernancerm/curl-collection": "/Users/you/dev/repos/curler/collection/mod.ts",
    "@hernancerm/curl-builder": "/Users/you/dev/repos/curler/builder/mod.ts"
  }
}
```

Files under this repo need none of that: `examples/todos.ts` uses the same import line, and the
workspace resolves it.

That file is also what tells your editor to use `denols` instead of a Node TypeScript server. See
[Editor](#editor).

Once the packages are published the map is deleted and the specifier becomes
`jsr:@hernancerm/curl-collection@0.1.0`. The import line in your `.ts` does not change.

## Install

```sh
deno task install
```

Writes `curler` into `~/.local/bin` as a shim into this repo, so a `git pull` is all an update
takes.

Not `deno install`: its shim runs with `--no-config`, and passing `--config` makes it copy the file
next to the shim, where this workspace's member paths no longer resolve.

## Commands

| Command                              | Alias    | Does                                                 |
| ------------------------------------ | -------- | ---------------------------------------------------- |
| `curler build-curl <file.ts> <name>` | `build`  | prints one request as a curl command                 |
| `curler run-curl`                    | `run`    | sends a curl command from stdin, prints the response |
| `curler export-postman <file.ts>`    | `export` | prints a Postman v2.1 collection                     |

The alias is always the full name's first word, so you can guess it.

`run-curl` runs under `--allow-run=curl --allow-read --allow-write`. The other two import your
collection file, which runs it, so they get `-A`. The shim picks the set from the subcommand, which
is how one command keeps two permission sets.

That fence is worth what it is and no more: it bounds a bug in the renderer's own code. It does not
contain a hostile curl command, because curl can read any file over `file://` and write anywhere
with `-o`. Treat a command you paste in as code you are about to run.

## Editor

This is a Deno workspace, so point the editor at `denols`, not a Node TypeScript server. In Neovim:

```vim
" .exrc
lua vim.schedule(function() vim.lsp.enable('denols') end)
```

## Develop

```sh
deno task check
deno task test
deno fmt
```

## Neovim

`curler_runner.lua` sends the request under the cursor to a split. It reads the name off the
`export const` around the cursor and writes the buffer to a temp file, so unsaved edits are what
run.

## License

MIT
