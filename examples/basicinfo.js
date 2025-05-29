let version;
let hostname;

if (ObjC.available) {
  version = ObjC.classes.UIDevice.currentDevice().systemVersion().toString();
  hostname = ObjC.classes.NSHost.currentHost().name().toString();
}

if (Java.available) {
  hostname = Java.use("java.net.InetAddress").getLocalHost().getHostName();
  version = Java.androidVersion;
}

console.log(
  JSON.stringify(
    {
      hostname,
      version,
      frida: Frida.version,
      id: Process.id,
      arch: Process.arch,
      platform: Process.platform,
      // temp: Process.getTmpDir(),
      // home: Process.getHomeDir(),
      // runtime: Script.runtime,
      // pointerSize: Process.pointerSize,
    },
    null,
    2,
  ),
);
