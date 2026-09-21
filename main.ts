import { type Headers, render } from "./src/render.ts";
import { tokenize } from "./src/tokenize.ts";

const USAGE = `curl-reporter: run a curl command, print the response as markdown.

  curlr curl -s -H 'X-Foo: bar' https://api.example.com/users/42
  curlr "curl -H 'X-Foo: bar' https://api.example.com/users/42"
  pbpaste | curlr

The leading \`curl\` is optional. Every other argument is passed to curl as-is.
With no arguments the command is read from stdin, which suits a pasted "Copy as
cURL" with its backslash line continuations.

Options (must come first):
  --certs   keep the TLS certificate chain in the Raw block (dropped by default)
`;

function curlArgs(args: string[]): string[] {
  const tokens = args.length === 1 && /\s/.test(args[0]) ? tokenize(args[0]) : args;
  return tokens[0] === "curl" ? tokens.slice(1) : tokens;
}

async function readStdin(): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of Deno.stdin.readable) {
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

async function main(): Promise<number> {
  let args = Deno.args;
  if (args[0] === "-h" || args[0] === "--help") {
    console.log(USAGE);
    return 0;
  }

  const keepCerts = args[0] === "--certs";
  if (keepCerts) {
    args = args.slice(1);
  }

  if (args.length === 0) {
    if (Deno.stdin.isTerminal()) {
      console.log(USAGE);
      return 2;
    }
    // Reading the command from stdin consumes it, so curl cannot also read a
    // request body from stdin (-d @-) in this mode.
    args = [await readStdin()];
    if (args[0].trim() === "") {
      console.error("curl-reporter: empty command on stdin");
      return 2;
    }
  }

  // A random marker keeps the split honest even when a response body happens to
  // contain the literal separator text.
  const marker = "CURLR" + crypto.randomUUID().replaceAll("-", "");
  const writeOut = `\\n${marker}\\n%{header_json}\\n${marker}\\n%{json}`;

  const command = new Deno.Command("curl", {
    // --write-out comes last so it wins over any -w the caller passed.
    args: [...curlArgs(args), "--silent", "--show-error", "--write-out", writeOut],
    // output() defaults stdin to "null"; inheriting keeps `-d @-` working.
    stdin: "inherit",
    stdout: "piped",
    stderr: "inherit",
  });
  const { code, stdout } = await command.output();

  const text = new TextDecoder().decode(stdout);
  const parts = text.split(`\n${marker}\n`);
  if (parts.length !== 3) {
    if (text !== "") {
      await Deno.stdout.write(stdout);
    }
    return code === 0 ? 1 : code;
  }

  const [body, headerJson, statsJson] = parts;

  let headers: Headers;
  let stats: Record<string, unknown>;
  try {
    headers = JSON.parse(headerJson);
    stats = JSON.parse(statsJson);
  } catch (error) {
    console.error(`curl-reporter: could not parse curl's write-out: ${error}`);
    await Deno.stdout.write(stdout);
    return 1;
  }

  // %{json} carries the whole PEM chain in `certs`, which is pages long and
  // buries everything else in the Raw block. --certs keeps it.
  let statsOut = statsJson;
  if (!keepCerts && "certs" in stats) {
    const { certs: _certs, ...rest } = stats;
    statsOut = JSON.stringify(rest);
  }
  const raw = [body, headerJson, statsOut].join("\n");

  await Deno.stdout.write(
    new TextEncoder().encode(render({ stats, headers, body, raw })),
  );
  return code;
}

if (import.meta.main) {
  Deno.exit(await main());
}
