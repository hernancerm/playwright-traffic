/**
 * A file of requests you can run one at a time and export as a whole.
 *
 *   export const getTodoById = curl('GET', `${base}/todos/${id}`);
 *
 * `curl` is curler's builder plus two optional notes that only the export
 * reads. The command string is untouched, so anything that stringifies a
 * curler request keeps working.
 */

import { Curl, type Method } from '/Users/you/dev/repos/curler/mod.ts';

export { Curl, type Method };

export interface Meta {
  name?: string;
  desc?: string;
}

export class Request extends Curl {
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

export function curl(url: string): Request;
export function curl(method: Method, url: string): Request;
export function curl(methodOrUrl: string, maybeUrl?: string): Request {
  // One argument is the url; the method is only ever the first of two.
  return maybeUrl === undefined
    ? new Request('GET', methodOrUrl)
    : new Request(methodOrUrl, maybeUrl);
}

export default curl;
