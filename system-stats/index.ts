const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'user', alias: 'u', type: String, defaultValue: 'vrnetlab' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'VR-netlab9' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: 'disk', alias: 'd', type: String, defaultValue: "/" },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.setCallback((data) => {console.log(data)})
client.run(options.missioncontrol)
client.info({
    Info: "System client",
    ServiceClass: "Switches",
    id: options.id
})

// Connecting to switch

var Node : MnMs_node = { 
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
      DiskBuzy: 0
    }
};    

var osu = require('node-os-utils')
var os = require('os')
const nodeDiskInfo = require('node-disk-info');

var busyCpu = (t) => {
  osu.cpu.usage(t*1000).then(d => {
    if(t == 60) {
      Node.System.CPU1min = d
      try {
        const disks = nodeDiskInfo.getDiskInfoSync();
        diskSize(disks);
      } catch (e) {
        console.error(e);
      }
      console.log(Node)
    }
    if(t == 5) {
      Node.System.CPU5s = d
      osu.mem.info().then(d => Node.System.MemBusy = 100-d.freeMemPercentage)
      client.send(JSON.stringify(Node))
      console.log(Node)
    }
    if(t == 300) {
      Node.System.CPU5min = d
      netInts()
    }
    busyCpu(t)
  })
}
osu.cpu.usage().then(d => console.log(d))
Node.Name = os.hostname()

var netInts = () => {
  let ints = os.networkInterfaces()
  Object.keys(ints).forEach((value,index,tab) => {
    for(let int of ints[value]) {
      if(int.family == 'IPv4' && int.internal == false)
      {
        Node.IP = int.address
        Node.OtherIPs.push(int.address)
        Node.Mac = int.mac
        Node.Macs.push(int.mac)
      }
    }
  })
}

function diskSize(disks) {
 for (const disk of disks) {
      console.log('Filesystem:', disk.filesystem);
      console.log('Blocks:', disk.blocks);
      console.log('Used:', disk.used);
      console.log('Available:', disk.available);
      console.log('Capacity:', disk.capacity);
      console.log('Mounted:', disk.mounted, '\n');
      console.log(options.disk)

    if(disk.mounted == options.disk) {
      Node.System.DiskBuzy = Number(disk.capacity.split("%")[0])
    }
  }
}

busyCpu(5)
busyCpu(60)
busyCpu(300)
netInts()