'use strict'

const SwitchPollTime = 3



const Telnet = require('telnet-client')


var SwitchData: object = {};
var OldValue: object = {}
var CurrentBandwidth: object = {};
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData

let params = {
    host: '192.168.1.201',
    port: 23,
    shellPrompt: /\D+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: "cisco",
    password: "cisco",
    pageSeparator: /More: <space>,  Qu.*/,
    timeout: 0
}

var express = require("express");
var app = express();
app.use('/', express.static(__dirname + '/html'));
app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/bw", (req, res, next) => {
    function waitNewData() { if(NewData == true) res.json(CurrentBandwidth); else setTimeout(waitNewData, 200) }
    waitNewData()
   });

let connection = new Telnet()

enum ParseState {
        In = "In",
        Out = "Out",
    }

function connect() {
connection.on('ready', function (prompt) {
    StartSwitchDatamine();
})

connection.on('timeout', function () {
    console.log('socket timeout!')
    setTimeout(connect, 2000);
})

connection.on('error', function () {
    setTimeout(connect, 2000);
})

connection.on('close', function () {
    console.log('connection closed')
    setTimeout(connect, 2000);
})

connection.connect(params)

}

function get_count() {
    
    let State: ParseState = ParseState.In

    
        connection.exec("show int coun", function (err, response) {
            let now = new Date
            //console.log(response)
            let array
            try {
                array = response.split("\n")
            } catch (error) {
                console.log("Response error : can not split in array")
                console.log(response)
                setTimeout(function() {get_count()}, SwitchPollTime*1000);
                return
            }
            CountTime = now.getTime() - ClearTime
            ClearTime = now.getTime()
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
                                setTimeout(getNextFct("get_count"), SwitchPollTime*1000);
                                computeBandWidth()
                                return;
                            }
                            State = ParseState.Out
                        }
                        if (Bit[0] == CurrentPortNumber) {
                            if (Bit[0]) {
                                if(SwitchData["gi" + CurrentPortNumber] == undefined) {
                                    SwitchData["gi" + CurrentPortNumber] = {}
                                    OldValue["gi" + CurrentPortNumber] = {}
                                }
                                if(SwitchData["gi" + CurrentPortNumber][State] == undefined) {
                                    SwitchData["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1]
                                    OldValue["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1]
                                }
                                else {
                                    SwitchData["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1] - OldValue["gi" + CurrentPortNumber][State]
                                    OldValue["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1]
                                }
                            }
                            CurrentPortNumber++
                        }

                        Bit = T
                    }
                }


            }
            })
        
    }

function clear_count() {
    
        NewData = false
        connection.exec("clear counters", (err, respond) => {
            console.log("c : " + respond)
            if(respond != undefined) 
            {
                let now = new Date
                ClearTime = now.getTime()
                setTimeout(getNextFct("clear_count"), SwitchPollTime*1000);
            }
            else
                setTimeout(function() {clear_count()}, SwitchPollTime*1000);
        })
}

function computeBandWidth() {
    //console.log(CountTime)
    Object.keys(SwitchData).forEach(function(key) {
        var val = SwitchData[key];
        //console.log("Port " + key + " - In : " + Math.round(val.In*8/10/1024/1024*100)/100 + "Mb/s - Out : " +  Math.round(val.Out*8/10/1024/1024*100)/100 + "Mb/s")
        let speed = "n.c."
        if(val.Speed)
            speed = val.Speed
        if(!CurrentBandwidth[key])
           CurrentBandwidth[key] = {}
        CurrentBandwidth[key] = { Speed: speed, In : Math.round(val.In*8/CountTime/1024/1024*10*1000)/10, Out : Math.round(val.Out*8/CountTime/1024/1024*10*1000)/10}
    
    });
    NewData = true
}

function getPortStatus() {        
            connection.exec("show int status", function (err, response) {
                let array = response.split("\n");
                for(let line of array) {
                    let port = line.split(/\s+/)
                    if(port[0].startsWith("gi")) {
                        SwitchData[port[0]].Speed = parseInt(port[3])
                    }
                }
                console.log(JSON.stringify(SwitchData))
                setTimeout(getNextFct("getPortStatus"), SwitchPollTime*1000);
            
            })
}

function getNextFct(current)
{
    switch(current) {
        case "clear_count" :
            return get_count
        case "get_count" :
            return getPortStatus
        case "getPortStatus" :
            return get_count
    }
}

function StartSwitchDatamine() {
    connection.exec("terminal datad", (err, respond) => {})
    setTimeout(clear_count, 1000);
}

console.log("start")

connect()