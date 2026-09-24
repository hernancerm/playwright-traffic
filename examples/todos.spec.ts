import { expect, test } from '../src/mod.ts';

const base = 'https://jsonplaceholder.typicode.com';
const id = 1;

test('get-todo-by-id', async ({ request }) => {
  await request.get(`${base}/todos/${id}`);
});

test('create-todo', async ({ request }) => {
  const res = await request.post(`${base}/todos`, {
    data: { title: 'Buy milk', completed: false },
  });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ title: 'Buy milk' });
});

test('get-html', async ({ request }) => {
  await request.get('https://example.com');
});

test('fails-on-purpose', async ({ request }) => {
  const res = await request.get(`${base}/todos/${id}`);
  expect(await res.json()).toMatchObject({ completed: true });
});

test('missing-todo-fails-without-asserts', async ({ request }) => {
  await request.get(`${base}/todos/999999`);
});

test('missing-todo-passes-with-asserts', async ({ request }) => {
  const res = await request.get(`${base}/todos/999999`);
  expect(res.status()).toBe(404);
});
