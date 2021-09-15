

const SwitchPollTime = 600

const Telnet = require('telnet-client')
const commandLineArgs = require('command-line-args')

import { MnMs_node } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.3' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'cisco' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'cisco' },
    { name: 'key', alias: 'k', type: String, defaultValue: '5kQs7H1FGtdqY1sj50Zf' },
    { name: 'id', alias: 'y', type: String, defaultValue: 'fghjkldfghjk' },
    { name: "missioncontrol", alias: "m", type: String},
    { name: "allowcontrol", alias: "c", type: Boolean}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

// Commands

var SwitchCommands = []
var SwitchBlink = false;
var SwitchBlinkTimer


client.challenge(options.key)
client.setCallback((sdata) => {
    let data = JSON.parse(sdata)
    if(data.action) {
        if(data.action.name == "identify") {
            console.log("Processing identify")
            SwitchBlink = !SwitchBlink
            if(SwitchBlink) {
                SwitchCommands.push('blink off')
                SwitchBlinkTimer = setTimeout(() => { SwitchBlink = !SwitchBlink },data.action.parameters[0].defaultValue * 1000)
            }
            else {
                clearTimeout(SwitchBlinkTimer)
            }
        }
        else {
            console.log("Not known")
        }
    } else {
        console.log("no action in Data")
    }
})
client.run(options.missioncontrol)
client.info({
    Info: "Cisco  switch client",
    ServiceClass: "Switches",
    id: options.id
})

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
    id: options.id,
    System : {
        CPU5s: 0,
        CPU1min: 0,
        CPU5min: 0,
        CPUSpeeds: [],
        CPUTemps: [],
        DiskBuzy: 0
    },
    _Timers: [
        {
            path: "$",
            time: 10
        }
    ],
    Actions: [
        {
            name: 'identify',
            description: 'switch leds will blink for X seconds',
            parameters: [{
                name: 'length',
                type: 'integer',
                defaultValue: 20
            }],
            type: "simple"
        }
    ]
};    
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
    execTimeout: 10000
}

let ArpData = []

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
        let now = new Date
        //console.log(response)
        let array
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            activeSleep(get_count, SwitchPollTime);
            return
        }
        CountTime = now.getTime() - ClearTime
        ClearTime = now.getTime()
        let previousExtractedNumbers: any = [0]
        let CurrentPortNumber = 0;

        for (let line of array) 
        {
            let extractedNumbers = line.split(/\D+/).slice(1, -1)
            //console.log(line,extractedNumbers,previousExtractedNumbers,CurrentPortNumber)
            if (extractedNumbers.length == 0) { }
            else {
                if (previousExtractedNumbers[0] < CurrentPortNumber) {
                    CurrentPortNumber = 1
                    if (State == ParseState.Out) {
                        activeSleep(getNextFct("get_count"), SwitchPollTime);
                        return;
                    }
                    State = ParseState.Out
                }
                if (previousExtractedNumbers[0] == CurrentPortNumber && CurrentPortNumber != 0) {
                    //console.log("Filling ",CurrentPortNumber)
                    if(SwitchData["gi" + CurrentPortNumber] == undefined) {
                        SwitchData["gi" + CurrentPortNumber] = {}
                        OldValue["gi" + CurrentPortNumber] = {}
                    }
                    if(SwitchData["gi" + CurrentPortNumber][State] == undefined) {
                        SwitchData["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4]
                        OldValue["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4]
                    }
                    else {
                        SwitchData["gi" + CurrentPortNumber][State] = (Math.pow(2,32) + previousExtractedNumbers[4] - OldValue["gi" + CurrentPortNumber][State])%Math.pow(2,32)
                        OldValue["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4]
                    }
                }
                CurrentPortNumber++
                previousExtractedNumbers = extractedNumbers
            }

        }
        activeSleep(get_count, SwitchPollTime);
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
                activeSleep(getNextFct("clear_count"), SwitchPollTime);
            }
            else
                activeSleep(function() {clear_count()}, 500);
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
        let p = Switch.Ports.push({ 
            Name: key, 
            ConnectedMacs : ConnectedMacs, 
            IGMP : {
                ForwardAll: val.ForwardAll, 
                Groups: val.IGMPGroups
            }, 
            Vlan: val.Vlan,
            AdminState: AdminState, 
            Speed: speed, 
            In : Math.round(val.In*8/CountTime/1024/1024*10*1000)/10, 
            Out : Math.round(val.Out*8/CountTime/1024/1024*10*1000)/10,
            
        })
        if(val.Neighbour) Switch.Ports[p-1].Neighbour = val.Neighbour
    });
    NewData = true
    console.log(Switch)
    try {
        Switch._Timers[0].time = client.getSendInterval()
        client.send(JSON.stringify(Switch))
        console.log("OK! " + options.ip)
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
            activeSleep(function() {getPortStatus()}, SwitchPollTime);
            return
        }
        for(let line of array) {
            let port = line.split(/\s+/)
            if(port[0].startsWith("gi")) {
                SwitchData[port[0]].Speed = parseInt(port[3])
            }
        }
        activeSleep(getNextFct("getPortStatus"), SwitchPollTime);
    
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
            activeSleep(function() {getPortConfig()}, SwitchPollTime);
            return
        }
        for(let line of array) {
            let port = line.split(/\s+/)
            if(port[0].startsWith("gi")) {
                SwitchData[port[0]].AdminState = (port[6])
            }
        }
        activeSleep(getNextFct("getPortConfig"), SwitchPollTime);
    
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
            activeSleep(function() {getPortConfig()}, SwitchPollTime);
            return
        }
        for(let line of array) {
            if(line.startsWith("Filtering: Enabled"))
                Switch.Multicast = "on";
            if(line.startsWith("gi")) {
                let port = line.split(/\s+/)
                SwitchData[port[0]].ForwardAll = (port[1] == "Forward")? "on" : "off"
            }
        }
        activeSleep(getNextFct("getBridgeIgmpStatus"), SwitchPollTime);
    
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
            setTimeout(function() {getPortConfig()}, SwitchPollTime);
            return
        }
        Object.keys(SwitchData).forEach(function(key) {
            SwitchData[key].ConnectedMacs = []
        })
        for(let line of array) {
            
            let add = line.split(/\s+/)
            if(add.length == 6) {
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
        activeSleep(getNextFct("getMacAddressTable"), SwitchPollTime);
    
    })
}

function getArp() {        
    switchTelnet.exec("show arp ", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            activeSleep(function() {getPortConfig()}, SwitchPollTime);
            return
        }
        ArpData = []
        let Ports = {}
        for(let line of array) {
            let add = line.split(/\s+/)
            if(add.length >= 7) {
                if(!Ports[add[2]]) Ports[add[2]] = []
                Ports[add[2]].push(add[3])


                ArpData.push({Ip: add[3], Mac: add[4]})
                console.log(ArpData)    
            }
        }
        

        client.send(JSON.stringify({Type: "ARP", Data: ArpData}))
        activeSleep(getNextFct("getArp"), SwitchPollTime);
    
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
            activeSleep(getNextFct("getMulticastSources"), SwitchPollTime);
        } 
        else {
            console.log("Oupsy, error !",err,response)
            activeSleep(getNextFct("getMulticastSources"), SwitchPollTime);
        }
    })
}

function getLLDP() {
    switchTelnet.exec("show lldp neig", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(function() {getPortConfig()}, SwitchPollTime);
            return
        }
        for(let line of array) {
            let toks = line.split(/\s+/)
            if(SwitchData[toks[0]]) {
                if(SwitchData[toks[0]].ConnectedMacs.includes(toks[1])) {
                    SwitchData[toks[0]].ConnectedMacs = [toks[1]]
                }
                else {
                    //console.log("Error " + toks[0] +  ", not in array",toks[1],SwitchData[toks[0]].ConnectedMacs)
                }
            }
            else {
                //console.log("not found",toks[0])
            }
        }

        activeSleep(getNextFct("getLLDP"), SwitchPollTime);
    })
}

function systemInfo() {
    switchTelnet.exec("show system", function (err, response) {
        let array 
        try {
            array = response.split("\n")
            if(array[3].includes("System Name")) Switch.Name = array[3].split(/\s+/)[2]
        } catch (error) {
            console.log("Response error : can not split in array")
            console.log(response)
            setTimeout(getNextFct("systemInfo"), SwitchPollTime);
            return
        }
        
        let llineNumber : any
        for( llineNumber in array) {
            llineNumber = parseInt(llineNumber)
            if(array[llineNumber].startsWith("Unit") && array[llineNumber].includes("Temp") && llineNumber<array.length) {
                Switch.System.CPUTemps = [parseInt(array[llineNumber+2].split(/\s+/)[2])]

            }
        }
        setTimeout(() => switchTelnet.exec("show system tcam utili", (err,response) => {
            try {
                array = response.split("\n")
            } catch (error) {
                console.log("Response error : can not split in array")
                console.log(response)
                activeSleep(getNextFct("systemInfo"), SwitchPollTime);
                return
            }
            Switch.System.MemBusy = parseInt(array[0].split(" ")[1])

            setTimeout(() => switchTelnet.exec("show cpu util", (err,response) => {
                try {
                    array = response.split("\n")
                } catch (error) {
                    console.log("Response error : can not split in array")
                    console.log(response)
                    activeSleep(getNextFct("systemInfo"), SwitchPollTime);
                    return
                }

                if(array.length>=5) {
                    let p = array[4].split(/\s+/)
                    Switch.System.CPU5s  = parseInt(p[2])
                    Switch.System.CPU1min  = parseInt(p[5])
                    Switch.System.CPU5min  = parseInt(p[8])
                }
                activeSleep(getNextFct("systemInfo"), SwitchPollTime);
            }),300)
        }),300)
    })
}

function getVlans() {
    Object.keys(SwitchData).forEach(k => {
        SwitchData[k].Vlan = null
    })
    var portList = (l) => {
        let it = l.replace(/\s/g,"").split(",")
        let r = []
        for(let s of it) {
            if(s.startsWith("gi")) {
                let g = s.split('-')
                r.push(g[0])
                if(g.length == 2) {
                    let start = parseInt(g[0].substr(2))
                    let stop = parseInt(g[1])
                    for(let p = start+1; p <= stop; p++)
                        r.push("gi"+p)
                }
            }
        }
        return r
    }
    switchTelnet.exec("show vlan", function (err, response) {
        let array 
        try {
            array = response.split("\n")
        } catch (error) {
        }
        if(!array || array.length < 3) {}
        else {
            let grid = array[3]
            let items = grid.split(" ");
            if (items.length > 3)  for(let l = 4; l < array.length - 2; l++) {
                let vlan = parseInt(array[l].substr(0,items[0].length))
                let nextstop = items[0].length+1
                nextstop += items[1].length+1
                let taged = array[l].substr(nextstop,items[2].length)
                nextstop += items[2].length+1
                let untaged = array[l].substr(nextstop,items[3].length)
                for(let p of portList(taged)) {
                    if(!SwitchData[p].Vlan) SwitchData[p].Vlan = { Tagged: [], Untagged: []}
                    SwitchData[p].Vlan.Tagged.push(vlan)
                }
                for(let p of portList(untaged)) {
                    if(!SwitchData[p].Vlan) SwitchData[p].Vlan = { Tagged: [], Untagged: []}
                    SwitchData[p].Vlan.Untagged.push(vlan)
                }
            }
        }
        activeSleep(getNextFct("getVlans"), SwitchPollTime);
    })
}

async function blink(str = "") {
    await new Promise( (resolve, reject) => {
        switchTelnet.exec("config", (err, respond) => {
            console.log(err,respond)
            console.log('trying disable poirt led:' + str + '  -->  ' +str+"disable port led")
            switchTelnet.exec(str+"disable port led", (err, respond) => {
                console.log(err,respond)
                switchTelnet.exec("exit", (err, respond) => {
                    console.log(err,respond)
                    setTimeout(resolve, 300)
                })
            })
        })
    })
    
}

function activeSleep(nextStep,time) {
    while(SwitchCommands.length > 0) {
        switch(SwitchCommands[0]) {
            case 'blink on':
                blink()
                setTimeout(() => SwitchCommands.push('blink off'),1500)
                break;
            case 'blink off':
                blink("no ")
                if(SwitchBlink) setTimeout(() => SwitchCommands.push('blink on'),1500)
                break;
            default:
                break;
        }
        SwitchCommands.splice(0,1)
    }
    if(time <= 0) return nextStep()
    else setTimeout(() => activeSleep(nextStep,time-100),100)
}

let cycle = 100
function getNextFct(current)
{
    //console.log(cycle)
    console.log(current)
    switch(current) {
        case "clear_count" :
            return get_count
        case "get_count" :
            return getPortStatus
        case "getPortStatus" :
            return systemInfo
        case "systemInfo":
            return getPortConfig
        case "getPortConfig" :
            return getBridgeIgmpStatus
        case "getBridgeIgmpStatus" :
            return getMacAddressTable
        case "getMacAddressTable" :
            return getLLDP
        case "getLLDP" :
            return getMulticastSources
        case "getMulticastSources" :
            computeBandWidth()
            return getVlans
        case "getVlans" :
           return getArp
        case "getArp" :
            return get_count
    }
}

function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", (err, respond) => {
        switchTelnet.exec("terminal width 0", (err, respond) => {
            switchTelnet.exec("config", (err, respond) => {
                console.log(err,respond)
                switchTelnet.exec("no logging console", (err, respond) => {
                    console.log(err,respond)
                    switchTelnet.exec("exit", (err, respond) => {
                        console.log(err,respond)
                        setTimeout(clear_count, 1000);
                    })
                })
            })
        })
    })
}



console.log("start")

startTelenetToSwitch()