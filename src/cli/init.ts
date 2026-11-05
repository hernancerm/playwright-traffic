/** Makes a folder a Playwright project, so a test file in it can run and has types in the editor. */

import { spawn } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIGS } from './playwright.ts';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Runs npm with its output shown, since an install can take a while. */
function npm(dir: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npm', args, { cwd: dir, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

// The types of @playwright/test use Node's, e.g. Buffer, so without @types/node the editor
// shows errors in them.
const DEPENDENCIES = ['@playwright/test', '@types/node'];

// TypeScript 6 and up load no @types unless `types` names them. esnext has Symbol.asyncDispose,
// which the types of @playwright/test use.
const TSCONFIG = {
  compilerOptions: {
    target: 'esnext',
    module: 'nodenext',
    types: ['node'],
    strict: true,
    noEmit: true,
  },
};

async function missing(pkg: string): Promise<string[]> {
  const { dependencies, devDependencies } = JSON.parse(await readFile(pkg, 'utf8'));
  const present = { ...dependencies, ...devDependencies };
  return DEPENDENCIES.filter((name) => !(name in present));
}

/** Each step is skipped when its file or dependency is already there, so nothing is overwritten. */
export async function init(dir: string): Promise<number> {
  const pkg = join(dir, 'package.json');
  if (await exists(pkg)) {
    console.log('package.json exists, skipped');
  } else {
    const code = await npm(dir, ['init', '-y']);
    if (code !== 0) {
      return code;
    }
  }

  const install = await missing(pkg);
  if (install.length === 0) {
    console.log(`${DEPENDENCIES.join(' and ')} are dependencies, skipped`);
  } else {
    const code = await npm(dir, ['install', '-D', ...install]);
    if (code !== 0) {
      return code;
    }
  }

  let found: string | undefined;
  for (const name of CONFIGS) {
    if (await exists(join(dir, name))) {
      found = name;
      break;
    }
  }
  if (found !== undefined) {
    console.log(`${found} exists, skipped`);
  } else {
    // Without testDir, Playwright looks for tests in the config's folder and below it.
    const config =
      "import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({});\n";
    await writeFile(join(dir, CONFIGS[0]), config);
    console.log(`wrote ${CONFIGS[0]}`);
  }

  if (await exists(join(dir, 'tsconfig.json'))) {
    console.log('tsconfig.json exists, skipped');
  } else {
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify(TSCONFIG, null, 2) + '\n');
    console.log('wrote tsconfig.json');
  }
  return 0;
}
