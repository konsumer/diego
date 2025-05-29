console.log("hello from host");

console.log({
  filename,
  session,
  device,
  script,
});

// here you could use script.exports for rpc
// or script.message.connect(cb)
// or whatver you like
