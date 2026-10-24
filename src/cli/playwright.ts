/**
 * Runs one Playwright test with tracing on, then prints every request it sent. The
 * trace is where the exchange is read from because it holds what went over the wire, e.g. the
 * content-type Playwright adds for `data:`, which the test itself never sees.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify, stripVTControlCharacters } from 'node:util';
import { exchange, type Exchange, type Output } from './output.ts';

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
  time: number;
  /** Set on requests sent through `request`, absent on a page's own. Newer Playwright. */
  _apiRequestRef?: string;
  /** The same mark before it was renamed, e.g. in 1.50. */
  _apiRequest?: boolean;
}

async function bodyText(zip: string, part: { text?: string; _file?: string }): Promise<string> {
  if (part._file) {
    return await unzipText(zip, part._file);
  }
  return part.text ?? '';
}

async function readTrace(zip: string): Promise<Exchange[]> {
  // The HAR entries are the `resource-snapshot` lines of the `*.network` files.
  const lines = (await unzipText(zip, '*.network')).split('\n').filter((line) => line !== '');
  const out: Exchange[] = [];
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.type !== 'resource-snapshot') {
      continue;
    }
    const entry = event.snapshot as HarEntry;
    // A page's scripts, images and fonts would bury the calls the test made.
    if (entry._apiRequestRef === undefined && !entry._apiRequest) {
      continue;
    }
    const { request, response, time } = entry;
    out.push(
      exchange({
        request: {
          ...request,
          body: request.postData && (await bodyText(zip, request.postData)),
        },
        response: { ...response, body: await bodyText(zip, response.content) },
        time,
      }),
    );
  }
  return out;
}

/** The parts of Playwright's JSON report read here. */
interface Report {
  config: { rootDir: string };
  suites?: Suite[];
  errors?: { message?: string }[];
}

interface Suite {
  specs?: {
    title: string;
    file: string;
    line: number;
    tests: {
      projectName: string;
      results: {
        status: string;
        attachments: { name: string; path?: string }[];
        errors: { message?: string }[];
      }[];
    }[];
  }[];
  suites?: Suite[];
}

type Spec = NonNullable<Suite['specs']>[number];

function* specs(suites: Suite[] = []): Generator<Spec> {
  for (const suite of suites) {
    yield* suite.specs ?? [];
    yield* specs(suite.suites);
  }
}

/** Playwright's own output, for when it failed before running anything. */
interface Failed {
  code: number;
  log: string;
}

/** Runs Playwright with the JSON reporter. A failing test exits non-zero and still reports. */
async function playwright(root: string, args: string[]): Promise<Report | Failed> {
  const dir = await mkdtemp(join(tmpdir(), 'playwright-traffic-'));
  const file = join(dir, 'report.json');
  try {
    const env = { ...process.env, FORCE_COLOR: '0', PLAYWRIGHT_JSON_OUTPUT_FILE: file };
    const { code, log } = await run('npx', ['playwright', 'test', ...args, '--reporter', 'json'], {
      cwd: root,
      env,
      maxBuffer: Infinity,
    }).then(
      (done) => ({ code: 0, log: done.stdout + done.stderr }),
      (failed: { code?: number; stdout?: string; stderr?: string }) => ({
        code: typeof failed.code === 'number' ? failed.code : 1,
        log: (failed.stdout ?? '') + (failed.stderr ?? String(failed)),
      }),
    );
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Report;
    } catch {
      return { code: code === 0 ? 1 : code, log };
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function isFailed(result: Report | Failed): result is Failed {
  return 'log' in result;
}

/** A spec is the test at `file:line` when its file is `file`; the rest are dependencies. */
function isAt(report: Report, spec: Spec, file: string): boolean {
  return resolve(report.config.rootDir, spec.file) === file;
}

/**
 * `location` is `file:line`, and the test run is the nearest one at or above that line, like
 * vim-test's nearest: any line inside a test names it. Without a line, every test in the file
 * runs. `format` turns the requests into what is printed.
 */
export async function showTest(
  location: string,
  format: (output: Output) => string,
): Promise<number> {
  const match = /^(.*):(\d+)$/.exec(location);
  const file = resolve(match ? match[1] : location);
  const cursor = match ? Number(match[2]) : undefined;
  const root = await projectRoot(file);
  if (root === undefined) {
    console.error(`playwright-traffic: no ${CONFIGS[0]} above ${file}`);
    return 2;
  }

  // Listing runs nothing, and gives each test's line.
  const list = await playwright(root, [file, '--list']);
  if (isFailed(list)) {
    console.error(list.log.trimEnd());
    return list.code;
  }
  let chosen = [...specs(list.suites)].filter((spec) => isAt(list, spec, file));
  let target = file;
  if (cursor !== undefined) {
    const line = Math.max(...chosen.map((spec) => spec.line).filter((line) => line <= cursor));
    // Tests made in a loop share a line, and Playwright runs `file:line` as all of them.
    chosen = chosen.filter((spec) => spec.line === line);
    target = `${file}:${line}`;
  }
  // Every project would run the test again, e.g. a POST once per browser, so only the first
  // project that has it runs.
  const project = chosen.flatMap((spec) => spec.tests)[0]?.projectName;
  if (project === undefined) {
    console.error(`playwright-traffic: no test at or above ${location}`);
    return 2;
  }

  const output = await mkdtemp(join(tmpdir(), 'playwright-traffic-'));
  try {
    const report = await playwright(root, [
      target,
      // A config without projects has one, named ''.
      ...(project === '' ? [] : ['--project', project]),
      '--trace',
      'on',
      '--retries',
      '0',
      '--output',
      output,
    ]);
    if (isFailed(report)) {
      console.error(report.log.trimEnd());
      return report.code;
    }

    // expect colors its messages even under FORCE_COLOR=0.
    const clean = (error: { message?: string }) =>
      stripVTControlCharacters(error.message ?? 'Playwright failed').trim();
    const out: Output = { tests: [], errors: (report.errors ?? []).map(clean) };
    // A setup project the test depends on runs too, but its requests are not the test's.
    for (const spec of [...specs(report.suites)].filter((spec) => isAt(report, spec, file))) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          const exchanges: Exchange[] = [];
          for (const attachment of result.attachments) {
            if (attachment.name === 'trace' && attachment.path) {
              exchanges.push(...(await readTrace(attachment.path)));
            }
          }
          out.tests.push({
            title: spec.title,
            file,
            line: spec.line,
            project: test.projectName,
            status: result.status,
            errors: result.errors.map(clean),
            exchanges,
          });
        }
      }
    }
    console.log(format(out));
    const failed = out.errors.length > 0 || out.tests.some((test) => test.errors.length > 0);
    return failed ? 1 : 0;
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}
