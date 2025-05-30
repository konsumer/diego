const getHost = () => (!Java.available && !ObjC.available ? null : ObjC.available ? ObjC.classes.NSHost.currentHost().name().toString() : Java.use('java.net.InetAddress').getLocalHost().getHostName())
const getOsVersion = () => (!Java.available && !ObjC.available ? null : ObjC.available ? ObjC.classes.UIDevice.currentDevice().systemVersion().toString() : Java.androidVersion)

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
