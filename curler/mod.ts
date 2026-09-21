/**
 * Builds curl command strings. It never runs anything.
 *
 *   curl('POST', 'http://localhost:8080/api/v1/contacts')
 *     .headers({ 'Cache-Control': 'nocache' })
 *     .json({ name: 'John Doe' })
 *
 * The result stringifies on its own, so `console.log(cmd)` and
 * `${cmd}` both work without a build step.
 */

// The `string & {}` arm keeps autocomplete on the common verbs while still
// allowing anything (PROPFIND, MKCOL, ...).
export type Method =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  // deno-lint-ignore ban-types
  | (string & {});

export type Primitive = string | number | boolean;

/** Wraps a value in single quotes, the only quoting `sh` never reinterprets. */
function quote(value: string): string {
  // A single quote cannot appear inside single quotes, so close, escape, reopen.
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export class Curl {
  #method: Method;
  #url: string;
  // Keyed by lowercase name so a later .headers() replaces an earlier one that
  // differs only in casing.
  #headers = new Map<string, { name: string; value: string }>();
  #query: [string, string][] = [];
  #form: [string, string][] = [];
  #flags: string[] = [];
  #body?: string;
  #jsonBody = false;
  #oneLine = false;

  constructor(method: Method, url: string) {
    this.#method = method;
    this.#url = url;
  }

  headers(headers: Record<string, Primitive>): this {
    for (const [name, value] of Object.entries(headers)) {
      this.#headers.set(name.toLowerCase(), { name, value: String(value) });
    }
    return this;
  }

  header(name: string, value: Primitive): this {
    return this.headers({ [name]: value });
  }

  /** Sets the body to JSON and, unless you set one yourself, the content type. */
  json(value: unknown): this {
    this.#body = JSON.stringify(value);
    this.#jsonBody = true;
    return this;
  }

  /** Raw body, sent as given. No content type is guessed. */
  body(value: string): this {
    this.#body = value;
    this.#jsonBody = false;
    return this;
  }

  /** Multipart fields (`-F`). Prefix a value with `@` to send a file. */
  form(fields: Record<string, Primitive>): this {
    for (const [name, value] of Object.entries(fields)) {
      this.#form.push([name, String(value)]);
    }
    return this;
  }

  /** Appends to the query string. Values are percent-encoded. */
  query(params: Record<string, Primitive>): this {
    for (const [name, value] of Object.entries(params)) {
      this.#query.push([name, String(value)]);
    }
    return this;
  }

  auth(user: string, password: string): this {
    this.#flags.push('-u', quote(`${user}:${password}`));
    return this;
  }

  bearer(token: string): this {
    return this.header('Authorization', `Bearer ${token}`);
  }

  /** Escape hatch for flags with no method of their own, e.g. `.flag('-k')`. */
  flag(...flags: string[]): this {
    this.#flags.push(...flags);
    return this;
  }

  /** Emit everything on one line instead of backslash continuations. */
  oneLine(oneLine = true): this {
    this.#oneLine = oneLine;
    return this;
  }

  #fullUrl(): string {
    if (this.#query.length === 0) {
      return this.#url;
    }
    const search = this.#query
      .map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`)
      .join('&');
    const separator = this.#url.includes('?') ? '&' : '?';
    return `${this.#url}${separator}${search}`;
  }

  /** The command as an array of already-quoted arguments. */
  toArgs(): string[] {
    const hasBody = this.#body !== undefined || this.#form.length > 0;
    const args = ['curl'];

    // curl infers POST from -d/-F, so -X is only needed to contradict it.
    if (this.#method !== 'GET' || hasBody) {
      args.push('-X', this.#method);
    }
    args.push(quote(this.#fullUrl()));

    for (const { name, value } of this.#headers.values()) {
      args.push('-H', quote(`${name}: ${value}`));
    }
    if (this.#jsonBody && !this.#headers.has('content-type')) {
      args.push('-H', quote('Content-Type: application/json'));
    }
    for (const [name, value] of this.#form) {
      args.push('-F', quote(`${name}=${value}`));
    }
    if (this.#body !== undefined) {
      args.push('-d', quote(this.#body));
    }
    args.push(...this.#flags);
    return args;
  }

  toString(): string {
    const args = this.toArgs();
    if (this.#oneLine) {
      return args.join(' ');
    }
    // Group each flag with its value so a line never ends on a lone `-H`.
    const lines: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('-') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        lines.push(`${args[i]} ${args[i + 1]}`);
        i++;
      } else {
        lines.push(args[i]);
      }
    }
    return lines.join(' \\\n  ');
  }
}

export function curl(url: string): Curl;
export function curl(method: Method, url: string): Curl;
export function curl(methodOrUrl: string, maybeUrl?: string): Curl {
  // One argument is the url; the method is only ever the first of two.
  return maybeUrl === undefined ? new Curl('GET', methodOrUrl) : new Curl(methodOrUrl, maybeUrl);
}

export default curl;
