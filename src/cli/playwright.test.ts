import { deepStrictEqual as assertEquals } from 'node:assert';
import { test } from 'node:test';
import { pickLine } from './playwright.ts';

const specs = [
  { title: 'get-todo', line: 3 },
  { title: 'create-todo', line: 7 },
  { title: 'create-todo', line: 12 },
  { title: 'in-a-loop', line: 20 },
  { title: 'in-a-loop', line: 20 },
];

test('a line picks the nearest test at or above it', () => {
  assertEquals(pickLine(specs, { line: 5 }), 3);
  assertEquals(pickLine(specs, { line: 7 }), 7);
  assertEquals(pickLine(specs, { line: 2 }), 'no test at or above line 2');
});

test('a title picks the test with that exact title', () => {
  assertEquals(pickLine(specs, { title: 'get-todo' }), 3);
  assertEquals(pickLine(specs, { title: 'get' }), 'no test titled get');
});

test('a title on tests made in a loop picks their shared line', () => {
  assertEquals(pickLine(specs, { title: 'in-a-loop' }), 20);
});

test('a title in two places asks for the line', () => {
  assertEquals(
    pickLine(specs, { title: 'create-todo' }),
    'create-todo is at lines 7, 12, use <file.ts>:<line>',
  );
});
