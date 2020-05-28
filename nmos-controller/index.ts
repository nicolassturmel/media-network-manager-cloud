const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: 'localhost' },
    { name: 'port', alias: 'p', type: String, defaultValue: '3211' },
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
    id: options.id
};    
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData

var postReq = async (path) => {
    return new Promise((resolve,error) => {
        request(path, function (error, response, body) {
            //console.error('error:', error); // Print the error if one occurred
            //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            //console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
            resolve(JSON.parse(body))
        });
    })
    
}


let Switches : MnMs_node[] = []
var newSwitch = (ip,name) => {
    return Switches.push({
        IP: ip,
        Name: name,
        Type: "MdnsNode", 
        Schema: 1, 
        Ports: [], 
        Multicast: "off", 
        Neighbour: "",
        Mac: "", 
        OtherIPs: [],
        Macs: [],
        id: options.id,
        _Timers: [
        {
            path: "$",
            time: 5
        }
        ]
    })-1
}

let nmos_refs = {}
var process = (data) => {
    //console.log(data)
    for(let n of data) {
        nmos_refs[n.id] = {
            index: newSwitch("",n.label),
            node: n.node_id,
            senders: [],
            receivers: [],
            sources: []
        }
    }
}

var run =  async () => {
    Switches = []
    await postReq("http://192.168.1.162:3211/x-nmos/query/v1.2/devices/").then(process)
    await Object.keys(nmos_refs).forEach(async r => {
        await postReq("http://192.168.1.162:3211/x-nmos/query/v1.2/nodes/" + nmos_refs[r].node).then(d => console.log(nmos_refs[r].node,d))
    })       
}

run()