'use strict'

const Telnet = require('telnet-client')


var LastValue: object = {};
var CurrentBandwidth;

function run() {
    let connection = new Telnet()

    let params = {
        host: '192.168.1.201',
        port: 23,
        shellPrompt: /\D+#/,
        loginPrompt: "User Name:",
        passwordPrompt: "Password:",
        username: "cisco",
        password: "cisco",
        pageSeparator: /More: <space>,  Qu.*/,
        timeout: 1000
    }


    enum ParseState {
        In = "In",
        Out = "Out",
    }
    let State: ParseState = ParseState.In

    connection.on('ready', function (prompt) {
        //connection.exec("clear counters", (err, respond) => {console.log(respond)})
        
        connection.exec("show int coun", function (err, response) {
            // let array = response.split(/\D+/)
             console.log(response)
            let array = response.split("\n")
            let Bit: any = [0]
            let CurrentPortNumber = 0;

            for (let str of array) {
                 str = str.replace("0m","")
                let T = str.split(/\D+/).slice(1, -1)
                if (T.length == 0) { }
                else {
                    if (T.length == 1) {
                        Bit[Bit.length - 1] += T[0] + "";
                    }
                    else {
                        for (let j in Bit)
                            Bit[j] = parseInt(Bit[j])
                        //console.log(Bit)
                        if (Bit[0] < CurrentPortNumber) {
                            CurrentPortNumber = 1
                            if (State == ParseState.Out) {

                                console.log(JSON.stringify(LastValue))
                                return;
                            }
                            State = ParseState.Out
                        }
                        if (Bit[0] == CurrentPortNumber) {
                            if (Bit[0]) {
                                if(LastValue["g" + CurrentPortNumber] == undefined)
                                    LastValue["g" + CurrentPortNumber] = {}
                                LastValue["g" + CurrentPortNumber][State] = Bit[Bit.length - 1]
                            }
                            CurrentPortNumber++
                        }

                        Bit = T
                    }
                }


            }
        })
        connection.exec("clear counters", (err, respond) => {console.log(respond)})
    })

    connection.on('timeout', function () {
        console.log('socket timeout!')
        connection.end()
    })

    connection.on('close', function () {
        console.log('connection closed')
    })

    connection.connect(params)
}

run()