/**
 * Playwright's `test` and `expect`, plus one rule: a test that asserts nothing fails on a 4xx or
 * 5xx. Otherwise a request with no asserts yet is green while the server errors.
 *
 * The rule knows a test asserted by its calls to this `expect`, so import both from here.
 */

import { type APIResponse, expect as baseExpect, test as base } from '@playwright/test';

// A worker runs one test at a time, so one flag is enough.
let asserted = false;

function marked<F extends (...args: never[]) => unknown>(fn: F, self: unknown): F {
  return new Proxy(fn, {
    apply(target, _, args) {
      asserted = true;
      return Reflect.apply(target, self, args);
    },
  });
}

// `expect.soft(...)` and `expect.poll(...)` count as asserts too.
export const expect: typeof baseExpect = new Proxy(marked(baseExpect, undefined), {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? marked(value, target) : value;
  },
});

const SENDS = new Set(['fetch', 'get', 'post', 'put', 'patch', 'delete', 'head']);

export const test = base.extend({
  request: async ({ request }, use) => {
    asserted = false;
    const errors: string[] = [];
    await use(
      new Proxy(request, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          if (typeof value !== 'function') {
            return value;
          }
          if (!SENDS.has(String(prop))) {
            return value.bind(target);
          }
          return async (...args: unknown[]) => {
            const response: APIResponse = await value.apply(target, args);
            if (response.status() >= 400) {
              errors.push(`${response.status()} ${response.url()}`);
            }
            return response;
          };
        },
      }),
    );
    if (!asserted && errors.length > 0) {
      throw new Error(`no asserts, and the server answered ${errors.join(', ')}`);
    }
  },
});
