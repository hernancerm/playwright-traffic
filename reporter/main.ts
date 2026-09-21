import { type Headers, render } from "./src/render.ts";
import { tokenize } from "./src/tokenize.ts";

const USAGE = `curl-reporter: run a curl command, print the response as markdown.

  curlr curl -s -H 'X-Foo: bar' https://api.example.com/users/42
  curlr "curl -H 'X-Foo: bar' https://api.example.com/users/42"
  pbpaste | curlr

The leading \`curl\` is optional. Every other argument is passed to curl as-is.
With no arguments the command is read from stdin, which suits a pasted "Copy as
cURL" with its backslash line continuations.
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

  // curl has no write-out variable for the headers as they came off the wire, so
  // --dump-header takes them to a file, out of the way of the body on stdout.
  const headerFile = await Deno.makeTempFile({ prefix: "curlr-" });

  let code: number;
  let stdout: Uint8Array;
  let headerText: string;
  try {
    const command = new Deno.Command("curl", {
      // Ours come last so they win over anything the caller passed.
      args: [
        ...curlArgs(args),
        "--silent",
        "--show-error",
        "--dump-header",
        headerFile,
        "--write-out",
        writeOut,
      ],
      // output() defaults stdin to "null"; inheriting keeps `-d @-` working.
      stdin: "inherit",
      stdout: "piped",
      stderr: "inherit",
    });
    ({ code, stdout } = await command.output());
    headerText = await Deno.readTextFile(headerFile);
  } finally {
    await Deno.remove(headerFile).catch(() => {});
  }

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

  // What `curl -i` would have printed: the header block(s), a blank line, the
  // body. The CRs are dropped because they only show up as noise in a buffer.
  const raw = headerText.replaceAll("\r\n", "\n").replace(/\n+$/, "") + "\n\n" + body;

  await Deno.stdout.write(
    new TextEncoder().encode(render({ stats, headers, body, raw })),
  );
  return code;
}

if (import.meta.main) {
  Deno.exit(await main());
}
