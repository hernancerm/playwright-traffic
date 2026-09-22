# @curler/reporter

Part of [curler](..). Backs `curler run-curl`.

Runs a curl command and prints the exchange as markdown: status line, what was called, the request
headers and body, the response headers, and a pretty-printed body. Set `CURLER_RAW=1` for curl's own
output too, in a Raw fold.

It adds `--write-out '%{json}'` to your command, so the status, method and url come from curl
itself, and `--dump-header` so the headers are the real text off the wire. Needs curl 7.75 or newer;
on 7.70 to 7.74 everything works except the method and url line.

The headers are read back out of the `--dump-header` file rather than from `%{header_json}`, which
would hand them over parsed but only exists from curl 7.83.

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
writes the header text to a temp file, which is then read and removed. `--allow-env` is for the
paragraph below, and grants strictly less than the `--allow-read` already there.

curl is spawned without the dynamic linker's variables, the `LD_*` and `DYLD_*` ones. Under
`--allow-run=curl` Deno refuses to spawn at all while one is set, and it is right to: they load
arbitrary code into curl, so naming one program in the allow-list would promise something it cannot
keep. Every other variable is passed through, so a proxy or a `~/.curlrc` still applies.

If your curl needs `LD_LIBRARY_PATH` to find its libraries it will not start, which is loud and not
silent. The fix then is to drop the allow-list, in `scripts/install.ts`:

```text
--allow-run    instead of    --allow-run=curl
```

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
````

On both sides the body comes first and the headers follow, since the body is what the exchange is
about and the headers are the detail you unfold when it does not explain itself.

The method and url come from curl's `--write-out`, so they are what curl really used. After a
redirect the line curl ended on follows, as `-> <url>`.

The request headers and body are read back off the command, since curl reports nothing about what it
sent. So they are the `-H`, `-d` and `-F` you passed, not curl's implicit `Host`, `User-Agent` and
`Accept`, and not the `Authorization` that `-u` generates.

Both request folds are omitted when there is nothing in them, which is the usual case for a GET.

### The Raw block

`CURLER_RAW=1` appends what `curl -i` would have printed, the header block and the body as they came
off the wire, in a `Raw` fold:

```text
Raw{{{
HTTP/2 201
content-type: application/json

{"id":42}
}}}
```

It is off by default because it repeats what the report already shows, prettier. Turn it on when you
doubt the parsing, or want the bytes.

```sh
CURLER_RAW=1 curler run curl https://api.example.com/users/42
```

The `{{{` / `}}}` markers are vim fold markers (`:h fold-marker`), so every block comes up folded in
a buffer with `foldmethod=marker`.

## Develop

`deno task test` and `deno fmt` from the repo root.
