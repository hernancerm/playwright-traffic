import { deepStrictEqual as assertEquals } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { init } from './init.ts';

// The dependencies are already there, so init skips npm and needs no network.
async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'playwright-traffic-'));
  const pkg = { devDependencies: { '@playwright/test': '*', '@types/node': '*' } };
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), text);
  }
  return dir;
}

test('init writes a config without testDir', async () => {
  const dir = await project({});
  try {
    assertEquals(await init(dir), 0);
    assertEquals(
      await readFile(join(dir, 'playwright.config.ts'), 'utf8'),
      "import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({});\n",
    );
    const tsconfig = JSON.parse(await readFile(join(dir, 'tsconfig.json'), 'utf8'));
    assertEquals(tsconfig.compilerOptions.types, ['node']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('init keeps the configs that are already there', async () => {
  const dir = await project({ 'playwright.config.js': 'mine', 'tsconfig.json': 'mine' });
  try {
    assertEquals(await init(dir), 0);
    assertEquals(await readFile(join(dir, 'playwright.config.js'), 'utf8'), 'mine');
    assertEquals(await readFile(join(dir, 'tsconfig.json'), 'utf8'), 'mine');
    assertEquals(
      await readFile(join(dir, 'playwright.config.ts'), 'utf8').catch(() => 'none'),
      'none',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
