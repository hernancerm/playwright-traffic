/**
 * Split a pasted command line the way a POSIX shell would, minus expansions.
 * Only used when the whole curl command arrives as one argument, so pasting
 * `curl -H 'X-Foo: a b' url` in quotes works like typing it unquoted.
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) {
        current += line[++i];
      } else if (ch === '"') {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "\\" && i + 1 < line.length) {
      const next = line[++i];
      // A backslash-newline is a line continuation: it disappears entirely.
      if (next !== "\n") {
        current += next;
        started = true;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      continue;
    }

    if (/\s/.test(ch)) {
      if (started) {
        tokens.push(current);
      }
      current = "";
      started = false;
      continue;
    }

    current += ch;
    started = true;
  }

  if (quote !== null) {
    throw new Error(`unterminated ${quote} quote in command`);
  }
  if (started) {
    tokens.push(current);
  }
  return tokens;
}
