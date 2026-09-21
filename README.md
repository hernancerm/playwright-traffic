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
curler run ./todos.ts getTodoById | curlr     # send it, see the response
curler export ./todos.ts > todos.postman.json # hand it to someone on Postman
```

See [Where to keep collection files](#where-to-keep-collection-files) for the `deno.json` that makes
that import resolve.

Because the file is TypeScript, a `${id}` is substituted before curl ever sees it. There are no
`{{variables}}` to fill in on the other side, and a token can come from `Deno.env` or a fetch you
wrote yourself.

## Packages

| Path                          | Package                       | What it is                                                                 |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| [`curler/`](./curler)         | `@hernancerm/curler`          | Builds curl command strings. No deps, no runtime APIs, runs anywhere.      |
| [`collection/`](./collection) | `@hernancerm/curl-collection` | A `.ts` file as a request collection. The `curler` command.                |
| [`reporter/`](./reporter)     | `@hernancerm/curl-reporter`   | Runs a curl command, prints the response as markdown. The `curlr` command. |

They are split because `curler/` is worth using on its own: it is one file that only builds a
string, so it works on Deno, Node, Bun and the browser alike.

## Where to keep collection files

Not published anywhere yet, so a collection file finds this repo through an import map. Put a
`deno.json` beside your collection files, once per directory:

```json
{
  "imports": {
    "@hernancerm/curl-collection": "/Users/you/dev/repos/curler/collection/mod.ts",
    "@hernancerm/curler": "/Users/you/dev/repos/curler/curler/mod.ts"
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

Writes `curler` and `curlr` into `~/.local/bin` as shims into this repo, so a `git pull` is all an
update takes.

Not `deno install`: its shim runs with `--no-config`, and passing `--config` makes it copy the file
next to the shim, where this workspace's member paths no longer resolve.

`curler` gets `-A`, since loading your collection file runs it. `curlr` gets only
`--allow-run=curl --allow-read --allow-write`, which is why the two stay separate commands.

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
