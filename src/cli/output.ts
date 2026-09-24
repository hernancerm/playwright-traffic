/**
 * What `wirepeek` prints: one JSON object, meant to be turned into whatever a reader wants, e.g.
 * markdown in an editor split. Nothing here is formatted for display, so no consumer has to undo
 * it: bodies stay the text that was sent, headers keep their order and repeats.
 */

import { reasonPhrase } from './status.ts';

/** `[name, value]`, in the order sent. A name may repeat, e.g. `set-cookie`. */
export type Header = [string, string];

export interface Exchange {
  request: {
    method: string;
    url: string;
    headers: Header[];
    /** null when nothing was sent, e.g. a GET. */
    body: string | null;
  };
  /** null when no response came back, e.g. a refused connection. */
  response: {
    status: number;
    /** From a table, since HTTP/2 sends none. null for an unknown status. */
    reason: string | null;
    headers: Header[];
    body: string;
  } | null;
}

export interface Test {
  title: string;
  /** Absolute. */
  file: string;
  line: number;
  /** '' in a config without projects. */
  project: string;
  /** Playwright's own: passed, failed, timedOut, skipped or interrupted. */
  status: string;
  /** Playwright's messages, colors stripped. */
  errors: string[];
  exchanges: Exchange[];
}

export interface Output {
  tests: Test[];
  /** Errors outside any test, e.g. a failed globalSetup. */
  errors: string[];
}

type HarHeader = { name: string; value: string };

/** The parts of a HAR entry read here, with bodies already read out of the trace. */
export interface HarExchange {
  request: { method: string; url: string; headers: HarHeader[]; body?: string };
  response: { status: number; headers: HarHeader[]; body: string };
}

function pairs(headers: HarHeader[]): Header[] {
  return headers.map(({ name, value }) => [name, value]);
}

export function exchange({ request, response }: HarExchange): Exchange {
  return {
    request: {
      method: request.method,
      url: request.url,
      headers: pairs(request.headers),
      body: request.body === undefined || request.body === '' ? null : request.body,
    },
    // The trace records a request that got no response with a status of 0 or -1.
    response:
      response.status <= 0
        ? null
        : {
            status: response.status,
            reason: reasonPhrase(response.status) || null,
            headers: pairs(response.headers),
            body: response.body,
          },
  };
}
