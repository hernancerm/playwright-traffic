/**
 * Runs one Playwright test with tracing on, then renders every request it sent as markdown. The
 * trace is where the exchange is read from because it holds what went over the wire, e.g. the
 * content-type Playwright adds for `data:`, which the test itself never sees.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { render } from './render.ts';

const run = promisify(execFile);

const CONFIGS = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];

/** The nearest directory above `file` with a Playwright config, which is where npx must run. */
async function projectRoot(file: string): Promise<string | undefined> {
  let dir = dirname(resolve(file));
  while (true) {
    for (const name of CONFIGS) {
      try {
        await stat(join(dir, name));
        return dir;
      } catch {
        // Not here, keep climbing.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

async function* traces(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* traces(path);
    } else if (entry.name === 'trace.zip') {
      yield path;
    }
  }
}

/** A zip member as text. `unzip` ships with macOS and most Linux, which beats a zip dependency. */
async function unzipText(zip: string, member: string): Promise<string> {
  const { stdout } = await run('unzip', ['-p', zip, member], { maxBuffer: Infinity });
  return stdout;
}

type HarHeader = { name: string; value: string };

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: HarHeader[];
    postData?: { text?: string; _file?: string };
  };
  response: {
    status: number;
    headers: HarHeader[];
    content: { text?: string; _file?: string };
  };
}

async function bodyText(zip: string, part: { text?: string; _file?: string }): Promise<string> {
  if (part._file) {
    return await unzipText(zip, part._file);
  }
  return part.text ?? '';
}

async function renderTrace(zip: string): Promise<string[]> {
  // The HAR entries are the `resource-snapshot` lines of the `*.network` files. A test that
  // opens a page has browser requests in there too, and those render the same way.
  const lines = (await unzipText(zip, '*.network')).split('\n').filter((line) => line !== '');
  const out: string[] = [];
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.type !== 'resource-snapshot') {
      continue;
    }
    const { request, response } = event.snapshot as HarEntry;
    const headers: Record<string, string[]> = {};
    for (const { name, value } of response.headers) {
      (headers[name.toLowerCase()] ??= []).push(value);
    }
    out.push(
      render({
        status: response.status,
        method: request.method,
        url: request.url,
        headers,
        body: await bodyText(zip, response.content),
        request: {
          headers: request.headers.map(({ name, value }) => `${name}: ${value}`),
          body: request.postData && (await bodyText(zip, request.postData)),
        },
      }),
    );
  }
  return out;
}

export async function showTest(file: string, title: string): Promise<number> {
  const root = await projectRoot(file);
  if (root === undefined) {
    console.error(`curler: no ${CONFIGS[0]} above ${file}`);
    return 2;
  }
  const output = await mkdtemp(join(tmpdir(), 'curler-'));
  try {
    // A failing test exits non-zero, which is an answer here, not an error.
    const { code, stdout, stderr } = await run(
      'npx',
      [
        'playwright',
        'test',
        resolve(file),
        '--grep',
        // --grep is a regex, so a title like `adds (x)` must not be read as a group.
        title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        '--trace',
        'on',
        '--retries',
        '0',
        '--output',
        output,
        '--reporter',
        'line',
      ],
      { cwd: root, env: { ...process.env, FORCE_COLOR: '0' }, maxBuffer: Infinity },
    ).then(
      (done) => ({ code: 0, ...done }),
      (failed: { code?: number; stdout?: string; stderr?: string }) => ({
        code: typeof failed.code === 'number' ? failed.code : 1,
        stdout: failed.stdout ?? '',
        stderr: failed.stderr ?? String(failed),
      }),
    );
    const log = stdout + stderr;

    const sections: string[] = [];
    for await (const zip of traces(output)) {
      sections.push(...(await renderTrace(zip)));
    }
    if (code !== 0) {
      // The first error line says why, e.g. a failed expect on a 200. The whole log is folded
      // below for the diff and the source excerpt.
      const why = log
        .split('\n')
        .find((line) => line.trim().startsWith('Error:'))
        ?.trim();
      sections.unshift(`# ✗ ${why ?? 'test failed'}\n\nPlaywright{{{\n${log.trimEnd()}\n}}}\n`);
    }
    if (sections.length === 0) {
      console.log(log.trimEnd());
      return code === 0 ? 1 : code;
    }
    console.log(sections.join('\n').trimEnd());
    return code;
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}
