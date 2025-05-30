console.log('hello from host')

console.log({
  filename,
  session,
  device,
  script
})

// frida sends errors over this, so you should probly wire something up.
script.message.connect((message) => console.log(message))
