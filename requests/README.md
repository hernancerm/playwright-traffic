# @curler/requests

Part of [curler](..). Backs `curler build-curl`, `curler test-hurl` and `curler export-postman`.

A `.ts` file is a request collection. Run one request, check them all against hurl, or export the
whole file as a Postman collection.

Requests are [@curler/builder](../builder) builders, so the command is the same one you would paste
in a terminal. This adds the notes the exports read and the checks hurl runs.

## A collection file

```ts
import { curl } from '@curler/requests';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`);

export const createTodo = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false })
  .assert('status == 201', 'jsonpath "$.title" == "Buy milk"');
```

One `export const` per request. Nothing else is required: the export name becomes the item name,
`getTodoById` reading as `Get todo by id`.

- `.name('Get todo by id')` overrides that.
- `.desc('...')` fills Postman's description.
- `.assert('status == 201')` is what `curler test` checks, the status included.

Every other method is curler's: `.headers()`, `.json()`, `.query()`, `.bearer()`, and so on.

That bare name is not published yet. It resolves through a `deno.json` beside your collection files:
see [Where to keep collection files](../README.md#where-to-keep-collection-files).

## Run one request

```sh
curler build ./todos.ts getTodoById | curler run
```

`curler build-curl` only prints the command. [@curler/reporter](../reporter) is what sends it. Drop
the pipe to see the curl line on its own, ready to paste somewhere.

## Check the responses

```sh
curler test ./todos.ts
curler test ./todos.ts getTodoById
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

Each request runs as a hurl file of its own, named after the export. hurl counts files, so this is
what makes a four-request collection report as four tests and a failure read `missingTodo.hurl:6:0`.
It also gives every request its own cookie jar. `--print` is the exception: it writes the whole
collection as one file, which shares one.

Two commands hurlfmt's curl parser cannot read, and both fail rather than run:

- `.form()`, because it sends `-F`, a flag hurlfmt does not have.
- A body holding a newline, because hurlfmt ends a quoted value at the first one.

Arguments after `--` go to hurl, which is how `--variable`, `--report-html` and the rest reach it:

```sh
curler test ./todos.ts -- --variable env=staging
```

## Export

```sh
curler export ./todos.ts > todos.postman.json
curler export ./todos.ts --name 'Todos (dev)'
```

The collection name defaults to the file name. Items come out sorted by export name, which is how a
module hands its exports over.

Template values are substituted in TypeScript, so a `${id}` lands in the collection as the value it
had. There are no Postman `{{variables}}` to fill in on the other side.

`.flag()` arguments are dropped: they are curl flags with no Postman equivalent.

## Why `isRequest` and not `instanceof`

Today every route to this module ends at the same file, so `instanceof Request` would do. That stops
holding the moment the package is published: a collection file importing `jsr:@curler/requests`
reaches a different URL than the CLI's copy, Deno loads the class twice, and `instanceof` goes false
for a request the CLI was just handed. `isRequest()` looks for a `Symbol.for` mark instead, and that
registry is one per process, not one per module.

## Permissions

Every subcommand here imports your file, which runs it, so the installed `curler` carries `-A`.
Naming permissions per collection file is a chore for code you wrote yourself. That `-A` also covers
spawning `hurlfmt` and `hurl`.
