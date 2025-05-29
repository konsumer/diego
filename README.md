# diego

diego is a tool that runs with Frida, and allows you to execute scripts and do stuff easier.

The name is a bit of a pun, with [Diego](https://en.wikipedia.org/wiki/Diego_Rivera), who was married to Frida Kahlo, but also it stands for *D*ata *I*nspection *E*nvironment for *G*uided *O*bservation.

## installation

You need frida-server/gadget running somewhere. Once running, diego can push it's own service to the frida-server.

Diego is a bunjs-program, so if you already, you can do this:

```js
bun i -g @konsumer/diego

diego run examples/basicinfo.js
```

If you prefer to not install bun on your system, you can also use a [compiled release](https://github.com/konsumer/diego/releases/).

## usage

I want diego to be self-contained, and not require python frida-tools, in order to be useful, so I am working on adding all of it's commands:

```
frida (run)
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
diego --help
diego ls-devices --help
```

### host functions

These are used in `run`. You can setup a host as well as device-script, and respond to `send` and call `rpc` stuff, and whatever you want. Here are the goblas you have access to:

```js
script; // the current script (use script.exports for rpc, for example)
device; // the current frida device object
session; // the current frdia session (process with script attached)
filename; // the current frida-script filename
```

Here is an example:

```sh
./cli.ts run -h examples/hosttest.js examples/basicinfo.js
```
