# diego

diego is a tool that runs with Frida, and allows you to execute scripts written in any programming language.

The name is a bit of a pun, with [Diego](https://en.wikipedia.org/wiki/Diego_Rivera), who was married to Frida Kahlo, but also it stands for *D*ata *I*nspection *E*nvironment for *G*uided *O*bservation.

## why?

Frida already has a javascript-engine, built into the server/gadget, but this improves on it in several ways:

- any script JS engine is fine, like if you prefer typescript or or just modern ESM, or whatever, you are not locked-in to ancient JS engines (that often have terrible mismatches)
- wasm support - write your frida-script in anything that compiles to wasm
- import any libraries you want. It runs on your computer, so if you can install something there, you can use it, and it will use those cpabilities (like networking or AI, for example.)
- better API stability: it should work on any version of frida, without having to downgrade/upgrade server/gadget (needs testing)
- more languages in the future: write your frida script directly in python or anything else that has diego-bindings
- web GUI in the future


## installation

You need frida-server/gadget running somewhere. Once running, diego can push it's own service to the frida-server.

Diego is a bunjs-program, so if you already use that or nodejs, you can do this:

```js
bun/npm install

bun diego.js run examples/
node diego.js run frida/
```

If you prefer to not install either of these on your system, you can also use a [compiled release](https://github.com/konsumer/diego/releases/).

## usage

I want diego to be self-contained, and not require python frida-tools, in order to be useful, so I am working on adding all of it's commands:


```sh
frida
frida-kill
frida-ls
frida-ls-devices
frida-ps

frida-apk
frida-compile
frida-create
frida-discover
frida-itrace
frida-join
frida-pull
frida-push
frida-rm
frida-trace
```

Each should have very similar options, which you can lookup with `--help` like:


```sh
bun diego.js --help
bun diego.js trace --help
```


## scripts

Initially, I am just supporting javascript & typescript. A script looks like this:

```js
// this optional function runs in host to handle messages sent back and call RPC functions and stuff
export default async function host(process, args) {
  // anything you want to do with the context of the host
}
```

### future

I haven't set these up yet, but here is what I have in mind:

Interface will be similar, like this for python:

```py
def host(process, args):
  print(process.device)
```

Or wasm (here, I use C, compiled with wasi-sdk)

```c
#include "diego.h"
#include <stdio.h>

void host(DiegoProcess* process, int argc, char** argv) {
  printf("Connected: %s\n", process->device->os);
}

```




