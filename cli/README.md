# @curler/cli

Part of [curler](..). The `curler` command: `build-curl` and `test-hurl`.

A `.ts` file is a request collection. Run one request, or check them all against hurl.

This is a command, not a library: a collection file imports [@curler/builder](../builder) and
nothing from here.

## A collection file

```ts
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

The default export is the registry. A key is the request's name on the command line, used verbatim,
and the hurl file it runs as.

- `.desc('...')` is printed above the request in the hurl file.
- `.assert('status == 201')` is what `curler test` checks, the status included.

Every other method is the builder's: `.headers()`, `.json()`, `.query()`, `.bearer()`, and so on.
See [builder/README.md](../builder/README.md).

## Folders

A value that is not a request is a nested registry, and a request's path is the keys joined:

```ts
R['cit'] = {
  'export-card-range': curl(`${base}/export`),
};
```

```sh
curler build ./cards.ts cit/export-card-range
```

Which is why `/` is the one character a key cannot hold. A key also cannot be empty or `..`, since
every path becomes a file name under the directory hurl runs in.

That bare `@curler/builder` is not published yet. It resolves through a `deno.json` beside your
collection files: see [Where to keep collection files](../README.md#where-to-keep-collection-files).

## Run one request

```sh
curler build ./todos.ts get-todo-by-id | curler run
```

`curler build-curl` only prints the command. [@curler/reporter](../reporter) is what sends it. Drop
the pipe to see the curl line on its own, ready to paste somewhere.

## Check the responses

```sh
curler test ./todos.ts
curler test ./todos.ts get-todo-by-id
curler test ./todos.ts --print > todos.hurl
```

`.assert()` is the whole vocabulary curler adds. A line is written in
[hurl's syntax](https://hurl.dev/docs/asserting-response.html) and handed to hurl untouched, so
jsonpath, xpath, regex, header, cookie, duration and certificate predicates all work.

The status goes in there too, as `status == 200` under hurl's `HTTP *` wildcard. hurl's `HTTP 200`
line says the same thing but stops the entry at a mismatch, so a wrong status would hide every other
failure.

The conversion is hurlfmt's: curler prints the curl command it always prints, pipes it through
`hurlfmt --in curl`, and appends the `[Asserts]` block. That is why `-u`, `-k`, `-L` and `--retry`
reach hurl's `[Options]` without curler knowing what they mean.

Each request runs as a hurl file of its own, named after its registry path, so a folder is a
directory. hurl counts files, so this is what makes a four-request collection report as four tests
and a failure read `cit/missing-todo.hurl:6:0`. It also gives every request its own cookie jar.
`--print` is the exception: it writes the whole collection as one file, which shares one.

hurl runs in that directory, so `--report-html` labels its rows with the same paths.

Two commands hurlfmt's curl parser cannot read, and both fail rather than run:

- `.form()`, because it sends `-F`, a flag hurlfmt does not have.
- A body holding a newline, because hurlfmt ends a quoted value at the first one.

Arguments after `--` go to hurl, which is how `--variable`, `--report-html` and the rest reach it:

```sh
curler test ./todos.ts -- --variable env=staging
curler test ./todos.ts -- --report-html ./report
```

## Permissions

Both subcommands here import your file, which runs it, so the installed `curler` carries `-A`.
Naming permissions per collection file is a chore for code you wrote yourself. That `-A` also covers
spawning `hurlfmt` and `hurl`.
