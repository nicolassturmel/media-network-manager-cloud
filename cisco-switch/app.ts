'use strict'
 
const Telnet = require('telnet-client')
 
async function run() {
  let connection = new Telnet()
 
  let params = {
    host: '192.168.1.201',
    port: 23,
    shellPrompt: /\D+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: "cisco",
    password: "cisco",
    pageSeparator: "More: <space>,  Quit: q or CTRL+Z, One line: <return> ",
    timeout: 1000
  }
 
  
  connection.on('ready', function(prompt) {
    connection.exec("show int coun", function(err, response) {
       // let array = response.split(/\D+/)
       let array = response.split("\n")
       let Bit = []

       for(let str of array) {
          let T = str.split(/\D+/).slice(1,-1)
          if(T.length == 0) {}
          else {
              if(T.length == 1) {
                  Bit[Bit.length-1] += T[0] + "";
                console.log(T[0])
              }
              else {
                  console.log(Bit)
                  Bit = T
              }
          }


       }
       //console.log("rep -> " + JSON.stringify(Bit)
    })
  })
   
  connection.on('timeout', function() {
    console.log('socket timeout!')
    connection.end()
  })
   
  connection.on('close', function() {
    console.log('connection closed')
  })
   
  connection.connect(params)
}
 
run()