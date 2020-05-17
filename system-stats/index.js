"use strict";
exports.__esModule = true;
var request = require('request');
var SwitchPollTime = 5;
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: 'localhost:3080' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'vrnetlab' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'VR-netlab9' },
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
    Info: "Artel switch client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var Node = {
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
var osu = require('node-os-utils');
var os = require('os');
var nodeDiskInfo = require('node-disk-info');
osu.cpu.usage().then(function (d) { return console.log(d); });
osu.mem.info().then(function (d) { return console.log(100 - d.freeMemPercentage); });
os.hostname();
os.networkInterfaces();
try {
    var disks = nodeDiskInfo.getDiskInfoSync();
    printResults('SYNC WAY', disks);
}
catch (e) {
    console.error(e);
}
function printResults(title, disks) {
    console.log("============ " + title + " ==============\n");
    for (var _i = 0, disks_1 = disks; _i < disks_1.length; _i++) {
        var disk = disks_1[_i];
        console.log('Filesystem:', disk.filesystem);
        console.log('Blocks:', disk.blocks);
        console.log('Used:', disk.used);
        console.log('Available:', disk.available);
        console.log('Capacity:', disk.capacity);
        console.log('Mounted:', disk.mounted, '\n');
    }
}
