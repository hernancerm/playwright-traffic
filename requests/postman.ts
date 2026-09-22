/**
 * Turns a file of exported requests into a Postman v2.1 collection on stdout.
 *
 * Values are already substituted by the time we see them: a `${id}` in the
 * source becomes the literal value, never a Postman `{{id}}`.
 */

import { basename, resolve, toFileUrl } from '@std/path';
import { isRequest, type Request } from './mod.ts';
import { humanize } from './name.ts';

interface Item {
  name: string;
  request: Record<string, unknown>;
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

export async function exportPostman(file: string, name?: string): Promise<number> {
  const collectionName = name ?? basename(file).replace(/\.ts$/, '');

  const module = await import(toFileUrl(resolve(file)).href);
  // A module's exports come back sorted by name, so items are alphabetical.
  const items = Object.entries(module)
    .filter((entry): entry is [string, Request] => isRequest(entry[1]))
    .map(([key, request]) => toItem(humanize(key), request));

  if (items.length === 0) {
    console.error(`curler: no exported curl(...) requests in ${file}`);
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
