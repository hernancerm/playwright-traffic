/**
 * Pulls the request side out of the curl arguments.
 *
 * curl reports the response through `--write-out`, but nothing about what it
 * sent, so the only source for that is the command itself.
 */

export interface Request {
  /** As written on the command line. Not curl's implicit Host, User-Agent or Accept. */
  headers: string[];
  /** `-d` joined with `&`, as curl does, or the `-F` fields one per line. */
  body?: string;
}

const HEADER = new Set(['-H', '--header']);
// Every spelling curl accepts for a request body. They differ in encoding, not
// in where the value sits, so the value is read the same way for all of them.
const DATA = new Set([
  '-d',
  '--data',
  '--data-raw',
  '--data-ascii',
  '--data-binary',
  '--data-urlencode',
]);
const FORM = new Set(['-F', '--form']);

export function parseRequest(args: string[]): Request {
  const headers: string[] = [];
  const data: string[] = [];
  const form: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const value = args[i + 1];
    if (value === undefined) {
      continue;
    }
    if (HEADER.has(args[i])) {
      headers.push(value);
      i++;
    } else if (DATA.has(args[i])) {
      data.push(value);
      i++;
    } else if (FORM.has(args[i])) {
      form.push(value);
      i++;
    }
  }

  if (form.length > 0) {
    return { headers, body: form.join('\n') };
  }
  // curl concatenates repeated -d with `&`, so the report should too.
  return { headers, body: data.length > 0 ? data.join('&') : undefined };
}
