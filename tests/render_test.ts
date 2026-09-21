import { assertEquals } from "jsr:@std/assert@1";
import { render } from "../src/render.ts";
import { tokenize } from "../src/tokenize.ts";

Deno.test("renders a json response", () => {
  const out = render({
    stats: { response_code: 200 },
    headers: { "content-type": ["application/json"] },
    body: '{"id":42,"name":"Martín"}',
    raw: "RAW",
  });
  assertEquals(
    out,
    [
      "# 200 OK",
      "",
      "Headers{{{",
      "content-type: application/json",
      "}}}",
      "",
      "```json",
      '{\n  "id": 42,\n  "name": "Martín"\n}',
      "```",
      "",
      "Raw{{{",
      "RAW",
      "}}}",
      "",
    ].join("\n"),
  );
});

Deno.test("repeated headers each get a line", () => {
  const out = render({
    stats: { response_code: 204 },
    headers: { "set-cookie": ["a=1", "b=2"] },
    body: "",
    raw: "",
  });
  assertEquals(out.includes("set-cookie: a=1\nset-cookie: b=2"), true);
  assertEquals(out.includes("(empty body)"), true);
});

Deno.test("non-json body uses a plain fence", () => {
  const out = render({
    stats: { response_code: 404 },
    headers: {},
    body: "not found",
    raw: "",
  });
  assertEquals(out.startsWith("# 404 Not Found"), true);
  assertEquals(out.includes("```\nnot found\n```"), true);
});

Deno.test("a failed transfer says why", () => {
  const out = render({
    stats: { response_code: 0, errormsg: "Could not resolve host: nope" },
    headers: {},
    body: "",
    raw: "",
  });
  assertEquals(out.startsWith("# (no response) Could not resolve host: nope"), true);
});

Deno.test("tokenize handles quotes and continuations", () => {
  assertEquals(
    tokenize('curl -H \'X-Foo: a b\' -d "{\\"a\\": 1}" \\\n  https://x.test'),
    ["curl", "-H", "X-Foo: a b", "-d", '{"a": 1}', "https://x.test"],
  );
  assertEquals(tokenize("curl --data ''  url"), ["curl", "--data", "", "url"]);
});
