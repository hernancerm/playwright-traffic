import { curl, type Registry } from '@curler/builder';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

const R: Registry = {};

R['get-todo-by-id'] = curl(`${base}/todos/${id}`)
  .assert(
    'status == 200',
    `jsonpath "$.id" == ${id}`,
    'header "Content-Type" contains "json"',
  );

R['create-todo'] = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false })
  .assert('status == 201', 'jsonpath "$.title" == "Buy milk"');

export default R;
