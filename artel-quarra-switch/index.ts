const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.131' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'admin' },
    { name: 'password', alias: 'p', type: String, defaultValue: '' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.setCallback((data) => {console.log(data)})
client.run(options.missioncontrol)
client.info({
    Info: "Artel switch client",
    ServiceClass: "Switches",
    id: options.id
})

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
    id: options.id,
    _Timers: [{
        path: "$",
        time: 10
    }]
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
        mac.val.PortList.forEach( p => {
            if(mac.val.CopyToCpu == 0)
                Switch.Ports[Switch.Ports.findIndex(k => k.Name == p.split(" 1/").join(""))].ConnectedMacs.push(mac.key[1].toLowerCase())
        })
        if(mac.val.PortList.length == 0 && mac.val.CopyToCpu == 1 && parseInt("0x" + mac.key[1].split(":")[0])%2==0) {
            console.log(mac.key[1])
            Switch.Mac = mac.key[1].toLowerCase()
            Switch.Macs = [mac.key[1].toLowerCase()]
            Switch.Name = "Artel " + mac.key[1].toLowerCase().substr(-8)
        }
    })
}

var getMulticastSources = (body) => {
    body.result.forEach(gr => {
        //console.log(gr.key,gr.val)
        Switch.Ports[Switch.Ports.findIndex(k => k.Name == gr.key[2].split(" 1/").join(""))].IGMP.Groups[gr.key[1]] = true
    })
}

var getMulticastConfig = (body) => {
    //console.log(body.result[0].val)
    body.result.forEach(gr => {
        if(gr.key == "VLAN 1") {
            if(gr.val.QuerierStatus != "disabled") {
                Switch.Multicast = "on"
            }
            else 
                Switch.Multicast = "off"
        }
    })
}

var getRouterPorts = (body) => {
    body.result.forEach(gr => {
        Switch.Ports[Switch.Ports.findIndex(k => k.Name == gr.key.split(" 1/").join(""))].IGMP.ForwardAll = (gr.val.Status == "none")? "off" : "on"
    })
}

var getVlans = (body) => {
    body.result.forEach(gr => {
        let VLANs = {
            Tagged: [],
            Untagged: []
        }
        switch(gr.val.Mode) {
            case "access":
                VLANs.Untagged.push(gr.val.AccessVlan)
                break;
            case "hybrid":
                VLANs.Untagged.push(gr.val.HybridNativeVlan)
                gr.val.HybridVlans.forEach(element => {
                    if(!VLANs.Untagged.includes(element))
                        VLANs.Tagged.push(element)
                });
                break;
            case "trunk":
                if(gr.val.TrunkTagNativeVlan)
                    VLANs.Tagged.push(gr.val.TrunkNativeVlan)
                else
                    VLANs.Untagged.push(gr.val.TrunkNativeVlan)
                gr.val.TrunkVlans.forEach(element => {
                    if(!VLANs.Untagged.includes(element))
                        VLANs.Tagged.push(element)
                });
                break;
        }
        Switch.Ports[Switch.Ports.findIndex(k => k.Name == gr.key.split(" 1/").join(""))].Vlan = VLANs
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
            postReq("ipmc-snooping.status.igmp.vlan.get",getMulticastConfig)
            break;
        case "ipmc-snooping.status.igmp.vlan.get":
            postReq("mac.status.fdb.full.get",getMacs)
            break;
        case "mac.status.fdb.full.get":
            postReq("ipmc-snooping.status.igmp.group-src-list.get",getMulticastSources)
            break;
        case "ipmc-snooping.status.igmp.group-src-list.get":
            postReq("ipmc-snooping.status.igmp.router-port.get",getRouterPorts)
            break
        case "ipmc-snooping.status.igmp.router-port.get":
            postReq("vlan.config.interface.get",getVlans)
            break
        case "vlan.config.interface.get":
            Switch._Timers[0].time = client.getSendInterval()
            client.send(JSON.stringify(Switch))
            console.log(Switch)
            waitNext()
            break;
        default:
            postReq("port.statistics.rmon.get",getStatistics)
            break;
    }
}

postReq("port.statistics.rmon.get",getStatistics)