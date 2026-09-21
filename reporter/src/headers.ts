/**
 * Reads the response headers out of curl's `--dump-header` file.
 *
 * `%{header_json}` would hand them over already parsed, but it only exists from
 * curl 7.83, and the dump file is written anyway for the Raw block. So the
 * headers come from there and the report works on older curl.
 */

export type Headers = Record<string, string[]>;

/**
 * The last block, which is the final response: `-L` writes one per hop, and a
 * `100 Continue` gets its own. Names are lowercased and values collected into
 * an array, since a header may legitimately repeat (Set-Cookie, Link).
 */
export function parseHeaderDump(text: string): Headers {
  const blocks = text
    .replaceAll('\r\n', '\n')
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block !== '');
  const last = blocks.at(-1);
  if (last === undefined) {
    return {};
  }

  const headers: Headers = {};
  for (const line of last.split('\n')) {
    // The status line has no colon before any space, e.g. `HTTP/2 200`.
    const at = line.indexOf(':');
    if (at <= 0 || line.startsWith('HTTP/')) {
      continue;
    }
    const name = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    (headers[name] ??= []).push(value);
  }
  return headers;
}
