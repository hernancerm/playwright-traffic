import { reasonPhrase } from './status.ts';
import type { Headers } from './headers.ts';
import type { Request } from './request.ts';

export type { Headers };

export interface Report {
  stats: Record<string, unknown>;
  headers: Headers;
  body: string;
  /** The `curl -i` text. Absent unless asked for, see wantsRaw. */
  raw?: string;
  request?: Request;
}

function renderHeading(stats: Record<string, unknown>): string {
  const code = Number(stats.response_code ?? stats.http_code ?? 0);
  if (!code) {
    // No response code means the transfer never completed; %{json} explains why.
    const why = stats.errormsg ?? `curl exit ${stats.exitcode ?? '?'}`;
    return `# ✗ (no response) ${why}`;
  }
  // A redirect is a real answer, so 3xx is a tick; only 4xx/5xx are a cross.
  const mark = code < 400 ? '✓' : '✗';
  const reason = reasonPhrase(code);
  return reason ? `# ${mark} ${code} ${reason}` : `# ${mark} ${code}`;
}

/** `POST https://x/todos`, so the report says what was called, not just how it went. */
function renderTarget(stats: Record<string, unknown>): string | undefined {
  const method = typeof stats.method === 'string' ? stats.method : '';
  const url = typeof stats.url === 'string' ? stats.url : '';
  if (!url) {
    return undefined;
  }
  const line = method ? `${method} ${url}` : url;
  // url_effective is where curl ended up, so it only adds anything after a redirect.
  const effective = stats.url_effective;
  if (typeof effective === 'string' && effective !== url) {
    return `${line}\n-> ${effective}`;
  }
  return line;
}

/** A list of `Name: value` as curl was given them, fenced for highlighting. */
function renderRequestHeaders(request: Request | undefined): string | undefined {
  if (!request || request.headers.length === 0) {
    return undefined;
  }
  return '```http\n' + request.headers.join('\n') + '\n```';
}

function renderRequestBody(request: Request | undefined): string | undefined {
  if (!request || request.body === undefined || request.body === '') {
    return undefined;
  }
  return renderBody(request.body);
}

function renderHeaders(headers: Headers): string {
  // Names arrive lowercased and values in an array, because a header may
  // legitimately repeat (Set-Cookie, Link). See parseHeaderDump.
  const lines = Object.entries(headers).flatMap(([name, values]) =>
    values.map((value) => `${name}: ${value}`)
  );
  if (lines.length === 0) {
    return '(no headers)';
  }
  // The http tag makes highlighters color names apart from values.
  return '```http\n' + lines.join('\n') + '\n```';
}

function renderBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed === '') {
    return '(empty body)';
  }
  try {
    return '```json\n' + JSON.stringify(JSON.parse(trimmed), null, 2) + '\n```';
  } catch {
    return '```\n' + trimmed + '\n```';
  }
}

function fold(label: string, contents: string): string {
  return `${label}{{{\n${contents}\n}}}`;
}

export function render(report: Report): string {
  const requestHeaders = renderRequestHeaders(report.request);
  const requestBody = renderRequestBody(report.request);
  // A GET usually has neither, and an absent fold reads better than an empty one.
  // Body before headers on both sides: the body is what the request is about,
  // the headers are the detail you open when the body does not explain itself.
  const sections = [
    renderHeading(report.stats),
    renderTarget(report.stats),
    requestBody && fold('Request body', requestBody),
    requestHeaders && fold('Request headers', requestHeaders),
    renderBody(report.body),
    fold('Response headers', renderHeaders(report.headers)),
    report.raw !== undefined && fold('Raw', report.raw.replace(/\n+$/, '')),
  ];
  return sections.filter((s) => typeof s === 'string' && s !== '').join('\n\n') + '\n';
}
