# curl-reporter

Runs a curl command and prints the response as markdown: status line, headers, pretty-printed body,
and the raw output in a fold.

It adds `--write-out '%{header_json}'` and `'%{json}'` to your command, so the headers and the
status come from curl itself, and `--dump-header` so the Raw block holds the real header text. Needs
curl 7.83 or newer.

## Use

Reached as `curler run-curl`, or its alias `curler run`.

```sh
curler run curl -s -H 'X-Foo: bar' https://api.example.com/users/42
curler run "curl -H 'X-Foo: bar' https://api.example.com/users/42"
pbpaste | curler run
```

The leading `curl` is optional. Everything else goes to curl untouched.

With no arguments the command is read from stdin, so a pasted "Copy as cURL" works as-is, backslash
line continuations included.

That mode consumes stdin, so curl cannot also read a request body from it. To pipe a body (`-d @-`),
put the command in the arguments and leave stdin to curl:

```sh
cat body.json | curler run curl -X POST -H 'Content-Type: application/json' \
  -d @- https://api.example.com/users
```

## Install

`deno task install` from the repo root. This has no binary of its own: the `curler` shim routes
`run-curl` here, under narrower permissions than the other subcommands.

It needs `--allow-read` and `--allow-write` on top of `--allow-run=curl`: curl's `--dump-header`
writes the header text to a temp file, which is then read and removed.

## Output

````text
# ✓ 200 OK

Headers{{{
```http
content-type: application/json
```
}}}

```json
{
  "id": 42
}
```

Raw{{{
HTTP/2 200
content-type: application/json

{"id":42}
}}}
````

The `{{{` / `}}}` markers are vim fold markers (`:h fold-marker`), so the header and raw blocks come
up folded in a buffer with `foldmethod=marker`.

## Develop

`deno task test` and `deno fmt` from the repo root.
