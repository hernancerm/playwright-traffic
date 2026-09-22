/** A collection the hurl tests convert. Nothing here is ever sent. */

import { curl, type Registry } from '@curler/builder';

const R: Registry = {};

R['get-todo'] = curl('https://example.test/todos/1')
  .assert('status == 200', 'jsonpath "$.id" == 1');

R['create-todo'] = curl('POST', 'https://example.test/todos')
  .desc('Fake write.')
  .json({ title: 'Buy milk' })
  .assert('status == 201');

R['plain'] = curl('https://example.test/ping');

R['cit'] = {
  'retried': curl('https://example.test/slow')
    .flag('--retry', '3')
    .assert('status == 200'),
};

export default R;
