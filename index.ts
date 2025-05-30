import portfinder from 'portfinder'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import frida from 'frida'
import { basename, dirname } from 'node:path'
import esbuild from 'esbuild'
import Table from 'cli-tableau'

export async function commandRun(script, options, command) {
  try {
    if (!options.codeshare && !script) {
      throw new Error('Set a script to run.')
    }
    if (options.codeshare && script) {
      throw new Error('Choose 1: script or codeshare.')
    }

    options.device = await getDevice(options)
    options.session = await getSession(options)

    if (options.codeshare) {
      options.source = (await fetch(`https://codeshare.frida.re/api/project/${options.codeshare}`).then((r) => r.json())).source
      options.filename = `${options.codeshare.replace(/\//g, '-')}.js`
    } else if (script.endsWith('.js')) {
      options.source = await readFile(script, 'utf8')
      options.filename = script
    }

    if (options.hostScript) {
      options.hostScript = await readFile(options.hostScript, 'utf8')
    }

    await run(options)
    if (options.exit) {
      process.exit()
    }
  } catch (e) {
    console.error(`${e.message}\n`)
    command.help({ error: true })
  }
}

export async function commandDevices(options, command) {
  const devices = []
  for (const device of await frida.enumerateDevices()) {
    let s = { os: {}, remote: {} }
    try {
      if (['usb', 'local'].includes(device.type)) {
        s = await device.querySystemParameters()
        s.remote = await remoteInfo(device)
      }
    } catch (e) {}
    devices.push({
      id: device.id,
      name: s.name || device.name,
      type: device.type,
      os: s.os.name && `${s.os.name} ${s.os.version}`,
      osid: s.os.id,
      arch: s.arch,
      platform: s.platform,
      access: s.access,
      frida: s?.remote?.frida
    })
  }
  const info = simplifyArrayOfObjects(devices, ['id', 'name', 'type', 'os', 'osid', 'arch', 'platform', 'access', 'frida'])

  if (options.json) {
    console.log(JSON.stringify(info.keyed, null, 2))
    return
  }
  showArrayTable(info)
  process.exit()
}

export async function commandLs(paths, options, command) {
  options.attachPid = 0
  options.device = await getDevice(options)
  const session = await getSession(options)

  if (!paths?.length) {
    paths = ['/']
  }

  const source = `import { readdirSync, lstatSync } from 'fs'
  const out = {}
  for (const path of ${JSON.stringify(paths)}) {
    out[path] = []
    for (const file of readdirSync(path)) {
      let name = file
      // this is broke (wanted to put / at end of dir name)
      // const l = lstatSync(file)
      out[path].push(name)
    }
  }

  if (${options.json ? 'true' : 'false'}) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    for (const [dir, list] of Object.entries(out)) {
      console.log(dir)
      for (const file of list) {
        console.log(' ', file)
      }
      console.log('')
    }
  }
  `

  await run({ source, filename: 'ls.js', session })
  process.exit()
}

export async function commandPs(options, command) {
  const device = await getDevice(options)
  const { applications, installed, json, excludeIcons } = options

  if (!applications && installed) {
    console.error(`-i cannot be used without -a\n`)
    return command.help({ error: true })
  }

  let apps = (await device.enumerateApplications()).map((a) => ({
    pid: a.pid,
    name: a.name,
    parameters: a.parameters,
    identifier: a.identifier
  }))
  if (applications && !installed) {
    apps = apps.filter((a) => a.pid)
  }

  if (!applications && !installed) {
    const mapps = (await device.enumerateProcesses()).map((a) => ({
      pid: a.pid,
      name: a.name,
      parameters: a.parameters,
      identifier: apps.find((aa) => aa.pid === a.pid)?.identifier
    }))
    apps = mapps
  }

  apps.sort(sortBy('pid'))

  const info = simplifyArrayOfObjects(apps, ['pid', 'name', 'parameters', 'identifier'])

  if (options.json) {
    console.log(JSON.stringify(info.keyed, null, 2))
    return
  }
  showArrayTable(info)
}

export async function commandKill(pids, options, command) {
  const device = await getDevice(options)
  for (let p of pids) {
    if (!isNaN(p)) {
      const processes = await device.enumerateProcesses()
      p = processes.find((ps) => ps.pid === parseInt(p))?.name
    }
    try {
      await device.kill(p)
    } catch (e) {
      console.error(`${p}: ${e.message}`)
    }
  }
}

// Run a script on device
export async function run(options) {
  if (!options.source) {
    throw new Error('Script not loaded.')
  }
  if (!options.filename) {
    throw new Error('Filename unknown.')
  }
  if (!options.session) {
    throw new Error('No app-session')
  }

  const header = js`
import ObjC from "frida-objc-bridge";
import Java from "frida-java-bridge";
// import Swift from "frida-swift-bridge";
`

  const source = await compileCode(options.filename, header + options.source)

  // default function
  let hostfunction = (script, device, session, filename) => {
    script.message.connect((message) => {
      if (message.type === 'error') {
        const s = message.stack.replace(/^Error: /, '')
        console.error(`${Bun.color('red', 'ansi')}ERROR${Bun.color('white', 'ansi')} ${s}`)
      } else {
        console.log(`${Bun.color('yellow', 'ansi')}${message.type}${Bun.color('white', 'ansi')}`, message.payload)
      }
    })
  }

  if (options.hostScript) {
    hostfunction = new AsyncFunction('script, device, session, filename', await compileCode('host.js', options.hostScript))
  }

  options.script = await options.session.createScript(source)
  const p = hostfunction(options.script, options.device, options.session, options.filename)
  await options.script.load()
  await p
}

// util to find a process to attach to it, based on options
export async function getSession(options = {}) {
  let { device, attachFrontmost, attachName, attachIdentifier, attachPid } = options
  if (!device) {
    throw new Error('No device found.')
  }

  if (typeof attachPid !== 'undefined') {
    return device.attach(attachPid)
  }

  if (!attachFrontmost && !attachName && !attachIdentifier) {
    attachFrontmost = true
  }

  if (attachFrontmost) {
    const app = await device.getFrontmostApplication()
    if (!app) {
      throw new Error('Frontmost app not found')
    }
    return await device.attach(app.name)
  }

  // TODO: handle attaching/spawning attachName/attachIdentifier
}

// util to get a device based on options
export async function getDevice(options = {}) {
  let { device, usb } = options
  if (!device && !usb) {
    // Not implemented
    // return await frida.getLocalDevice();
    usb = true
  }
  if (usb) {
    return await frida.getUsbDevice()
  }
  if (device) {
    const devices = await frida.enumerateDevices()
    return devices.find((d) => d.id === device)
  }
}

// grab info you can get from any process
async function remoteInfo(device) {
  const session = await getSession({ device, attachPid: 0 })
  const script = await session.createScript(`
send({
  frida: Frida.version,
  id: Process.id,
  arch: Process.arch,
  platform: Process.platform,
  runtime: Script.runtime,
  pointerSize: Process.pointerSize
})
  `)
  const p = new Promise((resolve, reject) => {
    script.message.connect((m) => {
      if (!m?.payload) {
        reject(m)
      } else {
        resolve(m.payload)
      }
    })
  })
  await script.load()
  return p
}

const AsyncFunction = async function () {}.constructor
const decoder = new TextDecoder()

// trigger synhi on inline snippets
const js = (s) => s.join('\n')

const table = (a, options = {}) => {
  const t = new Table(options)
  for (const row of a) {
    t.push(row)
  }
  return t.toString()
}

const sortBy = (f, reverse) => (a, b) => (reverse ? (a[f] < b[f] ? 1 : a[f] > b[f] ? -1 : 0) : a[f] > b[f] ? 1 : a[f] < b[f] ? -1 : 0)

const getPort = promisify(portfinder.getPort)

const titleCase = (s) => s[0].toUpperCase() + s.substring(1).toLowerCase()

// frida object-arrays are not plain, so I need to loop over headers instead
function simplifyArrayOfObjects(array, headers) {
  headers ||= Object.keys(array[0] || {})
  const data = (array || []).map((v) => headers.map((k) => v[k]))
  const keyed = data.map((v) => headers.reduce((a, k, i) => ({ ...a, [k]: v[i] }), {}))
  headers = headers.map(titleCase)
  return { headers, data, keyed }
}

function showArrayTable({ data, headers }) {
  const dataOut = data.map((d) => {
    return d.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
  })
  console.log(table(dataOut, { head: headers.map(titleCase) }))
}

// util to compile a code-string
export async function compileCode(filename, code, options = {}) {
  // Bun has it's own bundler, but it was outputting invalid code and requires file input
  return (
    await esbuild.build({
      write: false,
      bundle: true,
      format: 'esm',
      // sourcemap: "inline",
      stdin: {
        contents: code,
        sourcefile: filename,
        resolveDir: process.cwd()
      },
      alias: {
        assert: '@frida/assert',
        'base64-js': '@frida/base64-js',
        buffer: '@frida/buffer',
        crypto: '@frida/crypto',
        diagnostics_channel: '@frida/diagnostics_channel',
        events: '@frida/events',
        fs: 'frida-fs',
        http: '@frida/http',
        https: '@frida/https',
        'http-parser-js': '@frida/http-parser-js',
        ieee754: '@frida/ieee754',
        net: '@frida/net',
        os: '@frida/os',
        path: '@frida/path',
        process: '@frida/process',
        punycode: '@frida/punycode',
        querystring: '@frida/querystring',
        'readable-stream': '@frida/readable-stream',
        stream: '@frida/stream',
        string_decoder: '@frida/string_decoder',
        timers: '@frida/timers',
        tty: '@frida/tty',
        url: '@frida/url',
        util: '@frida/util',
        vm: '@frida/vm'
      }
    })
  )?.outputFiles?.pop()?.text
}
