# curl-collection

A `.ts` file is a request collection. Run one request, or export the whole file as a Postman
collection.

Requests are [curler](../curler) builders, so the command is the same one you would paste in a
terminal. This adds two optional notes that only the export reads.

## A collection file

```ts
import { curl } from 'jsr:@hernancerm/curl-collection@0.1.0';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`);

export const createTodo = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false });
```

One `export const` per request. Nothing else is required: the export name becomes the item name,
`getTodoById` reading as `Get todo by id`.

- `.name('Get todo by id')` overrides that.
- `.desc('...')` fills Postman's description.

Every other method is curler's: `.headers()`, `.json()`, `.query()`, `.bearer()`, and so on.

Pin the version in the specifier. Deno caches an import the first time it sees it, so a moving
target gives you a stale copy until `deno cache --reload`.

## Run one request

```sh
curler run ./todos.ts getTodoById | curlr
```

`curler run` only prints the command. [curl-reporter](../reporter) is what sends it. Drop the pipe
to see the curl line on its own, ready to paste somewhere.

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

Your collection file imports this module by its own specifier, usually `jsr:`, while the CLI holds
it from the workspace. Those are two copies of the class, so `instanceof Request` is false for a
request the CLI was just handed. `isRequest()` looks for a `Symbol.for` mark instead, and that
registry is global.

## Permissions

Both subcommands import your file, which runs it, so the installed `curler` carries `-A`. Naming
permissions per collection file is a chore for code you wrote yourself.
