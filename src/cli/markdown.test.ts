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
          },
          {
            request: { method: 'GET', url: 'https://x.test/1', headers: [], body: null },
            response: null,
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
      '# 201 Created',
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
      '# (no response)',
      '',
      'GET https://x.test/1',
    ].join('\n'),
  );
});
