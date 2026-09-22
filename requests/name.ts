/** The name a request goes by in an export, derived from its `export const`. */

/** `getTodoById` -> `Get todo by id`, so a plain export needs no .name(). */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
