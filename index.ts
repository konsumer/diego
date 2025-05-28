import portfinder from 'portfinder'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'

const getPort = promisify(portfinder.getPort)

const decoder = new TextDecoder()


// wraps frida script with remote api
export function wrapFrida(source) {
  return `
export default async function host(process, args) {
  import ObjC from 'frida-objc-bridge'
  import Java from 'frida-java-bridge'
  ${source}
}
`
}

export async function commmandUi(options, command) {
  if (!options?.port || options?.port === 'random') {
    options.port = await getPort()
  }
  const device = await getDevice(options)
  console.log('Ui', options)
}

export async function commandRun(script, args, options, command) {
  if (!options.codeshare && !script) {
    console.error('Set a script to run.\n')
    command.help({error: true})
  }

  if (options.codeshare && script) {
    console.error('Choose 1: script or codeshare.\n')
    command.help({error: true})
  }

  options.device = await getDevice(options)

  // currently we only support codeshare and js
  // but eventually this can support other runtimes
  if (options.codeshare) {
    options.source = (await fetch(`https://codeshare.frida.re/api/project/${options.codeshare}`).then(r => r.json())).source
    options.filename = `${options.codeshare}.js`
    options.type = 'remote'
    options.source = wrapFrida(options.source)
  } else if (script.endsWith('.js')) {
    options.source = await readFile(script, 'utf8')
    options.filename = script
    options.type = 'local'
    // TODO: check if I need to wrapFrida
  }

  await run(options)
}

export async function commandLsDevices(options, command) {
  console.log('LsDevices', options)
}

export async function commandLs(files, options, command) {
  const device = await getDevice(options)
  console.log('Ls', files, options)
}

export async function commandPs(options, command) {
  const device = await getDevice(options)
  console.log('Ps', options)
}

export async function commandKill(pids, options, command) {
  const device = await getDevice(options)
  console.log('Kill', pids, options)
}


// Run a script on device
export async function run(options){
  console.log('Run', options)
}



// util to get a device based on host/usb/deviceID
export async function getDevice(options) {}