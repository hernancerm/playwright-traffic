#!/usr/bin/env node
/**
 * The `curler` command.
 *
 * Every subcommand has a full kebab-case name and one alias, always its first
 * word, so the short form is guessable from the long one.
 */

import { showTest } from './playwright.ts';

const USAGE = `curler: show the requests a Playwright test sends.

  curler show-test <file.ts> <title>   run one test, print its requests as markdown

Aliases: show.

  npx curler show ./todos.spec.ts create-todo
`;

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '-h' || command === '--help') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }

  if (command === 'show-test' || command === 'show') {
    const [file, title] = rest;
    if (file === undefined || title === undefined) {
      console.error('curler: show-test needs a file and a test title\n');
      console.error(USAGE);
      return 2;
    }
    return await showTest(file, title);
  }

  console.error(`curler: unknown command \`${command}\`\n`);
  console.error(USAGE);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
