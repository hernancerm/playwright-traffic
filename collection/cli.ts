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
import { exportPostman } from './postman.ts';

const USAGE = `curler: run and export requests from a TypeScript collection file.

  curler build-curl <file.ts> <export name>        print one request as a curl command
  curler run-curl                                  send a curl command on stdin, print the response
  curler export-postman <file.ts> [--name <name>]  print a Postman v2.1 collection

Aliases: build, run, export.

Every \`export const\` holding a curl(...) request is a request. The export name
is its name unless the request sets .name().

  curler build ./todos.ts getTodoById | curler run
  curler export ./todos.ts > todos.postman.json
  pbpaste | curler run
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
