/**
 * Prints one request from a collection file as a curl command.
 *
 * Loading the file runs it, so the CLI grants `-A` to cover whatever your own
 * code does. Pipe the output to curl-reporter to see the response.
 */

import { resolve, toFileUrl } from '@std/path';
import { isRequest } from './mod.ts';

export async function run(file: string, name: string): Promise<number> {
  const module = await import(toFileUrl(resolve(file)).href);
  const request = module[name];
  if (!isRequest(request)) {
    const known = Object.entries(module)
      .filter(([, value]) => isRequest(value))
      .map(([key]) => key);
    console.error(
      `curler: ${file} has no request exported as \`${name}\`.\n` +
        `Exported requests: ${known.length > 0 ? known.join(', ') : '(none)'}`,
    );
    return 1;
  }

  console.log(String(request));
  return 0;
}
