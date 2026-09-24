#!/usr/bin/env node
/** The `wirepeek` command. */

import { showTest } from './playwright.ts';

const USAGE = `wirepeek: show the requests a Playwright test sends.

  wirepeek <file.ts>:<line>   run the nearest test at or above the line, print its requests as
                              JSON

  npx wirepeek ./todos.spec.ts:12 | jq
`;

async function main(args: string[]): Promise<number> {
  const [location] = args;

  if (location === undefined || location === '-h' || location === '--help') {
    console.log(USAGE);
    return location === undefined ? 2 : 0;
  }

  return await showTest(location);
}

process.exitCode = await main(process.argv.slice(2));
