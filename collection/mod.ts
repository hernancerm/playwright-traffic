/**
 * A file of requests you can run one at a time and export as a whole.
 *
 *   export const getTodoById = curl('GET', `${base}/todos/${id}`);
 *
 * `curl` is curler's builder plus two optional notes that only the export
 * reads. The command string is untouched, so anything that stringifies a
 * curler request keeps working.
 */

import { Curl, type Method } from '@hernancerm/curl-builder';

export { Curl, type Method };

// A collection file imports this class by its own specifier (`jsr:...`), while
// the CLI holds it from the workspace. Those are two copies of the class, so
// `instanceof` is false for a request the CLI was handed. `Symbol.for` reads
// from one global registry, so the mark crosses that split.
const BRAND = Symbol.for('curl-collection.request');

export interface Meta {
  name?: string;
  desc?: string;
}

export class Request extends Curl {
  readonly [BRAND] = true;
  readonly meta: Meta = {};

  /** Overrides the name the export derives from the `export const` it is bound to. */
  name(name: string): this {
    this.meta.name = name;
    return this;
  }

  /** Postman's description field. */
  desc(desc: string): this {
    this.meta.desc = desc;
    return this;
  }
}

/** True for a request from any copy of this module. See `BRAND`. */
export function isRequest(value: unknown): value is Request {
  return typeof value === 'object' && value !== null && BRAND in value;
}

export function curl(url: string): Request;
export function curl(method: Method, url: string): Request;
export function curl(methodOrUrl: string, maybeUrl?: string): Request {
  // One argument is the url; the method is only ever the first of two.
  return maybeUrl === undefined
    ? new Request('GET', methodOrUrl)
    : new Request(methodOrUrl, maybeUrl);
}

export default curl;
