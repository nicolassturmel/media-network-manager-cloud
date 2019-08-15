

const SwitchPollTime = 1



const Telnet = require('telnet-client')
const commandLineArgs = require('command-line-args')
var uniqid = require('uniqid');


// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.201' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'cisco' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'cisco' }
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge("thisisme")
client.whoami("mnms client ws test prgm")
client.setCallback((data) => {console.log(data)})
client.run()

// Connecting to switch

var SwitchData: object = {};
var OldValue: object = {}
var Switch = { 
    Type: "switch", 
    IP: options.ip,
    Schema: 1, 
    Ports: [], 
    Multicast: "off", 
    Neighbour: "",
    Mac: "", 
    id: uniqid()
};    
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData

let params = {
    host: options.ip,
    port: 23,
    shellPrompt: /\D+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: options.user,
    password: options.password,
    pageSeparator: /More: <space>,  Qu.*/,
    timeout: 0
}

var express = require("express");
var app = express();
app.use('/', express.static(__dirname + '/html'));
/* try {
    app.listen(3000, () => {
 console.log("Server running on port 3000");
});
} catch (error) {
    
}*/


app.get("/bw", (req, res, next) => {
    function waitNewData() { if(NewData == true) res.json(Switch) ; else setTimeout(waitNewData, 200) }
    waitNewData()
   });

let switchTelnet = new Telnet()

enum ParseState {
        In = "In",
        Out = "Out",
    }

switchTelnet.on('ready', function (prompt) {
    StartSwitchDatamine();
})

switchTelnet.on('timeout', function () {
    console.log('socket timeout!')
})

switchTelnet.on('error', function () {
    setTimeout(startTelenetToSwitch, 2000);
})

switchTelnet.on('close', function () {
    console.log('connection closed')
    setTimeout(startTelenetToSwitch, 20000);
})

function startTelenetToSwitch() {

    switchTelnet.connect(params)

}

function get_count() {
    
    let State: ParseState = ParseState.In

    
        switchTelnet.exec("show int coun", function (err, response) {
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
        switchTelnet.exec("clear counters", (err, respond) => {
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
    Switch.Ports = []
    Object.keys(SwitchData).forEach(function(key) {
        var val = SwitchData[key];
        //console.log("Port " + key + " - In : " + Math.round(val.In*8/10/1024/1024*100)/100 + "Mb/s - Out : " +  Math.round(val.Out*8/10/1024/1024*100)/100 + "Mb/s")
        let speed = "n.c."
        let AdminState = "n.c."
        let ConnectedMacs = []
        if(val.ConnectedMacs)
            ConnectedMacs = val.ConnectedMacs
        if(val.Speed)
            speed = val.Speed
        if(val.AdminState)
            AdminState = val.AdminState
        Switch.Ports.push({ 
            Name: key, 
            ConnectedMacs : ConnectedMacs, 
            IGMP : {
                ForwardAll: val.ForwardAll, 
                Groups: []
            }, 
            AdminState: AdminState, 
            Speed: speed, 
            In : Math.round(val.In*8/CountTime/1024/1024*10*1000)/10, 
            Out : Math.round(val.Out*8/CountTime/1024/1024*10*1000)/10
        })
    
    });
    NewData = true
    console.log(Switch)
    try {
        client.send(JSON.stringify(Switch))
    } catch (error) {
        console.error("Waiting to reconnect to ws...")
    } 
}

function getPortStatus() {        
    switchTelnet.exec("show int status", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(function() {getPortStatus()}, SwitchPollTime*1000);
            return
        }
        for(let line of array) {
            let port = line.split(/\s+/)
            if(port[0].startsWith("gi")) {
                SwitchData[port[0]].Speed = parseInt(port[3])
            }
        }
        setTimeout(getNextFct("getPortStatus"), SwitchPollTime*1000);
    
    })
}

function getPortConfig() {        
    switchTelnet.exec("show int config", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(function() {getPortConfig()}, SwitchPollTime*1000);
            return
        }
        for(let line of array) {
            let port = line.split(/\s+/)
            if(port[0].startsWith("gi")) {
                SwitchData[port[0]].AdminState = (port[6])
            }
        }
        setTimeout(getNextFct("getPortConfig"), SwitchPollTime*1000);
    
    })
}

function getBridgeIgmpStatus() {        
    switchTelnet.exec("show bridge multicast filtering 1", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(function() {getPortConfig()}, SwitchPollTime*1000);
            return
        }
        for(let line of array) {
            if(line.startsWith("Filtering: Enabled"))
                Switch.Multicast = "on";
            if(line.startsWith("gi")) {
                let port = line.split(/\s+/)
                SwitchData[port[0]].ForwardAll = (port[1] == "Forward")? "Yes" : "No"
            }
        }
        setTimeout(getNextFct("getBridgeIgmpStatus"), SwitchPollTime*1000);
    
    })
}

function getMacAddressTable() {        
    switchTelnet.exec("show mac address-table ", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(function() {getPortConfig()}, SwitchPollTime*1000);
            return
        }
        Object.keys(SwitchData).forEach(function(key) {
            SwitchData[key].ConnectedMacs = []
        })
        for(let line of array) {
            
            let add = line.split(/\s+/)
            //console.log(add)
            if(add[1] == 1) {
                if(add[3] == 0) {
                    Switch.Mac = add[2]
                }
                else {
                    if(SwitchData[add[3]]) {
                        SwitchData[add[3]].ConnectedMacs.push(add[2])
                    }
                }
            }
        }
        setTimeout(getNextFct("getMacAddressTable"), SwitchPollTime*1000);
    
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
            return getPortConfig
        case "getPortConfig" :
            return getBridgeIgmpStatus
        case "getBridgeIgmpStatus" :
            return getMacAddressTable
        case "getMacAddressTable" :
            return get_count
    }
}

function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", (err, respond) => {})
    setTimeout(clear_count, 1000);
}

console.log("start")

startTelenetToSwitch()