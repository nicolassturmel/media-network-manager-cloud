'use strict'

const SwitchPollTime = 2



const Telnet = require('telnet-client')


var LastValue: object = {};
var CurrentBandwidth: object = {};
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;

var express = require("express");
var app = express();
app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/bw", (req, res, next) => {
    res.json(CurrentBandwidth);
   });

function get_count() {
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
        connection.exec("show int coun", function (err, response) {
            let now = new Date
            // let array = response.split(/\D+/)
            //console.log(response)
            let array
            try {
                array = response.split("\n")
            } catch (error) {
                console.log("Response error")
                connection.end();
                return
            }
            CountTime = now.getTime() - ClearTime
            
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

                                //console.log(JSON.stringify(LastValue))
                                connection.end()
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
        
    })

    connection.on('timeout', function () {
        console.log('socket timeout!')
        connection.end()
    })

    connection.on('close', function () {
        console.log('connection closed')
    })

    connection.connect(params)

    setTimeout(function() {clear_count()}, SwitchPollTime*1000);
}

function clear_count() {
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
        timeout: 500
    }

    connection.on('ready', function (prompt) {
        connection.exec("clear counters", (err, respond) => {
            console.log("c : " + respond)
            if(respond != undefined) {
                let now = new Date
                ClearTime = now.getTime()
                setTimeout(function() {get_count()}, SwitchPollTime*1000);
            }
            else
                setTimeout(function() {clear_count()}, SwitchPollTime*1000);
            connection.end()
        })
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

function display() {
    Object.keys(LastValue).forEach(function(key) {
        var val = LastValue[key];
        //console.log("Port " + key + " - In : " + Math.round(val.In*8/10/1024/1024*100)/100 + "Mb/s - Out : " +  Math.round(val.Out*8/10/1024/1024*100)/100 + "Mb/s")
        if(!CurrentBandwidth[key])
           CurrentBandwidth[key] = {}
        CurrentBandwidth[key] = { In : Math.round(val.In*8/CountTime/1024/1024*100*1000)/100, Out : Math.round(val.Out*8/CountTime/1024/1024*100*1000)/100}
    
    });


    setTimeout(() => {display() },1000)
}

console.log("start")

clear_count()
display()
