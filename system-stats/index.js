"use strict";
exports.__esModule = true;
var request = require('request');
var SwitchPollTime = 5;
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'user', alias: 'u', type: String, defaultValue: 'vrnetlab' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'VR-netlab9' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: 'disk', alias: 'd', type: String, defaultValue: "/" },
    { name: "missioncontrol", alias: "m", type: String }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var client = require('../mnms-client-ws-interface');
client.challenge(options.key);
client.setCallback(function (data) { console.log(data); });
client.run(options.missioncontrol);
client.info({
    Info: "System client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var Node = {
    Name: "Artel",
    Type: "MdnsNode",
    IP: "",
    Schema: 1,
    Ports: [],
    Multicast: "off",
    Neighbour: "",
    Mac: "",
    OtherIPs: [],
    Macs: [],
    id: options.id,
    System: {
        CPU5s: 0,
        CPU1min: 0,
        CPU5min: 0,
        MemBusy: 0,
        DiskBuzy: 0,
        CPUTemps: [],
        CPUSpeeds: []
    }
};
var osu = require('node-os-utils');
var os = require('os');
var nodeDiskInfo = require('node-disk-info');
var si = require('systeminformation');
var busyCpu = function (t) {
    osu.cpu.usage(t * 1000).then(function (d) {
        if (t == 60) {
            Node.System.CPU1min = d;
            try {
                var disks = nodeDiskInfo.getDiskInfoSync();
                diskSize(disks);
            }
            catch (e) {
                console.error(e);
            }
            console.log(Node);
        }
        if (t == 5) {
            Node.System.CPU5s = d;
            osu.mem.info().then(function (d) { return Node.System.MemBusy = 100 - d.freeMemPercentage; });
            client.send(JSON.stringify(Node));
            si.cpuTemperature().then(function (d) { return Node.System.CPUTemps = d.cores; });
            si.cpuCurrentspeed().then(function (d) { return Node.System.CPUSpeeds = d.cores; });
            console.log(Node);
        }
        if (t == 300) {
            Node.System.CPU5min = d;
            netInts();
        }
        busyCpu(t);
    });
};
osu.cpu.usage().then(function (d) { return console.log(d); });
Node.Name = os.hostname();
var netInts = function () {
    var ints = os.networkInterfaces();
    Object.keys(ints).forEach(function (value, index, tab) {
        for (var _i = 0, _a = ints[value]; _i < _a.length; _i++) {
            var int = _a[_i];
            if (int.family == 'IPv4' && int.internal == false) {
                Node.IP = int.address;
                if (!Node.OtherIPs.includes(int.address))
                    Node.OtherIPs.push(int.address);
                Node.Mac = int.mac;
                if (!Node.Macs.includes(int.mac))
                    Node.Macs.push(int.mac);
            }
        }
    });
};
function diskSize(disks) {
    for (var _i = 0, disks_1 = disks; _i < disks_1.length; _i++) {
        var disk = disks_1[_i];
        console.log('Filesystem:', disk.filesystem);
        console.log('Blocks:', disk.blocks);
        console.log('Used:', disk.used);
        console.log('Available:', disk.available);
        console.log('Capacity:', disk.capacity);
        console.log('Mounted:', disk.mounted, '\n');
        console.log(options.disk);
        if (disk.mounted == options.disk) {
            Node.System.DiskBuzy = Number(disk.capacity.split("%")[0]);
        }
    }
}
busyCpu(5);
busyCpu(60);
busyCpu(300);
netInts();
