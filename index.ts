import portfinder from 'portfinder'
import { promisify } from 'node:util'

const getPort = promisify(portfinder.getPort)

export async function ui(options, command) {
  if (!options?.port || options?.port === 'random') {
    options.port = await getPort()
  }
  const device = await getDevice(options)
  console.log('Ui', options)
}

export async function run(script, options, command) {
  if (!options.codeshare && !script) {
    console.error('Set a script to run.\n')
    command.help({error: true})
  }
  const device = await getDevice(options)
  console.log('Run', script, options)
}

export async function lsDevices(options, command) {
  console.log('LsDevices', options)
}

export async function ls(files, options, command) {
  const device = await getDevice(options)
  console.log('Ls', files, options)
}

export async function ps(options, command) {
  const device = await getDevice(options)
  console.log('Ps', options)
}

export async function kill(pids, options, command) {
  const device = await getDevice(options)
  console.log('Kill', pids, options)
}

// util to get a device based on host/usb/deviceID
export async function getDevice(options) {}