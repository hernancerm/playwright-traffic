import { reasonPhrase } from './status.ts';

/** Names lowercased, values in an array, since a header may repeat (Set-Cookie, Link). */
export type Headers = Record<string, string[]>;

export interface Request {
  /** `Name: value`, as sent. */
  headers: string[];
  body?: string;
}

export interface Report {
  /** 0 or less when no response came back. */
  status: number;
  method: string;
  url: string;
  headers: Headers;
  body: string;
  request?: Request;
}

function renderHeading(status: number): string {
  if (status <= 0) {
    return '# (no response)';
  }
  const reason = reasonPhrase(status);
  return reason ? `# ${status} ${reason}` : `# ${status}`;
}

/** A list of `Name: value`, fenced for highlighting. */
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
  const lines = Object.entries(headers).flatMap(([name, values]) =>
    values.map((value) => `${name}: ${value}`),
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
    renderHeading(report.status),
    `${report.method} ${report.url}`,
    requestBody && fold('Request body', requestBody),
    requestHeaders && fold('Request headers', requestHeaders),
    renderBody(report.body),
    fold('Response headers', renderHeaders(report.headers)),
  ];
  return sections.filter((s) => typeof s === 'string' && s !== '').join('\n\n') + '\n';
}
