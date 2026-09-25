import { strictEqual as assertEquals } from 'node:assert';
import { test } from 'node:test';
import { indentJson, markdown } from './markdown.ts';

test('indents JSON without rounding numbers or moving keys', () => {
  assertEquals(
    indentJson('{"b":9007199254740993,"2":[],"a":{"s":"x,\\"y\\":{"},"e":{ }}'),
    [
      '{',
      '  "b": 9007199254740993,',
      '  "2": [],',
      '  "a": {',
      '    "s": "x,\\"y\\":{"',
      '  },',
      '  "e": {}',
      '}',
    ].join('\n'),
  );
});

test('folds the details of an exchange', () => {
  const out = markdown({
    errors: [],
    tests: [
      {
        title: 'create-todo',
        file: '/x.spec.ts',
        line: 1,
        project: '',
        status: 'failed',
        errors: ['Expected 200\nReceived 201\n'],
        exchanges: [
          {
            request: {
              method: 'POST',
              url: 'https://x.test/todos',
              headers: [['content-type', 'application/json']],
              body: '{"a":1}',
            },
            response: { status: 201, reason: 'Created', headers: [], body: 'ok' },
            time: 142.4,
          },
          {
            request: {
              method: 'GET',
              url: 'https://x.test/1?q=buy%20milk&tag=a&tag=b',
              headers: [],
              body: null,
            },
            response: null,
            time: 30,
          },
        ],
      },
    ],
  });
  assertEquals(
    out,
    [
      '# create-todo: Expected 200',
      '',
      'Playwright{{{',
      'Received 201',
      '}}}',
      '',
      '# POST /todos · 201 Created · 142 ms · 2 B',
      '',
      'POST https://x.test/todos',
      '',
      'Request body{{{',
      '```json',
      '{',
      '  "a": 1',
      '}',
      '```',
      '}}}',
      '',
      'Request headers{{{',
      '```http',
      'content-type: application/json',
      '```',
      '}}}',
      '',
      '```',
      'ok',
      '```',
      '',
      'Response headers{{{',
      '(no headers)',
      '}}}',
      '',
      '# GET /1 · (no response) · 30 ms',
      '',
      'GET https://x.test/1?q=buy%20milk&tag=a&tag=b',
      '',
      'Request query{{{',
      'q=buy milk',
      'tag=a',
      'tag=b',
      '}}}',
      '',
      '<!-- vim: set fdm=marker: -->',
    ].join('\n'),
  );
});
