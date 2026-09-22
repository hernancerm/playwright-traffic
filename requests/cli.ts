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
import { exportPostman } from './postman.ts';

const USAGE = `curler: run and export requests from a TypeScript collection file.

  curler build-curl <file.ts> <export name>        print one request as a curl command
  curler run-curl                                  send a curl command on stdin, print the response
  curler export-postman <file.ts> [--name <name>]  print a Postman v2.1 collection
  curler test-hurl <file.ts> [<export name>]       check responses with hurl

Aliases: build, run, export, test.

Every \`export const\` holding a curl(...) request is a request. The export name
is its name unless the request sets .name().

  curler build ./todos.ts getTodoById | curler run
  curler export ./todos.ts > todos.postman.json
  pbpaste | curler run

test-hurl runs every request in the file, or the one named. What it checks is
the request's own .assert() lines. It needs hurl on PATH, and takes
--print to write the hurl file out instead of running it. Arguments after \`--\`
go to hurl:

  curler test ./todos.ts
  curler test ./todos.ts getTodoById
  curler test ./todos.ts --print > todos.hurl
  curler test ./todos.ts -- --variable env=staging
`;

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '-h' || command === '--help') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }

  if (command === 'build-curl' || command === 'build') {
    const [file, name] = rest;
    if (file === undefined || name === undefined) {
      console.error('curler: build-curl needs a file and an export name\n');
      console.error(USAGE);
      return 2;
    }
    return await buildCurl(file, name);
  }

  if (command === 'export-postman' || command === 'export') {
    const [file, ...flags] = rest;
    if (file === undefined) {
      console.error('curler: export-postman needs a file\n');
      console.error(USAGE);
      return 2;
    }
    let name: string | undefined;
    if (flags[0] === '--name') {
      if (flags[1] === undefined) {
        console.error('curler: --name needs a value');
        return 2;
      }
      name = flags[1];
    }
    return await exportPostman(file, name);
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
    // Whatever is left is the export name; there is at most one.
    const name = own.filter((flag) => flag !== '--print')[0];
    return await testHurl(file, name, { print, hurlArgs });
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
