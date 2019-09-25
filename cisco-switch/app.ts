

const SwitchPollTime = 0.5

const Telnet = require('telnet-client')
const commandLineArgs = require('command-line-args')

import { MnMs_node } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.201' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'cisco' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'cisco' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: 'noid' },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.whoami("mnms client ws test prgm")
client.setCallback((data) => {console.log(data)})
client.run(options.missioncontrol)

// Connecting to switch

var SwitchData: object = {};
var OldValue: object = {}
var Switch : MnMs_node = { 
    Type: "switch", 
    IP: options.ip,
    Schema: 1, 
    Ports: [], 
    Multicast: "off", 
    Neighbour: "",
    Mac: "", 
    id: options.id
};    
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData

let params = {
    host: options.ip,
    port: 23,
    shellPrompt: /.+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: options.user,
    password: options.password,
    pageSeparator: /More: <space>,  Qu.*/,
    timeout: 0,
    execTimeout: 5000
}

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
})

switchTelnet.on('close', function () {
    console.log('connection closed')
    setTimeout(startTelenetToSwitch, 20000);
})

//switchTelnet.on('data', (data) => { console.log(data.toString())})

function startTelenetToSwitch() {

    switchTelnet.connect(params)

}

function get_count() {
    
    let State: ParseState = ParseState.In

    
        switchTelnet.exec("show int coun", function (err, response) {
            console.log(">>>>>>>>>",response,"<<<<<<<<<<")
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
            console.log(">>>>>>>>>",respond,"<<<<<<<<<<")
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
                Groups: val.IGMPGroups
            }, 
            AdminState: AdminState, 
            Speed: speed, 
            In : Math.round(val.In*8/CountTime/1024/1024*10*1000)/10, 
            Out : Math.round(val.Out*8/CountTime/1024/1024*10*1000)/10
        })
    
    });
    NewData = true
    try {
        client.send(JSON.stringify(Switch))
        console.log("OK! " + options.ip)
    } catch (error) {
        console.error("Waiting to reconnect to ws...")
    } 
}

function getPortStatus() {        
    switchTelnet.exec("show int status", function (err, response) {
        console.log(">>>>>>>>>",response,"<<<<<<<<<<")
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
        console.log(">>>>>>>>>",response,"<<<<<<<<<<")
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
        console.log(">>>>>>>>>",response,"<<<<<<<<<<")
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
        console.log(">>>>>>>>>",response,"<<<<<<<<<<")
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

function portList(x) {
    let list = []

    if(!x) return []
    for(let e of x.split(",")) {
        let r = e.match(/gi(\d+)-(\d+)/)
        if(r) {
            for(let i = parseInt(r[1]) ; i <= parseInt(r[2]) ; i++)
                list.push("gi" + i)
        }
        else
            list.push(e)
    }
    return list
}

function getMulticastSources() {        
    switchTelnet.exec("show bridge multicast address-table", function (err, response) {
        console.log(">>>>>>>>>",response,"<<<<<<<<<<")
        if(response) {
            let tabs = response.split("\n\n")
            Object.keys(SwitchData).forEach(function(key) {
                SwitchData[key].IGMPGroups = {}
            })
            for(let i in tabs) {
                let lines
                switch(parseInt(i)) {
                    case 5:
                            //console.log("Tab", tabs[i])
                            lines = tabs[i].split("\n")
                            lines.splice(0,2)
                            for(let line of lines) {
                                let toks = line.split(/\s+/)
                                if(toks.length < 3) break
                                let ps = portList(toks[3])
                                for(let p of ps) {
                                    SwitchData[p].IGMPGroups[toks[1]] = true;
                                }
                            }
                            break;
                    case 7:
                            lines = tabs[i].split("\n")
                            lines.splice(0,2)
                            for(let line of lines) {
                                let toks = line.split(/\s+/)
                                if(toks.length < 2) break
                                let ps = portList(toks[2])
                                for(let p of ps) {
                                    SwitchData[p].IGMPGroups[toks[1]] = true;
                                }
                            }
                            break;
                    case 9:
                            lines = tabs[i].split("\n")
                            lines.splice(0,2)
                            for(let line of lines) {
                                let toks = line.split(/\s+/)
                                if(toks.length < 3) break
                                let ps = portList(toks[3])
                                for(let p of ps) {
                                    SwitchData[p].IGMPGroups[toks[1]] = true;
                                }
                            }
                            break;
                    case 11:
                            lines = tabs[i].split("\n")
                            lines.splice(0,2)
                            for(let line of lines) {
                                let toks = line.split(/\s+/)
                                if(toks.length < 2) break
                                let ps = portList(toks[2])
                                for(let p of ps) {
                                    SwitchData[p].IGMPGroups[toks[1]] = true;
                                }
                            }
                            break;
                }
            }
            setTimeout(getNextFct("getMulticastSources"), SwitchPollTime*1000);
        } 
        else {
            console.log("Oupsy, error !")
            setTimeout(getNextFct("getMulticastSources"), SwitchPollTime*1000);
        }
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
            return getMulticastSources
        case "getMulticastSources" :
            return get_count
    }
}

function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", (err, respond) => {
        switchTelnet.exec("terminal width 0", (err, respond) => {
            setTimeout(clear_count, 1000);
        })
    })
}

console.log("start")

startTelenetToSwitch()