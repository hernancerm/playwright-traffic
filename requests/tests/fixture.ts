/** A collection the hurl tests convert. Nothing here is ever sent. */

import { curl } from '../mod.ts';

export const getTodo = curl('GET', 'https://example.test/todos/1')
  .assert('status == 200', 'jsonpath "$.id" == 1');

export const createTodo = curl('POST', 'https://example.test/todos')
  .name('Make a todo')
  .json({ title: 'Buy milk' })
  .assert('status == 201');

export const plain = curl('GET', 'https://example.test/ping');

export const retried = curl('GET', 'https://example.test/slow')
  .flag('--retry', '3')
  .assert('status == 200');

export const uploaded = curl('POST', 'https://example.test/files')
  .form({ a: '1' })
  .assert('status == 200');

export const multiline = curl('POST', 'https://example.test/text')
  .body('line1\nline2')
  .assert('status == 200');
