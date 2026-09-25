/**
 * `--format=markdown+vim-folds`: the JSON as markdown to read in an editor split. The details,
 * e.g. headers, are wrapped in Vim's fold markers (`:h fold-marker`), so they come up folded.
 */

import type { Exchange, Header, Output } from './output.ts';

/**
 * Indents JSON text without parsing it into values, which would round a big id like
 * 9007199254740993 and move keys like "2" ahead of the rest.
 */
export function indentJson(text: string): string {
  let out = '';
  let depth = 0;
  const newline = () => '\n' + '  '.repeat(depth);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      let end = i + 1;
      while (text[end] !== '"') {
        end += text[end] === '\\' ? 2 : 1;
      }
      out += text.slice(i, end + 1);
      i = end;
    } else if (char === '{' || char === '[') {
      const rest = text.slice(i + 1).trimStart();
      if (rest[0] === '}' || rest[0] === ']') {
        out += char + rest[0];
        i = text.indexOf(rest[0], i + 1);
      } else {
        depth++;
        out += char + newline();
      }
    } else if (char === '}' || char === ']') {
      depth--;
      out += newline() + char;
    } else if (char === ',') {
      out += ',' + newline();
    } else if (char === ':') {
      out += ': ';
    } else if (!/\s/.test(char)) {
      out += char;
    }
  }
  return out;
}

function body(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return '(empty body)';
  }
  try {
    JSON.parse(trimmed);
  } catch {
    return '```\n' + trimmed + '\n```';
  }
  return '```json\n' + indentJson(trimmed) + '\n```';
}

function headers(pairs: Header[]): string {
  if (pairs.length === 0) {
    return '(no headers)';
  }
  // The http tag makes highlighters color names apart from values.
  return '```http\n' + pairs.map(([name, value]) => `${name}: ${value}`).join('\n') + '\n```';
}

function fold(label: string, contents: string): string {
  return `${label}{{{\n${contents}\n}}}`;
}

/** The path alone, so the outline of many requests to one host tells them apart. */
function path(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** In 1024s, as Postman counts them. */
function size(text: string): string {
  const bytes = Buffer.byteLength(text);
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function exchange({ request, response, time }: Exchange): string {
  let heading = `# ${request.method} ${path(request.url)} → `;
  if (response === null) {
    heading += `(no response) · ${Math.round(time)} ms`;
  } else {
    heading += `${response.status}` + (response.reason === null ? '' : ` ${response.reason}`);
    heading += ` · ${Math.round(time)} ms · ${size(response.body)}`;
  }
  // Body before headers on both sides: the body is what the request is about, the headers are
  // the detail you open when the body does not explain itself. A GET usually has no request
  // body, and an absent fold reads better than an empty one.
  const sections = [heading, `${request.method} ${request.url}`];
  if (request.body !== null) {
    sections.push(fold('Request body', body(request.body)));
  }
  if (request.headers.length > 0) {
    sections.push(fold('Request headers', headers(request.headers)));
  }
  if (response !== null) {
    sections.push(body(response.body));
    sections.push(fold('Response headers', headers(response.headers)));
  }
  return sections.join('\n\n') + '\n';
}

/** The first line says why, e.g. a failed expect on a 200. The rest, e.g. the diff, is folded. */
function error(title: string, message: string): string {
  const [why, ...rest] = message.split('\n');
  const detail = rest.join('\n').trim();
  let out = `# ${title}${why}\n`;
  if (detail !== '') {
    out += '\n' + fold('Playwright', detail) + '\n';
  }
  return out;
}

export function markdown(output: Output): string {
  const sections = output.errors.map((message) => error('', message));
  for (const test of output.tests) {
    if (test.errors.length > 0) {
      sections.push(error(`${test.title}: `, test.errors.join('\n\n')));
    }
    sections.push(...test.exchanges.map(exchange));
  }
  // Folds the output when saved to a file and opened again (`:h modeline`).
  sections.push('<!-- vim: set fdm=marker: -->');
  return sections.join('\n').trim();
}
