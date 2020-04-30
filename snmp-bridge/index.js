"use strict";
exports.__esModule = true;
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.201' },
    { name: 'community', alias: 'c', type: String, defaultValue: 'public' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var client = require('../mnms-client-ws-interface');
client.challenge(options.key);
client.setCallback(function (data) { console.log(data); });
client.run(options.missioncontrol);
client.info({
    Info: "SNMP switch client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var SwitchData = {
    oldT: 0
};
var Switch = {
    Name: "SNMP",
    Type: "switch",
    IP: options.ip,
    Schema: 1,
    Ports: [],
    Multicast: "off",
    Neighbour: "",
    Mac: "",
    id: options.id
};

var snmp = require ("net-snmp");

var session = snmp.createSession (options.ip, options.community);

var getNext = (oid) => {
    return new Promise((resolve, reject) => {
        session.getNext ([oid], function (error, varbinds) {
            if (error) {
                console.error (error.toString ());
            } else {
                for (var i = 0; i < varbinds.length; i++) {
                    if (snmp.isVarbindError (varbinds[i]))
                        console.error (snmp.varbindError (varbinds[i]));
                    else
                    {
                        resolve(varbinds[i]);
                    }
                }
            }
        });
    })
}
var compareOIDs = (in_,new_) => {
    if(new_.length < in_.length)
        return false
    if(in_ == new_.substr(0,in_.length))
        return true;
    //console.log(in_," ",in_.length," ",new_.substr(0,in_.length))
    return false
}

var name_oid = "1.3.6.1.2.1.1"

async function run(oid) {
    let nn = oid
    while(compareOIDs(oid,nn)) {
        let e = await getNext(nn)
        console.log(e.oid + " -> " + e.value + " ")
        nn = e.oid
    }
    console.log("STOP")
}

run(name_oid)
