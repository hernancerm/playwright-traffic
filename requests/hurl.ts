/**
 * Runs requests as a hurl file, so hurl does the asserting.
 *
 * `hurlfmt --in curl` turns curler's own curl command into a hurl request, so
 * the curl-flag to `[Options]` mapping stays hurl's to maintain. curler only
 * appends the response section that `.assert()` describes, and gives each
 * request a file of its own so hurl counts them one by one.
 */

import { join, resolve, toFileUrl } from '@std/path';
import { isRequest, type Request } from './mod.ts';
import { humanize } from './name.ts';

/** How `curler test-hurl` was invoked. */
export interface TestOptions {
  /** Print the hurl file instead of running it. */
  print?: boolean;
  /** Extra arguments for hurl, everything the CLI saw after `--`. */
  hurlArgs?: string[];
}

/**
 * Why hurlfmt cannot read this command, or undefined when it can.
 *
 * Both gaps are in hurlfmt's curl parser, not in hurl: it rejects `-F`
 * outright, and it ends a quoted value at the first newline.
 */
function unconvertible(args: string[]): string | undefined {
  if (args.includes('-F')) {
    return '`.form()` sends curl -F, which hurlfmt does not know.';
  }
  if (args.some((arg) => arg.includes('\n'))) {
    return 'a value holds a newline, which hurlfmt reads as the end of the command.';
  }
  return undefined;
}

/** Feeds a curl command to `hurlfmt --in curl` and returns the hurl it wrote. */
async function convert(command: string): Promise<string> {
  let child;
  try {
    child = new Deno.Command('hurlfmt', {
      args: ['--in', 'curl'],
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped',
    }).spawn();
  } catch {
    throw new Error('hurlfmt not found on PATH. It ships with hurl: https://hurl.dev');
  }

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(command + '\n'));
  await writer.close();

  const { code, stdout, stderr } = await child.output();
  const decoder = new TextDecoder();
  if (code !== 0) {
    throw new Error(decoder.decode(stderr).trim());
  }
  return decoder.decode(stdout).trim();
}

/**
 * Drops a response section hurlfmt wrote on its own. `--retry` makes it add
 * one (`HTTP *` with `status < 500`), and an entry cannot hold two. Only called
 * when curler has a section of its own to put there.
 */
function withoutResponse(entry: string): string {
  const lines = entry.split('\n');
  let inBody = false;
  for (let i = 0; i < lines.length; i++) {
    // hurlfmt always fences a body, so a `HTTP ...` line inside one is text.
    if (lines[i].startsWith('```')) {
      inBody = !inBody;
      continue;
    }
    if (!inBody && /^HTTP[ \t]/.test(lines[i])) {
      return lines.slice(0, i).join('\n').trimEnd();
    }
  }
  return entry;
}

/**
 * The `[Asserts]` block, or undefined when the request asserts nothing.
 *
 * Always under `HTTP *`: the section needs a status line to open it, and the
 * wildcard leaves the status itself to a `status == 200` assert, which reports
 * alongside the others instead of short-circuiting them.
 */
function responseSection(asserts: string[]): string | undefined {
  if (asserts.length === 0) {
    return undefined;
  }
  return ['HTTP *', '[Asserts]', ...asserts].join('\n');
}

/** One request, ready to be written as its own hurl file. */
export interface Entry {
  /** The export name, which is also the file name hurl reports failures under. */
  key: string;
  /** The hurl text: a comment naming the request, then the entry. */
  document: string;
}

/** One request as a hurl entry, headed by a comment naming it. */
async function toEntry(key: string, request: Request): Promise<Entry> {
  const name = request.meta.name ?? humanize(key);
  const gap = unconvertible(request.toArgs());
  if (gap !== undefined) {
    throw new Error(`cannot convert \`${name}\` to hurl: ${gap}`);
  }

  const converted = await convert(String(request));
  const response = responseSection(request.asserts);
  const entry = response === undefined ? converted : `${withoutResponse(converted)}\n\n${response}`;

  return { key, document: `# ${name}\n${entry}` };
}

/** Every request in a collection, or the one named. */
export async function toEntries(file: string, name?: string): Promise<Entry[]> {
  const module = await import(toFileUrl(resolve(file)).href);
  // A module's exports come back sorted by name, so entries are alphabetical.
  const requests = Object.entries(module)
    .filter((entry): entry is [string, Request] => isRequest(entry[1]));

  if (name !== undefined) {
    const found = requests.find(([key]) => key === name);
    if (found === undefined) {
      const known = requests.map(([key]) => key);
      throw new Error(
        `${file} has no request exported as \`${name}\`.\n` +
          `Exported requests: ${known.length > 0 ? known.join(', ') : '(none)'}`,
      );
    }
    return [await toEntry(found[0], found[1])];
  }

  if (requests.length === 0) {
    throw new Error(`no exported curl(...) requests in ${file}`);
  }
  const entries = [];
  for (const [key, request] of requests) {
    entries.push(await toEntry(key, request));
  }
  return entries;
}

/**
 * The collection as one hurl file, which is what `--print` writes.
 *
 * `curler test` runs a file per request instead. The difference is hurl's:
 * requests in one file share a cookie jar, requests in separate files do not.
 */
export async function toHurl(file: string, name?: string): Promise<string> {
  const entries = await toEntries(file, name);
  return entries.map((entry) => entry.document).join('\n\n');
}

/**
 * Hands the entries to `hurl --test`, whose exit code becomes ours.
 *
 * One file per request, not one per collection: hurl counts files, so a
 * four-request collection in one file reports as a single test. Separate files
 * also keep the requests independent, each with its own cookie jar, which is
 * what a bag of exports is.
 *
 * Files rather than hurl's stdin, because hurl names the source in every
 * failure it reports: `getTodoById.hurl:5:0` locates one where `-:5:0` does
 * not. Run from the temp dir so that name stays short.
 */
async function runHurl(entries: Entry[], args: string[]): Promise<number> {
  const dir = await Deno.makeTempDir({ prefix: 'curler-' });
  try {
    const names = [];
    for (const entry of entries) {
      const name = `${entry.key}.hurl`;
      await Deno.writeTextFile(join(dir, name), entry.document + '\n');
      names.push(name);
    }
    const command = new Deno.Command('hurl', {
      args: ['--test', ...args, ...names],
      cwd: dir,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const { code } = await command.output();
    return code;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error('curler: hurl not found on PATH. See https://hurl.dev');
      return 127;
    }
    throw error;
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

export async function testHurl(
  file: string,
  name?: string,
  options: TestOptions = {},
): Promise<number> {
  let entries: Entry[];
  try {
    entries = await toEntries(file, name);
  } catch (error) {
    console.error(`curler: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  if (options.print) {
    console.log(entries.map((entry) => entry.document).join('\n\n'));
    return 0;
  }
  return await runHurl(entries, options.hurlArgs ?? []);
}
