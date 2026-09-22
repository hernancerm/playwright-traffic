/**
 * The `curler` command.
 *
 * Every subcommand has a full kebab-case name and one alias, always its first
 * word, so the short form is guessable from the long one.
 *
 * `run-curl` is the odd one out: it is served by the reporter, under narrower
 * permissions than the rest. The shim `deno task install` writes dispatches on
 * the subcommand before this file is ever loaded, so the name is listed here
 * for `--help` only. See scripts/install.ts.
 */

import { buildCurl } from './curl.ts';
import { testHurl } from './hurl.ts';

const USAGE = `curler: run requests from a TypeScript collection file.

  curler build-curl <file.ts> <path>   print one request as a curl command
  curler run-curl                      send a curl command on stdin, print the response
  curler test-hurl <file.ts> [<path>]  check responses with hurl

Aliases: build, run, test.

A collection file default-exports a registry: its keys name the requests, and a
nested registry is a folder. A path is those keys joined with \`/\`.

  curler build ./todos.ts get-todo-by-id | curler run
  curler build ./cards.ts cit/export-card-range | curler run
  pbpaste | curler run

test-hurl runs every request in the file, or the one at the path. What it checks
is the request's own .assert() lines. It needs hurl on PATH, and takes --print
to write the hurl file out instead of running it. Arguments after \`--\` go to
hurl:

  curler test ./todos.ts
  curler test ./todos.ts get-todo-by-id
  curler test ./todos.ts --print > todos.hurl
  curler test ./todos.ts -- --report-html ./report
`;

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '-h' || command === '--help') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }

  if (command === 'build-curl' || command === 'build') {
    const [file, path] = rest;
    if (file === undefined || path === undefined) {
      console.error('curler: build-curl needs a file and a request path\n');
      console.error(USAGE);
      return 2;
    }
    return await buildCurl(file, path);
  }

  if (command === 'test-hurl' || command === 'test') {
    const [file, ...flags] = rest;
    if (file === undefined) {
      console.error('curler: test-hurl needs a file\n');
      console.error(USAGE);
      return 2;
    }
    const at = flags.indexOf('--');
    const hurlArgs = at === -1 ? [] : flags.slice(at + 1);
    const own = at === -1 ? flags : flags.slice(0, at);
    const print = own.includes('--print');
    // Whatever is left is the request path; there is at most one.
    const path = own.filter((flag) => flag !== '--print')[0];
    return await testHurl(file, path, { print, hurlArgs });
  }

  // Reaching here means the shim did not route it, so the shim and this list
  // have drifted apart.
  if (command === 'run-curl' || command === 'run') {
    console.error(
      'curler: run-curl should have been handled by the shim; reinstall with `deno task install`',
    );
    return 70;
  }

  console.error(`curler: unknown command \`${command}\`\n`);
  console.error(USAGE);
  return 2;
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
