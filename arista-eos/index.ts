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
    postReq("show system systemd detail",(e) => console.log(e))
    waitNext(run)
}

run()