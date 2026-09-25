#!/usr/bin/env node
/** The `playwright-traffic` command. */

import { parseArgs } from 'node:util';
import { markdown } from './markdown.ts';
import type { Output } from './output.ts';
import { showTest } from './playwright.ts';

const FORMATS: Record<string, (output: Output) => string> = {
  json: (output) => JSON.stringify(output, null, 2),
  'markdown+vim-folds': markdown,
};

const USAGE = `playwright-traffic: show the requests a Playwright test sends.

  playwright-traffic [--format=<format>] <file.ts>:<line>
      run the nearest test at or above the line, print its requests

  --format=json                 (default) one JSON object, e.g. to pipe to jq
  --format=markdown+vim-folds   markdown, details in Vim fold markers (:h fold-marker)

  playwright-traffic ./todos.spec.ts:12 | jq
`;

async function main(args: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        format: { type: 'string', default: 'json' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    console.error(`playwright-traffic: ${(error as Error).message}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [location] = positionals;

  if (values.help || location === undefined) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const format = FORMATS[values.format];
  if (format === undefined) {
    const known = Object.keys(FORMATS).join(', ');
    console.error(`playwright-traffic: unknown format ${values.format}, expected one of: ${known}`);
    return 2;
  }

  return await showTest(location, format);
}

process.exitCode = await main(process.argv.slice(2));
