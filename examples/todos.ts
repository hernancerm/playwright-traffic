import { curl } from '@curler/requests';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

export const getTodoById = curl('GET', `${base}/todos/${id}`)
  .assert(
    'status == 200',
    `jsonpath "$.id" == ${id}`,
    'header "Content-Type" contains "json"',
  );

export const createTodo = curl('POST', `${base}/todos`)
  .desc('The placeholder API fakes the write, the response is not persisted.')
  .json({ title: 'Buy milk', completed: false })
  .assert('status == 201', 'jsonpath "$.title" == "Buy milk"');
