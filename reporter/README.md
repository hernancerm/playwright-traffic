# curl-reporter

Part of [curler](..). Backs `curler run-curl`.

Runs a curl command and prints the exchange as markdown: status line, what was called, the request
headers and body, the response headers, a pretty-printed body, and the raw output in a fold.

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
# ✓ 201 Created

POST https://api.example.com/users

Request body{{{
```json
{
  "name": "Ada"
}
```
}}}

Request headers{{{
```http
Content-Type: application/json
```
}}}

```json
{
  "id": 42
}
```

Response headers{{{
```http
content-type: application/json
```
}}}

Raw{{{
HTTP/2 201
content-type: application/json

{"id":42}
}}}
````

On both sides the body comes first and the headers follow, since the body is what the exchange is
about and the headers are the detail you unfold when it does not explain itself.

The method and url come from curl's `--write-out`, so they are what curl really used. After a
redirect the line curl ended on follows, as `-> <url>`.

The request headers and body are read back off the command, since curl reports nothing about what it
sent. So they are the `-H`, `-d` and `-F` you passed, not curl's implicit `Host`, `User-Agent` and
`Accept`, and not the `Authorization` that `-u` generates.

Both request folds are omitted when there is nothing in them, which is the usual case for a GET.

The `{{{` / `}}}` markers are vim fold markers (`:h fold-marker`), so every block comes up folded in
a buffer with `foldmethod=marker`.

## Develop

`deno task test` and `deno fmt` from the repo root.
