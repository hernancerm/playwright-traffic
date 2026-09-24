#!/usr/bin/env node
/**
 * The `wirepeek` command.
 *
 * Every subcommand has a full kebab-case name and one alias, always its first
 * word, so the short form is guessable from the long one.
 */

import { showTest } from './playwright.ts';

const USAGE = `wirepeek: show the requests a Playwright test sends.

  wirepeek show-test <file.ts>:<line>   run the nearest test at or above the line, print its
                                        requests as markdown

Aliases: show.

  npx wirepeek show ./todos.spec.ts:12
`;

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '-h' || command === '--help') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }

  if (command === 'show-test' || command === 'show') {
    const [location] = rest;
    if (location === undefined) {
      console.error('wirepeek: show-test needs a <file.ts>:<line>\n');
      console.error(USAGE);
      return 2;
    }
    return await showTest(location);
  }

  console.error(`wirepeek: unknown command \`${command}\`\n`);
  console.error(USAGE);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
