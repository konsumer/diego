import portfinder from "portfinder";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import frida from "frida";
import { basename, dirname } from "node:path";
import esbuild from "esbuild";
import Table from "cli-tableau";

const AsyncFunction = async function () {}.constructor;
const decoder = new TextDecoder();

const yellow = Bun.color("yellow", "ansi");
const white = Bun.color("white", "ansi");

// trigger synhi on inline snippets
const js = s => s.join('\n')

const table = (a, options = {}) => {
  const t = new Table(options);
  for (const row of a) {
    t.push(row);
  }
  return t.toString();
};

const sortBy = (f, reverse) => (a, b) =>
  reverse
    ? a[f] < b[f]
      ? 1
      : a[f] > b[f]
        ? -1
        : 0
    : a[f] > b[f]
      ? 1
      : a[f] < b[f]
        ? -1
        : 0;

function processTable(p, json) {
  p.sort(sortBy("pid"));
  if (json) {
    return console.log(
      JSON.stringify(
        p.map((d) => ({
          pid: d.pid,
          identifier: d.identifier,
          name: d.name,
          parameters: d.parameter,
        })),
        null,
        2,
      ),
    );
  }
  console.log(
    table(
      p.map((a) => [
        a.pid || "-",
        a.name || "-",
        a.identifier || "-",
        JSON.stringify(a.parameters),
      ]),
      { head: ["Pid", "Name", "Identifier", "Parameters"] },
    ),
  );
}

const getPort = promisify(portfinder.getPort);

export async function commmandUi(options, command) {
  if (!options?.port || options?.port === "random") {
    options.port = await getPort();
  }
  const device = await getDevice(options);
  console.log("Ui", options);
}

export async function commandRun(script, options, command) {
  try {
    if (!options.codeshare && !script) {
      throw new Error("Set a script to run.");
    }
    if (options.codeshare && script) {
      throw new Error("Choose 1: script or codeshare.");
    }

    options.device = await getDevice(options);
    options.session = await getSession(options);

    if (options.codeshare) {
      options.source = (
        await fetch(
          `https://codeshare.frida.re/api/project/${options.codeshare}`,
        ).then((r) => r.json())
      ).source;
      options.filename = `${options.codeshare.replace(/\//g, "-")}.js`;
    } else if (script.endsWith(".js")) {
      options.source = await readFile(script, "utf8");
      options.filename = script;
    }

    if (options.hostScript) {
      options.hostScript = await readFile(options.hostScript, "utf8");
    }

    await run(options);
    if (options.exit) {
      process.exit()
    }
  } catch (e) {
    console.error(`${e.message}\n`);
    command.help({ error: true });
  }
}

export async function commandLsDevices(options, command) {
  const devices = await frida.enumerateDevices();

  if (options.json) {
    return console.log(
      JSON.stringify(
        devices.map((d) => ({ id: d.id, name: d.name, type: d.type })),
        null,
        2,
      ),
    );
  }

  console.log(
    table(
      devices.map((d) => [d.type, d.name, d.id]),
      { head: ["Type", "Name", "ID"] },
    ),
  );
}

export async function commandLs(paths, options, command) {
  options.attachPid = 0;
  options.device = await getDevice(options);
  const session = await getSession(options);

  if (!paths?.length) {
    paths = ["/"];
  }

  const source = js`
import fs from "fs";

const paths = ${JSON.stringify(paths)}
const out = []
for (const path of paths) {
  out.push(fs.readdirSync(path))
}
send(out)
`;

  const hostScript = js`
script.message.connect(({payload})=>{
    console.log(payload.map(l => l.join('\\n')).join('\\n\\n'))
    process.exit()
})
`;

  await run({
    filename: "ls.js",
    session,
    source,
    hostScript,
  });
}


export async function commandInfo(options, command) {
  // ps:0 cannot get hostname (need to look into this) so I just use foreground app here
  options.device = await getDevice(options);
  const session = await getSession(options);
  
  const source = js`
function getHost() {
  if (!Java.available && !ObjC.available) {
    return null
  }
  if (ObjC.available) {
    return ObjC.classes.NSHost.currentHost().name().toString()
  } else {
    return Java.use("java.net.InetAddress").getLocalHost().getHostName()
  }
}

function getOsVersion() {
  if (!Java.available && !ObjC.available) {
    return null
  }
  if (ObjC.available) {
    return ObjC.classes.UIDevice.currentDevice().systemVersion().toString()
  } else {
    return Java.androidVersion
  }
}

send({
  hostname: getHost(),
  os: getOsVersion(),
  frida: Frida.version,
  id: Process.id,
  arch: Process.arch,
  platform: Process.platform,
  temp: Process.getTmpDir(),
  home: Process.getHomeDir(),
  runtime: Script.runtime,
  pointerSize: Process.pointerSize
})
`;

  const hostScript = js`
const json = ${JSON.stringify(!!options.json)}
script.message.connect(m => {
    if (!m?.payload) {
      console.error(m)
      process.exit(1)
    }
    if (json) {
      console.log(JSON.stringify(m.payload, null, 2))
    }else{
      console.table(m.payload)
    }
    process.exit()
})
`;

  await run({
    filename: "info.js",
    session,
    source,
    hostScript,
  });
}

export async function commandPs(options, command) {
  const device = await getDevice(options);
  const { applications, installed, json, excludeIcons } = options;

  if (!applications && installed) {
    console.error(`-i cannot be used without -a\n`);
    return command.help({ error: true });
  }

  let apps = await device.enumerateApplications();

  if (applications) {
    if (!installed) {
      apps = apps.filter((a) => a.pid);
    }
    processTable(apps, options.json);
    return;
  }

  if (!applications && !installed) {
    const p = (await device.enumerateProcesses()).map((a) => ({
      pid: a.pid,
      name: a.name,
      parameters: a.parameters,
      identifier: apps.find((aa) => aa.pid === a.pid)?.identifier,
    }));
    processTable(p, options.json);
    return;
  }
}

export async function commandKill(pids, options, command) {
  const device = await getDevice(options);
  for (let p of pids) {
    if (!isNaN(p)) {
      const processes = await device.enumerateProcesses();
      p = processes.find((ps) => ps.pid === parseInt(p))?.name;
    }
    try {
      await device.kill(p);
    } catch (e) {
      console.error(`${p}: ${e.message}`);
    }
  }
}

// Run a script on device
export async function run(options) {
  if (!options.source) {
    throw new Error("Script not loaded.");
  }
  if (!options.filename) {
    throw new Error("Filename unknown.");
  }
  if (!options.session) {
    throw new Error("No app-session");
  }

  const header = js`
import ObjC from "frida-objc-bridge";
import Java from "frida-java-bridge";
// import Swift from "frida-swift-bridge";
`;

  const source = await compileCode(options.filename, header + options.source);
  let hostfunction = () => {};
  if (options.hostScript) {
    hostfunction = new AsyncFunction(
      "_o",
      await compileCode(
        "host.js",
        `const { script, device, session, filename } = _o
        ${options.hostScript}`,
      ),
    );
  }

  options.script = await options.session.createScript(source);
  const p = hostfunction(options);
  await options.script.load();
  await p;
}

// util to find a process to attach to it, based on options
export async function getSession(options = {}) {
  let {
    device,
    attachFrontmost,
    attachName,
    attachIdentifier,
    attachPid,
  } = options;
  if (!device) {
    throw new Error("No device found.");
  }

  if (typeof attachPid !== "undefined") {
    return device.attach(attachPid);
  }

  if (!attachFrontmost && !attachName && !attachIdentifier) {
    attachFrontmost = true;
  }

  if (attachFrontmost) {
    const app = await device.getFrontmostApplication();
    if (!app) {
      throw new Error("Frontmost app not found");
    }
    return await device.attach(app.name);
  }

  // TODO: handle attaching/spawning attachName/attachIdentifier
}

// util to get a device based on options
export async function getDevice(options = {}) {
  let { device, usb } = options;
  if (!device && !usb) {
    // Not implemented
    // return await frida.getLocalDevice();
    usb = true;
  }
  if (usb) {
    return await frida.getUsbDevice();
  }
  if (device) {
    const devices = await frida.enumerateDevices();
    return devices.find((d) => d.id === device);
  }
}

// util to compile a code-string
async function compileCode(filename, code, options = {}) {
  // Bun has it's own bundler, but it was outputting invalid code and requires file input
  return (
    await esbuild.build({
      write: false,
      bundle: true,
      format: "esm",
      // sourcemap: "inline",
      stdin: {
        contents: code,
        sourcefile: filename,
        resolveDir: "./",
      },
      alias: {
        assert: "@frida/assert",
        "base64-js": "@frida/base64-js",
        buffer: "@frida/buffer",
        crypto: "@frida/crypto",
        diagnostics_channel: "@frida/diagnostics_channel",
        events: "@frida/events",
        fs: "frida-fs",
        http: "@frida/http",
        https: "@frida/https",
        "http-parser-js": "@frida/http-parser-js",
        ieee754: "@frida/ieee754",
        net: "@frida/net",
        os: "@frida/os",
        path: "@frida/path",
        process: "@frida/process",
        punycode: "@frida/punycode",
        querystring: "@frida/querystring",
        "readable-stream": "@frida/readable-stream",
        stream: "@frida/stream",
        string_decoder: "@frida/string_decoder",
        timers: "@frida/timers",
        tty: "@frida/tty",
        url: "@frida/url",
        util: "@frida/util",
        vm: "@frida/vm",
      },
    })
  )?.outputFiles?.pop()?.text;
}
