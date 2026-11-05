#!/usr/bin/env node
/** The `playwright-traffic` command. */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { markdown } from './markdown.ts';
import type { Output } from './output.ts';
import { showTest } from './playwright.ts';

const FORMATS: Record<string, (output: Output) => string> = {
  json: (output) => JSON.stringify(output, null, 2),
  'markdown+vim-folds': markdown,
};

const USAGE = `playwright-traffic: show the requests a Playwright test sends.

Usage:
  playwright-traffic [--format=<format>] <file.ts>:<line>
  playwright-traffic [--format=<format>] --title=<title> <file.ts>

  Runs the nearest test at or above <line>, or the test titled <title>, and prints its requests.

Options:
  --format=json                 one JSON object, e.g. to pipe to jq (default)
  --format=markdown+vim-folds   markdown, details in Vim fold markers (:h fold-marker)
  -t, --title=<title>           the test's exact title, without its describes
  -h, --help                    show this help
  -v, --version                 show the version`;

async function main(args: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        format: { type: 'string', default: 'json' },
        title: { type: 'string', short: 't' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    console.error(`playwright-traffic: ${(error as Error).message}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [location] = positionals;

  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.version) {
    // Two levels up from both src/cli/ (run from source) and dist/cli/ (built).
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    return 0;
  }
  if (location === undefined) {
    console.error(USAGE);
    return 2;
  }
  if (values.title !== undefined && /:\d+$/.test(location)) {
    console.error('playwright-traffic: --title and :<line> both pick a test, give one');
    return 2;
  }
  const format = FORMATS[values.format];
  if (format === undefined) {
    const known = Object.keys(FORMATS).join(', ');
    console.error(`playwright-traffic: unknown format ${values.format}, expected one of: ${known}`);
    return 2;
  }

  return await showTest(location, format, values.title);
}

process.exitCode = await main(process.argv.slice(2));
