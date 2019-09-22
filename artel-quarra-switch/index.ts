const request = require('request')

request.post('http://admin:@192.168.1.143/json_rpc', {
  json: {
    "method":"port.status.get", "params":[],"id":"0"
  }
}, (error, res, body) => {
  if (error) {
    console.error(error)
    return
  }
  console.log(`statusCode: ${res.statusCode}`)
  console.log(body.result[0].val)
})