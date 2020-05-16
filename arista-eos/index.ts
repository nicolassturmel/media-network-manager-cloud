const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: 'localhost:3080' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'vrnetlab' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'VR-netlab9' },
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
    IP: options.ip.split(":")[0],
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

var postReq = async (path,handle) => {
    console.log("Get " + "http://" + options.user + ":" + options.password + "@" + options.ip + "/command-api")
    await request.post("http://" + options.user + ":" + options.password + "@" + options.ip + "/command-api", { 
        json : {
                "jsonrpc": "2.0",
                "method": "runCmds",
                "params": {
                  "format": "json",
                  "timestamps": false,
                  "autoComplete": false,
                  "expandAliases": false,
                  "includeErrorDetail": false,
                  "cmds": [
                    path
                  ],
                  "version": 1
                },
                "id": "MNMS-" + options.key
            }
        }
    , function (error, res, body) {
        console.log("Reply")
        if (error) {
            console.error(error);
            return;
        }
        if (res.statusCode == 200) {
            handle(body);
        }
        else
            console.log(path + " -> statusCode: " + res.statusCode);
        //console.log(`statusCode: ${res.statusCode}`)
        //console.log(body.result[0].val)
    });
}

var waitNext = (fct) => {
    setTimeout(fct, SwitchPollTime * 1000)
}

var run = () => {
    let commands = [
        "show interfaces management 1", // get mac address of management
        "show hostname", // name of the device
        "show interfaces status ", // interface name and status
        "show interfaces counters", // computing bandwidth
        "show mac address-table ", // mac address table
        "show ip igmp groups", //  multicast groups
        "show ip igmp static-groups" // same but static groups
    ]
    //postReq("show system systemd detail",process)
    process(testResp)
}

var process = (data) => {
    console.log(data)
    if(data.result && data.result.length == 7) {
        console.log("Processing")
        BWtime = Date.now();
        Switch.Ports = []
        getMac(data.result[0])
        getName(data.result[1])
        getInetrfaces(data.result[2])
        getBW(data.result[3])
        getFwMacs(data.result[4])
    }
    console.log(Switch,Switch.Ports.length)
    waitNext(run)
}

var getMac = (d) => {
    if(d.interfaces && d.interfaces.Management1 && d.interfaces.Management1.burnedInAddress)
        Switch.Mac = d.interfaces.Management1.burnedInAddress
}

var getName = (d) => {
    if(d.hostname)
        Switch.Name = d.hostname
}

var getInetrfaces = (d) => {
    if(d.interfaceStatuses) {
        Object.keys(d.interfaceStatuses).forEach((xvalue,xindex,xarray) => {
            if(d.interfaceStatuses[xvalue].interfaceType != "N/A"
            )
            {
                let AdminState = d.interfaceStatuses[xvalue].interfaceType != "Not Present"? "on" : "off"
                let bw = d.interfaceStatuses[xvalue].interfaceType != "Not Present"? d.interfaceStatuses[xvalue].bandwidth/1000000 : 0
                let Port : MnMs_node_port = {
                    Name: xvalue,
                    ConnectedMacs: [],
                    IGMP: {
                        ForwardAll: "off",
                        Groups: {}
                    },
                    AdminState: AdminState,
                    Speed: bw,
                    In: null,
                    Out: null
                }
                Switch.Ports.push(Port)
            }
        })
    }
}

let BWdata = {}
let BWtime = 0
let BWformertime = 0
let test= 0 // change to test, e.g. : SwitchPollTime
var getBW = (d) => {
    if(d.interfaces) {
        let TimeDen = BWtime - BWformertime
        BWformertime = BWtime
        Object.keys(d.interfaces).forEach((xvalue,xindex,xarray) => {
            if(BWdata[xvalue]) {
                let Idx = Switch.Ports.findIndex((x) => x.Name == xvalue)
                if(Idx >= 0) {
                    Switch.Ports[Idx].In = Math.floor(8*(d.interfaces[xvalue].inOctets + test*12500000 - BWdata[xvalue].lastIn)/100/TimeDen)/10
                    Switch.Ports[Idx].Out = Math.floor(8*(d.interfaces[xvalue].outOctets + test*25000000 - BWdata[xvalue].lastOut)/100/TimeDen)/10
                }
            }
            BWdata[xvalue] = {
                    lastIn : d.interfaces[xvalue].inOctets ,
                    lastOut : d.interfaces[xvalue].outOctets 
                }

        })
    }
}

var getFwMacs = (d) => {
    console.log("Getting fwd macs")
    if(d.unicastTable && d.unicastTable.tableEntries) {
        console.log("has unicastTable",d.unicastTable.tableEntries.length)
        for(let um of d.unicastTable.tableEntries) {
            let Idx = Switch.Ports.findIndex((x) => x.Name == um.interface)
            console.log(Idx)
            if(Idx >= 0) {
                let mac = um.macAddress
                if(!Switch.Ports[Idx].ConnectedMacs.includes(mac)) {
                    console.log("Adding mac",mac)
                    Switch.Ports[Idx].ConnectedMacs.push(mac)
                }
            }
        }
    }
}

var testResp = {
    "jsonrpc": "2.0",
    "id": "EapiExplorer-1",
    "result": [
      {
        "interfaces": {
          "Management1": {
            "lastStatusChangeTimestamp": 1553876130.5554357,
            "name": "Management1",
            "interfaceStatus": "connected",
            "autoNegotiate": "success",
            "burnedInAddress": "28:99:3a:28:42:ca",
            "loopbackMode": "loopbackNone",
            "interfaceStatistics": {
              "inBitsRate": 7849.49629374565,
              "inPktsRate": 12.846062206979285,
              "outBitsRate": 11875.004182500992,
              "updateInterval": 300,
              "outPktsRate": 2.3981880088475287
            },
            "mtu": 1500,
            "hardware": "ethernet",
            "duplex": "duplexFull",
            "bandwidth": 1000000000,
            "forwardingModel": "routed",
            "lineProtocolStatus": "up",
            "interfaceCounters": {
              "outBroadcastPkts": 36,
              "linkStatusChanges": 3,
              "totalOutErrors": 0,
              "inMulticastPkts": 1169806,
              "counterRefreshTime": 1589467435.839904,
              "inBroadcastPkts": 447114547,
              "outputErrorsDetail": {
                "deferredTransmissions": 0,
                "txPause": 0,
                "collisions": 0,
                "lateCollisions": 0
              },
              "inOctets": 30749847344,
              "outDiscards": 0,
              "outOctets": 240232110,
              "inUcastPkts": 108626,
              "inputErrorsDetail": {
                "runtFrames": 0,
                "rxPause": 0,
                "fcsErrors": 0,
                "alignmentErrors": 0,
                "giantFrames": 0,
                "symbolErrors": 0
              },
              "outUcastPkts": 109308,
              "outMulticastPkts": 1186351,
              "totalInErrors": 0,
              "inDiscards": 0
            },
            "interfaceAddress": [
              {
                "secondaryIpsOrderedList": [],
                "broadcastAddress": "255.255.255.255",
                "virtualSecondaryIps": {},
                "dhcp": false,
                "secondaryIps": {},
                "primaryIp": {
                  "maskLen": 24,
                  "address": "192.168.102.101"
                },
                "virtualSecondaryIpsOrderedList": [],
                "virtualIp": {
                  "maskLen": 0,
                  "address": "0.0.0.0"
                }
              }
            ],
            "physicalAddress": "28:99:3a:28:42:ca",
            "description": ""
          }
        }
      },
      {
        "fqdn": "ZGR1-CoreSwitch-2",
        "hostname": "ZGR1-CoreSwitch-2"
      },
      {
        "interfaceStatuses": {
          "Ethernet8": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet9": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet2": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": true,
            "duplex": "duplexFull",
            "autoNegotigateActive": true,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet3": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet1": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": true,
            "duplex": "duplexFull",
            "autoNegotigateActive": true,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet6": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet7": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet4": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet5": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet21": {
            "vlanInformation": {
              "vlanExplanation": "in Po21",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTB_OG-7",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet20": {
            "vlanInformation": {
              "vlanExplanation": "in Po20",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTA_EG-4",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet22": {
            "vlanInformation": {
              "vlanExplanation": "in Po22",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTB_OG-4",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Port-Channel18": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 0,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Management1": {
            "vlanInformation": {
              "interfaceMode": "routed",
              "interfaceForwardingModel": "routed"
            },
            "bandwidth": 1000000000,
            "interfaceType": "10/100/1000",
            "description": "",
            "autoNegotiateActive": true,
            "duplex": "duplexFull",
            "autoNegotigateActive": true,
            "linkStatus": "connected",
            "lineProtocolStatus": "up"
          },
          "Port-Channel19": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 0,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Ethernet13": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Port-Channel23": {
            "vlanInformation": {
              "interfaceMode": "trunk",
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 20000000000,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "connected",
            "lineProtocolStatus": "up"
          },
          "Port-Channel22": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 0,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Port-Channel21": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Port-Channel20": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 0,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Ethernet11": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet16": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet18": {
            "vlanInformation": {
              "vlanExplanation": "in Po18",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTA_EG-2",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Port-Channel17": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "N/A",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "lowerLayerDown"
          },
          "Ethernet14": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet15": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet23": {
            "vlanInformation": {
              "vlanExplanation": "in Po23",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "10GBASE-CR",
            "description": "CoreSwitch_2_Connection_1",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "connected",
            "lineProtocolStatus": "up"
          },
          "Ethernet17": {
            "vlanInformation": {
              "vlanExplanation": "in Po17",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTA_EG-1",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet10": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet24": {
            "vlanInformation": {
              "vlanExplanation": "in Po23",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "10GBASE-CR",
            "description": "CoreSwitch_2_Connection_2",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "connected",
            "lineProtocolStatus": "up"
          },
          "Ethernet12": {
            "vlanInformation": {
              "interfaceMode": "bridged",
              "vlanId": 44,
              "interfaceForwardingModel": "bridged"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          },
          "Ethernet19": {
            "vlanInformation": {
              "vlanExplanation": "in Po19",
              "interfaceForwardingModel": "dataLink"
            },
            "bandwidth": 10000000000,
            "interfaceType": "Not Present",
            "description": "BTA_EG-3",
            "autoNegotiateActive": false,
            "duplex": "duplexFull",
            "autoNegotigateActive": false,
            "linkStatus": "notconnect",
            "lineProtocolStatus": "notPresent"
          }
        }
      },
      {
        "interfaces": {
          "Ethernet8": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet9": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet12": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet2": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet3": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet1": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet6": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet7": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet4": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet5": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet21": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Vlan1": {
            "outUcastOctets": 0,
            "outMulticastOctets": 0,
            "inMulticastOctets": 0,
            "inOctets": 0,
            "inUcastOctets": 0,
            "outOctets": 0
          },
          "Vlan44": {
            "outUcastOctets": 0,
            "outMulticastOctets": 0,
            "inMulticastOctets": 0,
            "inOctets": 0,
            "inUcastOctets": 0,
            "outOctets": 0
          },
          "Ethernet22": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Port-Channel18": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet20": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Management1": {
            "inUcastPkts": 108626,
            "outMulticastPkts": 1186351,
            "outUcastPkts": 109308,
            "inMulticastPkts": 1169806,
            "outBroadcastPkts": 36,
            "inBroadcastPkts": 447114547,
            "inDiscards": 0,
            "inOctets": 30749847344,
            "outDiscards": 0,
            "outOctets": 240232110
          },
          "Port-Channel19": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet13": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Port-Channel23": {
            "inUcastPkts": 220822097,
            "outMulticastPkts": 40328421,
            "outUcastPkts": 256710135,
            "inMulticastPkts": 389193048,
            "outBroadcastPkts": 21,
            "inBroadcastPkts": 8345536,
            "inDiscards": 0,
            "inOctets": 63124119386,
            "outDiscards": 0,
            "outOctets": 27258472463
          },
          "Port-Channel22": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Port-Channel21": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Port-Channel20": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet11": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet16": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet18": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Port-Channel17": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet14": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet15": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet23": {
            "inUcastPkts": 220821235,
            "outMulticastPkts": 37955664,
            "outUcastPkts": 53393251,
            "inMulticastPkts": 354082730,
            "outBroadcastPkts": 19,
            "inBroadcastPkts": 6230948,
            "inDiscards": 0,
            "inOctets": 57070138099,
            "outDiscards": 0,
            "outOctets": 8601435061
          },
          "Ethernet17": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet10": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          },
          "Ethernet24": {
            "inUcastPkts": 885,
            "outMulticastPkts": 2372772,
            "outUcastPkts": 203316897,
            "inMulticastPkts": 35110410,
            "outBroadcastPkts": 2,
            "inBroadcastPkts": 2114588,
            "inDiscards": 0,
            "inOctets": 6053994414,
            "outDiscards": 0,
            "outOctets": 18657040110
          },
          "Vlan2324": {
            "outUcastOctets": 0,
            "outMulticastOctets": 0,
            "inMulticastOctets": 0,
            "inOctets": 0,
            "inUcastOctets": 0,
            "outOctets": 0
          },
          "Ethernet19": {
            "inUcastPkts": 0,
            "outMulticastPkts": 0,
            "outUcastPkts": 0,
            "inMulticastPkts": 0,
            "outBroadcastPkts": 0,
            "inBroadcastPkts": 0,
            "inDiscards": 0,
            "inOctets": 0,
            "outDiscards": 0,
            "outOctets": 0
          }
        }
      },
      {
        "multicastTable": {
          "tableEntries": []
        },
        "unicastTable": {
          "tableEntries": [
            {
              "macAddress": "28:99:3a:28:5d:9b",
              "interface": "Ethernet19",
              "entryType": "static",
              "vlanId": 1
            },
            {
              "macAddress": "00:0b:72:04:81:04",
              "lastMove": 1578491109.980326,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:0b:72:04:81:05",
              "lastMove": 1578491111.636766,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:0b:72:04:81:06",
              "lastMove": 1578491111.63729,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:0b:72:04:81:07",
              "lastMove": 1578491111.634931,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:00:b5:22",
              "lastMove": 1586256521.790418,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:00:b5:25",
              "lastMove": 1586256535.532181,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:02:23:42",
              "lastMove": 1576490575.760604,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:02:23:46",
              "lastMove": 1566428622.390249,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:02:23:4a",
              "lastMove": 1562838590.79088,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:02:23:52",
              "lastMove": 1559741695.712165,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "00:19:7c:02:23:5e",
              "lastMove": 1559741695.838879,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "10:98:36:a6:29:ef",
              "lastMove": 1567150817.017205,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "10:98:36:a6:2b:78",
              "lastMove": 1568162179.889028,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "28:99:3a:28:5d:9b",
              "interface": "Port-Channel23",
              "entryType": "static",
              "vlanId": 44
            },
            {
              "macAddress": "30:d6:59:01:64:ac",
              "lastMove": 1578586316.558939,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "70:b3:d5:04:2a:0f",
              "lastMove": 1573382752.471369,
              "interface": "Port-Channel23",
              "moves": 1,
              "entryType": "dynamic",
              "vlanId": 44
            },
            {
              "macAddress": "28:99:3a:28:5d:9b",
              "interface": "Port-Channel23",
              "entryType": "static",
              "vlanId": 2324
            }
          ]
        }
      },
      {
        "groupList": []
      },
      {
        "intfAddrs": {}
      }
    ]
  }
run()

