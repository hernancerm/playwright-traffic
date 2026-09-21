import { reasonPhrase } from "./status.ts";

export type Headers = Record<string, string[]>;

export interface Report {
  stats: Record<string, unknown>;
  headers: Headers;
  body: string;
  raw: string;
}

function renderHeading(stats: Record<string, unknown>): string {
  const code = Number(stats.response_code ?? stats.http_code ?? 0);
  if (!code) {
    // No response code means the transfer never completed; %{json} explains why.
    const why = stats.errormsg ?? `curl exit ${stats.exitcode ?? "?"}`;
    return `# (no response) ${why}`;
  }
  const reason = reasonPhrase(code);
  return reason ? `# ${code} ${reason}` : `# ${code}`;
}

function renderHeaders(headers: Headers): string {
  // header_json lowercases names and always wraps values in an array, because
  // a header may legitimately repeat (Set-Cookie, Link).
  const lines = Object.entries(headers).flatMap(([name, values]) =>
    values.map((value) => `${name}: ${value}`)
  );
  return lines.join("\n");
}

function renderBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed === "") {
    return "(empty body)";
  }
  try {
    return "```json\n" + JSON.stringify(JSON.parse(trimmed), null, 2) + "\n```";
  } catch {
    return "```\n" + trimmed + "\n```";
  }
}

function fold(label: string, contents: string): string {
  return `${label}{{{\n${contents}\n}}}`;
}

export function render(report: Report): string {
  return [
    renderHeading(report.stats),
    fold("Headers", renderHeaders(report.headers)),
    renderBody(report.body),
    fold("Raw", report.raw.replace(/\n+$/, "")),
  ].join("\n\n") + "\n";
}
