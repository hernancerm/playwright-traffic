/**
 * Prints one request from a collection file as a curl command.
 *
 * Loading the file runs it, so the CLI grants `-A` to cover whatever your own
 * code does. Pipe the output to `curler run-curl` to send it.
 */

import { load, select } from './registry.ts';

export async function buildCurl(file: string, path: string): Promise<number> {
  let request;
  try {
    request = select(file, await load(file), path).request;
  } catch (error) {
    console.error(`curler: ${error instanceof Error ? error.message : error}`);
    return 1;
  }

  console.log(String(request));
  return 0;
}
