/**
 * Turns a file of exported requests into a Postman v2.1 collection on stdout.
 *
 *   deno run --allow-read export.ts ./todos.ts > todos.postman.json
 *
 * Values are already substituted by the time we see them: a `${id}` in the
 * source becomes the literal value, never a Postman `{{id}}`.
 */

import { basename, resolve, toFileUrl } from 'jsr:@std/path@1';
import { Request } from './mod.ts';

const USAGE = `curl-collection: export a requests file as a Postman collection.

  export.ts <file.ts> [--name <collection name>]

Every \`export const\` holding a curl(...) request becomes an item. The export
name is the item name unless the request sets .name().
`;

interface Item {
  name: string;
  request: Record<string, unknown>;
}

/** `getTodoById` -> `Get todo by id`, so a plain export needs no .name(). */
function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Undoes curler's `quote()`. Arguments it left bare (flags) pass through. */
function unquote(arg: string): string {
  if (!arg.startsWith("'")) {
    return arg;
  }
  return arg.slice(1, -1).replaceAll(`'\\''`, "'");
}

/**
 * Reads the request back off `toArgs()` rather than off the builder's fields,
 * so the export cannot drift from the command that actually runs.
 */
function toItem(name: string, request: Request): Item {
  // Drops the leading `curl`.
  const args = request.toArgs().slice(1);
  let i = 0;

  let method = 'GET';
  if (args[i] === '-X') {
    method = unquote(args[i + 1]);
    i += 2;
  }
  const url = unquote(args[i]);
  i++;

  const headers: { key: string; value: string }[] = [];
  const form: Record<string, string>[] = [];
  let body: string | undefined;
  let auth: Record<string, unknown> | undefined;

  for (; i < args.length; i++) {
    const value = unquote(args[i + 1] ?? '');
    switch (args[i]) {
      case '-H': {
        const at = value.indexOf(':');
        headers.push({ key: value.slice(0, at), value: value.slice(at + 1).trim() });
        i++;
        break;
      }
      case '-F': {
        const at = value.indexOf('=');
        const key = value.slice(0, at);
        const field = value.slice(at + 1);
        // `@path` is curl's "send this file"; Postman keeps it as a src path.
        form.push(
          field.startsWith('@')
            ? { key, type: 'file', src: field.slice(1) }
            : { key, type: 'text', value: field },
        );
        i++;
        break;
      }
      case '-d':
        body = value;
        i++;
        break;
      case '-u': {
        const at = value.indexOf(':');
        auth = {
          type: 'basic',
          basic: [
            { key: 'username', value: value.slice(0, at), type: 'string' },
            { key: 'password', value: value.slice(at + 1), type: 'string' },
          ],
        };
        i++;
        break;
      }
        // Anything else came from .flag() and has no Postman equivalent.
    }
  }

  const isJson = headers.some(
    (h) => h.key.toLowerCase() === 'content-type' && h.value.includes('json'),
  );

  const item: Item = {
    name: request.meta.name ?? name,
    request: {
      method,
      header: headers,
      url: { raw: url },
    },
  };
  if (request.meta.desc !== undefined) {
    item.request.description = request.meta.desc;
  }
  if (auth !== undefined) {
    item.request.auth = auth;
  }
  if (form.length > 0) {
    item.request.body = { mode: 'formdata', formdata: form };
  } else if (body !== undefined) {
    item.request.body = {
      mode: 'raw',
      raw: body,
      options: { raw: { language: isJson ? 'json' : 'text' } },
    };
  }
  return item;
}

async function main(): Promise<number> {
  const args = [...Deno.args];
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(USAGE);
    return args.length === 0 ? 2 : 0;
  }

  const file = args.shift()!;
  let collectionName = basename(file).replace(/\.ts$/, '');
  if (args[0] === '--name') {
    if (args[1] === undefined) {
      console.error('curl-collection: --name needs a value');
      return 2;
    }
    collectionName = args[1];
  }

  const module = await import(toFileUrl(resolve(file)).href);
  // A module's exports come back sorted by name, so items are alphabetical.
  const items = Object.entries(module)
    .filter((entry): entry is [string, Request] => entry[1] instanceof Request)
    .map(([key, request]) => toItem(humanize(key), request));

  if (items.length === 0) {
    console.error(`curl-collection: no exported curl(...) requests in ${file}`);
    return 1;
  }

  const collection = {
    info: {
      name: collectionName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };
  console.log(JSON.stringify(collection, null, 2));
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main());
}
