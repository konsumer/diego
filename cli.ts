#!/usr/bin/env bun

import { program } from 'commander'
import * as diego from './index.ts'

program
  .name('diego')
  .description("Frida's husband: CLI tools for running frida in various ways")

program.command('ui')
  .summary('Start a web-based UI')
  .option('-H, --host', 'Connect to remote frida-server on HOST')
  .option('-D, --device <device>', 'Connect to device with the given ID')
  .option('-U, --usb', 'Connect to first USB device')
  .option('-p, --port <port>', 'Specify a port to run UI on', 'random')
  .action(diego.ui)

program.command('ls-devices')
  .summary('List available devices')
  .action(diego.lsDevices)

program.command('ls')
  .summary('List files')
  .argument('<file...>', 'File to list')
  .option('-H, --host', 'Connect to remote frida-server on HOST')
  .option('-D, --device <device>', 'Connect to device with the given ID')
  .option('-U, --usb', 'Connect to first USB device')
  .action(diego.commandLs)

program.command('ps')
  .summary('List processes')
  .option('-H, --host', 'Connect to remote frida-server on HOST')
  .option('-D, --device <device>', 'Connect to device with the given ID')
  .option('-U, --usb', 'Connect to first USB device')
  .option('-a, --applications', 'List only applications')
  .option('-i, --installed', 'Include all installed applications')
  .option('-j, --json', 'Output results as JSON')
  .option('-e, --exclude-icons', 'Exclude icons in output')
  .action(diego.commandPs)

program.command('run')
  .summary('Run a script')
  .argument('[script]', 'Script to run')
  .argument('[arg...]', 'Arguments for your script')
  .option('-H, --host', 'Connect to remote frida-server on HOST')
  .option('-D, --device <device>', 'Connect to device with the given ID')
  .option('-U, --usb', 'Connect to first USB device')
  .option('-c, --codeshare <@author/name>', 'Load codeshare @author/name')
  .action(diego.commandRun)

program.command('kill')
  .summary('Kill a process')
  .argument('<process...>', 'Kill a process')
  .option('-H, --host', 'Connect to remote frida-server on HOST')
  .option('-D, --device <device>', 'Connect to device with the given ID')
  .option('-U, --usb', 'Connect to first USB device')
  .action(diego.commandKKill)

// TODO:
// program.command('apk')
// program.command('ls')
// program.command('compile')
// program.command('create')
// program.command('discover')
// program.command('itrace')
// program.command('join')
// program.command('pull')
// program.command('push')
// program.command('rm')
// program.command('trace')


program.parse()

