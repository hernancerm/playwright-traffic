/**
 * Loads a collection file's registry and flattens it to one path per request.
 *
 * The file's default export is the registry: an object whose keys name the
 * requests and whose values are requests or nested registries. Keys are used
 * verbatim, as the request's name on the command line and as its hurl file
 * name, so a nested key reaches hurl as a directory and shows up that way in
 * the report.
 */

import { resolve, toFileUrl } from '@std/path';
import { type Curl, isCurl, type Registry } from '@curler/builder';

/** A request and the slash-joined key path it was found under. */
export interface Found {
  /** `cit/export-card-range`: the registry keys, joined. */
  path: string;
  request: Curl;
}

/**
 * Rejected so that `/` means nesting and nothing else, and so a key cannot
 * climb out of the directory hurl runs in.
 */
function badKey(key: string): string | undefined {
  if (key.trim() === '') {
    return 'is empty';
  }
  if (key.includes('/')) {
    return 'holds a `/`; nest a registry inside a registry instead';
  }
  if (key === '.' || key === '..') {
    return 'is a directory name';
  }
  return undefined;
}

/** Depth-first, so requests come out in the order the file lists them. */
function walk(registry: Registry, prefix: string[], found: Found[]): void {
  for (const [key, value] of Object.entries(registry)) {
    const gap = badKey(key);
    if (gap !== undefined) {
      throw new Error(`registry key \`${key}\` ${gap}`);
    }
    const path = [...prefix, key];
    if (isCurl(value)) {
      found.push({ path: path.join('/'), request: value });
      continue;
    }
    if (typeof value !== 'object' || value === null) {
      throw new Error(`registry key \`${path.join('/')}\` is neither a request nor a registry`);
    }
    walk(value, path, found);
  }
}

/** Every request in a registry, in the order its keys were set. */
export function flatten(registry: Registry): Found[] {
  const found: Found[] = [];
  walk(registry, [], found);
  return found;
}

/** Every request in a collection file, in file order. */
export async function load(file: string): Promise<Found[]> {
  const module = await import(toFileUrl(resolve(file)).href);
  const registry = module.default;
  if (typeof registry !== 'object' || registry === null) {
    throw new Error(
      `${file} has no registry as its default export.\n` +
        'A collection file ends with `export default R;`.',
    );
  }
  return flatten(registry);
}

/** The request at `path`, or an error naming the paths the file does have. */
export function select(file: string, found: Found[], path: string): Found {
  const hit = found.find((entry) => entry.path === path);
  if (hit !== undefined) {
    return hit;
  }
  const known = found.map((entry) => entry.path);
  throw new Error(
    `${file} has no request at \`${path}\`.\n` +
      `Requests: ${known.length > 0 ? known.join(', ') : '(none)'}`,
  );
}
