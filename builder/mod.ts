/**
 * Builds curl command strings, and carries the notes a runner reads. It never
 * runs anything itself.
 *
 *   curl('POST', 'http://localhost:8080/api/v1/contacts')
 *     .headers({ 'Cache-Control': 'nocache' })
 *     .json({ name: 'John Doe' })
 *     .assert('status == 201')
 *
 * The result stringifies on its own, so `console.log(cmd)` and
 * `${cmd}` both work without a build step.
 *
 * `.desc()` and `.assert()` are strings this file only stores, so the no
 * dependencies, no runtime APIs promise holds with them here.
 */

// A collection file imports this class by its own specifier (`jsr:...`), while
// a runner holds it from the workspace. Those are two copies of the class, so
// `instanceof` is false for a request the runner was handed. `Symbol.for` reads
// from one process-wide registry, so the mark crosses that split.
const BRAND = Symbol.for('curler-builder.curl');

/**
 * An HTTP method. The `string & {}` arm keeps autocomplete on the common verbs
 * while still allowing anything (PROPFIND, MKCOL, ...).
 */
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

/** A header, form or query value. Anything else is `String()`d. */
export type Primitive = string | number | boolean;

/** Wraps a value in single quotes, the only quoting `sh` never reinterprets. */
function quote(value: string): string {
  // A single quote cannot appear inside single quotes, so close, escape, reopen.
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * A tree of commands: keys name them, and a nested registry is a folder.
 * A collection file default-exports one of these.
 */
export interface Registry {
  [key: string]: Curl | Registry;
}

/** A curl command being built. Every method returns the builder, so they chain in any order. */
export class Curl {
  /** See `BRAND`. Set so {@link isCurl} recognises this across copies of the module. */
  readonly [BRAND] = true;
  #desc?: string;
  /** Set by {@link Curl.assert}. Lines for hurl's `[Asserts]`. */
  readonly asserts: string[] = [];
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

  /** Prefer {@link curl}: it reads better and defaults the method to GET. */
  constructor(method: Method, url: string) {
    this.#method = method;
    this.#url = url;
  }

  /** A note a runner prints above the command. Nothing here reads it. */
  desc(desc: string): this {
    this.#desc = desc;
    return this;
  }

  /** What {@link Curl.desc} was given, for a runner to print. */
  get description(): string | undefined {
    return this.#desc;
  }

  /**
   * Adds lines to hurl's `[Asserts]`, each written in hurl's syntax:
   *
   *   .assert('status == 200', 'jsonpath "$.id" == 1')
   *
   * The status is one of these and not a method of its own, so that a wrong
   * status still reports every other failure. hurl's `HTTP 200` line, which
   * nothing here emits, stops the entry at the first mismatch.
   *
   * See https://hurl.dev/docs/asserting-response.html for the predicates.
   */
  assert(...asserts: string[]): this {
    this.asserts.push(...asserts);
    return this;
  }

  /** Adds one `-H` per entry. A repeated name wins, ignoring case. */
  headers(headers: Record<string, Primitive>): this {
    for (const [name, value] of Object.entries(headers)) {
      this.#headers.set(name.toLowerCase(), { name, value: String(value) });
    }
    return this;
  }

  /** Adds one header. */
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

  /** Adds `-u user:password`. */
  auth(user: string, password: string): this {
    this.#flags.push('-u', quote(`${user}:${password}`));
    return this;
  }

  /** Adds an `Authorization: Bearer` header. */
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

  /** The command, on one line if {@link oneLine} was set, else with backslash continuations. */
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

  /**
   * `console.log(cmd)` inspects the object rather than calling toString(), so
   * without this it prints `Curl {}`: every field is private. A plain
   * well-known symbol, so nothing here ties this module to a runtime.
   */
  [Symbol.for('Deno.customInspect')](): string {
    return this.toString();
  }

  /** The same, for Node and Bun. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }
}

/** Builds a GET. */
export function curl(url: string): Curl;
/** Builds a request with an explicit method. */
export function curl(method: Method, url: string): Curl;
export function curl(methodOrUrl: string, maybeUrl?: string): Curl {
  // One argument is the url; the method is only ever the first of two.
  return maybeUrl === undefined ? new Curl('GET', methodOrUrl) : new Curl(methodOrUrl, maybeUrl);
}

/** True for a command from any copy of this module. See `BRAND`. */
export function isCurl(value: unknown): value is Curl {
  return typeof value === 'object' && value !== null && BRAND in value;
}

export default curl;
