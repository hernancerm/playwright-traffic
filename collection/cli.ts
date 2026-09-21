/**
 * The `curler` command: run one request from a collection file, or export the
 * whole file as a Postman collection.
 *
 * Both subcommands import your file, which runs it, so the install grants `-A`
 * to cover whatever your own code does.
 */

import { exportPostman } from './export.ts';
import { run } from './run.ts';

const USAGE = `curler: run and export requests from a TypeScript collection file.

  curler run <file.ts> <export name>      print one request as a curl command
  curler export <file.ts> [--name <name>] print a Postman v2.1 collection

Every \`export const\` holding a curl(...) request is a request. The export name
is its name unless the request sets .name().

  curler run ./todos.ts getTodoById | curlr
  curler export ./todos.ts > todos.postman.json
`;

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === undefined || command === '-h' || command === '--help') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }

  if (command === 'run') {
    const [file, name] = rest;
    if (file === undefined || name === undefined) {
      console.error('curler: run needs a file and an export name\n');
      console.error(USAGE);
      return 2;
    }
    return await run(file, name);
  }

  if (command === 'export') {
    const [file, ...flags] = rest;
    if (file === undefined) {
      console.error('curler: export needs a file\n');
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

  console.error(`curler: unknown command \`${command}\`\n`);
  console.error(USAGE);
  return 2;
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
