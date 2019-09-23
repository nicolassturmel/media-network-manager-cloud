const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.143' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'admin' },
    { name: 'password', alias: 'p', type: String, defaultValue: '' },
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

var SwitchData = {
    oldT: 0
};

var OldValue: object = {}
var Switch : MnMs_node = { 
    Name: "Artel",
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

var postReq = (path,handle) => {
    request.post("http://" + options.user + ":" + options.password + "@" + options.ip + "/json_rpc", {
    json: {
        "method":path, "params":[],"id":"0"
    }
    }, (error, res, body) => {
    if (error) {
        console.error(error)
        return
    }
    if(res.statusCode == 200) {
        handle(body)
        nextCmd(path)
    }
    else 
    console.log(`${path} -> statusCode: ${res.statusCode}`)
    //console.log(`statusCode: ${res.statusCode}`)
    //console.log(body.result[0].val)
    })
}

var waitNext = () => {
    setTimeout(nextCmd, SwitchPollTime * 1000)
}

var getStatistics = (body) => {
    let nowT = Date.now()
    body.result.forEach(port => {
        if(SwitchData[port.key]) {
            SwitchData[port.key].In = (port.val.RxOctets - SwitchData[port.key].InOctets)/(nowT - SwitchData.oldT)
            SwitchData[port.key].Out = (port.val.TxOctets - SwitchData[port.key].OutOctets)/(nowT - SwitchData.oldT)
        } else {
            SwitchData[port.key] = {   
                In: 0,
                Out: 0
            }
        }
        SwitchData[port.key] = {
            InOctets: port.val.RxOctets,
            OutOctets: port.val.TxOctets,
            In : Math.round(SwitchData[port.key].In*8/1024/1024*10*1000)/10,
            Out : Math.round(SwitchData[port.key].Out*8/1024/1024*10*1000)/10, 

        }
    });
    SwitchData.oldT = nowT;
}

var getPortStatus = (body) => {
    Switch.Ports = []
    body.result.forEach(port => {
        let swp : MnMs_node_port = {
            Name: port.key.split(" 1/").join(""),
            ConnectedMacs: [],
            IGMP: {
                ForwardAll: "on",
                Groups: {}
            },
            AdminState: "Down",
            Speed: port.val.Link == true ? (port.val.Speed == "speed1G" ? 1000 : 100) : 0,
            In: SwitchData[port.key].In,
            Out: SwitchData[port.key].Out,
        }
        Switch.Ports.push(swp)
    })
}

var getPortConfig = (body) => {
    body.result.forEach(port => {
        //console.log(port.key,port.val)
        Switch.Ports[Switch.Ports.findIndex(k => k.Name == port.key.split(" 1/").join(""))].AdminState = (port.val.Shutdown == "false")? "Down" : "Up"
    })
}

var getMacs = (body) => {
    Switch.Ports.forEach(element => {
        element.ConnectedMacs = []
    });
    body.result.forEach(mac => {
        //console.log(mac.key, mac.val)
        mac.val.PortList.forEach( p => {
            if(mac.val.CopyToCpu == 0)
                Switch.Ports[Switch.Ports.findIndex(k => k.Name == p.split(" 1/").join(""))].ConnectedMacs.push(mac.key[1].toLowerCase())
        })
        if(mac.val.PortList.length == 0 && mac.val.CopyToCpu == 1) {
            Switch.Mac = mac.key[1].toLowerCase()
            Switch.Macs = [mac.key[1].toLowerCase()]
            Switch.Name = "Artel " + mac.key[1].toLowerCase().substr(-8)
        }
    })
}

var getMulticastSources = (body) => {
    body.result.forEach(gr => {
        console.log(gr.key,gr.val)
        Switch.Ports[Switch.Ports.findIndex(k => k.Name == gr.key[2].split(" 1/").join(""))].IGMP.Groups[gr.key[1]] = true
    })
}

var nextCmd = (path) => {
    switch(path) {
        case "port.statistics.rmon.get":
            postReq("port.status.get",getPortStatus)
            break;
        case "port.status.get":
            postReq("port.config.get",getPortConfig)
            break;
        case "port.config.get":
            postReq("ipmc-snooping.status.igmp.vlan.get",(r) => null)
            break;
        case "ipmc-snooping.status.igmp.vlan.get":
            postReq("mac.status.fdb.full.get",getMacs)
            break;
        case "mac.status.fdb.full.get":
            postReq("ipmc-snooping.status.igmp.group-src-list.get",getMulticastSources)
            break;
        case "ipmc-snooping.status.igmp.group-src-list.get":
            client.send(JSON.stringify(Switch))
            //console.log(Switch)
            waitNext()
            break;
        default:
            postReq("port.statistics.rmon.get",getStatistics)
            break;
    }
}

postReq("port.statistics.rmon.get",getStatistics)