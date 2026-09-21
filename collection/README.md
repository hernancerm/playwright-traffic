# curl-collection

A `.ts` file is a request collection. Run one request from nvim, or export the whole file as a
Postman collection.

Requests are [curler](../curler) builders, so the command string is the same one you would paste in
a terminal. This adds two optional notes that only the export reads.

## A collection file

```ts
import { curl } from '/Users/you/dev/repos/curl-collection/mod.ts';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`);

export const createTodo = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false });
```

One `export const` per request. Nothing else is required: the export name becomes the Postman item
name, `getTodoById` reading as `Get todo by id`.

- `.name('Get todo by id')` overrides that.
- `.desc('...')` fills Postman's description.

Every other method is curler's: `.headers()`, `.json()`, `.query()`, `.bearer()`, and so on.

## Export

```sh
deno task export ./todos.ts > todos.postman.json
deno task export ./todos.ts --name 'Todos (dev)'
```

The task is `-A`. Exporting loads your file, so its own `fetch` or `Deno.env` calls need those
permissions too, and naming them per file is a chore for code you wrote.

The collection name defaults to the file name. Items come out sorted by export name, which is how a
module hands its exports over.

Template values are substituted in TypeScript, so a `${id}` lands in the collection as the value it
had. There are no Postman `{{variables}}` to fill in on the other side.

`.flag()` arguments are dropped: they are curl flags with no Postman equivalent.

## Run one request

```sh
deno task run ./todos.ts getTodoById | curlr
```

The nvim side is `curler_runner.lua`: it reads the name off the `export const` around the cursor,
writes the buffer to a temp file so unsaved edits are what run, and pipes `run.ts` into
[curl-reporter](../curl-reporter). The cursor has to sit inside an `export const`, since that name
is how a request is asked for.

## Develop

```sh
deno task check
deno fmt
```
