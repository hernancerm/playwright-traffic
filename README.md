# curl-reporter

Runs a curl command and prints the response as markdown: status line, headers,
pretty-printed body, and the raw output in a fold.

It adds `--write-out '%{header_json}'` and `'%{json}'` to your command, so the headers
and the transfer stats come from curl itself. Needs curl 7.83 or newer.

## Use

```sh
./curlr curl -s -H 'X-Foo: bar' https://api.example.com/users/42
./curlr "curl -H 'X-Foo: bar' https://api.example.com/users/42"
pbpaste | ./curlr
```

The leading `curl` is optional. Everything else goes to curl untouched.

With no arguments the command is read from stdin, so a pasted "Copy as cURL" works
as-is, backslash line continuations included.

That mode consumes stdin, so curl cannot also read a request body from it. To pipe a
body (`-d @-`), put the command in the arguments and leave stdin to curl:

```sh
cat body.json | ./curlr curl -X POST -H 'Content-Type: application/json' \
  -d @- https://api.example.com/users
```

`--certs` (first argument) keeps the TLS certificate chain in the Raw block. It is
dropped by default because it is pages of PEM.

## Install

```sh
deno task install   # puts `curlr` on your PATH
```

## Output

````
# 200 OK

Headers{{{
content-type: application/json
}}}

```json
{
  "id": 42
}
````

Raw{{{ body, then %{header_json}, then %{json}, as curl printed them }}}

````
The `{{{` / `}}}` markers are vim fold markers (`:h fold-marker`).

## Develop

```sh
deno task test
deno fmt
````
