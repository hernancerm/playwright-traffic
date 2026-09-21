/**
 * The environment curl is given, without the dynamic linker's variables.
 *
 * Under `--allow-run=curl` Deno refuses to spawn at all while `LD_LIBRARY_PATH`
 * or an `LD_PRELOAD` is set, and it is right to: those load arbitrary code into
 * curl, so an allow-list naming one program would promise something it cannot
 * keep. Dropping them is what buys the allow-list back.
 *
 * The cost: a curl that needs one of them to find its libraries will not start.
 * That fails loudly, and the fix is to widen the shim to a plain `--allow-run`.
 */
export function withoutLinkerVars(env: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('LD_') && !name.startsWith('DYLD_')) {
      safe[name] = value;
    }
  }
  return safe;
}
