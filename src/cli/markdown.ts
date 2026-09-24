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

function exchange({ request, response }: Exchange): string {
  let heading = '# (no response)';
  if (response !== null) {
    heading = `# ${response.status}` + (response.reason === null ? '' : ` ${response.reason}`);
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
  return sections.join('\n').trim();
}
