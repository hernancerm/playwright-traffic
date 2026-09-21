/**
 * Prints one request from a collection file as a curl command.
 *
 *   deno run -A run.ts ./todos.ts getTodoById
 *
 * Loading the file runs it, so `-A` covers whatever your own code does. Pipe the
 * output to curl-reporter to see the response.
 */

import { resolve, toFileUrl } from '@std/path';
import { Curl } from './mod.ts';

const USAGE = `curl-collection: print one request as a curl command.

  run.ts <file.ts> <export name>
`;

async function main(): Promise<number> {
  const [file, name] = Deno.args;
  if (file === undefined || name === undefined || file === '-h' || file === '--help') {
    console.log(USAGE);
    return file === undefined ? 2 : 0;
  }

  const module = await import(toFileUrl(resolve(file)).href);
  const request = module[name];
  if (!(request instanceof Curl)) {
    const known = Object.entries(module)
      .filter(([, value]) => value instanceof Curl)
      .map(([key]) => key);
    console.error(
      `curl-collection: ${file} has no request exported as \`${name}\`.\n` +
        `Exported requests: ${known.length > 0 ? known.join(', ') : '(none)'}`,
    );
    return 1;
  }

  console.log(String(request));
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main());
}
