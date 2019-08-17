var client = require('./index')

client.challenge("thisisme")
client.whoami("mnms client ws test prgm")
client.setCallback((data) => {console.log(data)})
client.run()
client.send("I am sending data")