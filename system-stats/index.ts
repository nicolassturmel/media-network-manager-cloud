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

var Node : MnMs_node = { 
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

var osu = require('node-os-utils')
var os = require('os')
const nodeDiskInfo = require('node-disk-info');

osu.cpu.usage().then(d => console.log(d))
osu.mem.info().then(d => console.log(100-d.freeMemPercentage))
os.hostname()
os.networkInterfaces()

try {
  const disks = nodeDiskInfo.getDiskInfoSync();
  printResults('SYNC WAY', disks);
} catch (e) {
  console.error(e);
}

function printResults(title, disks) {
 
  console.log(`============ ${title} ==============\n`);

  for (const disk of disks) {
      console.log('Filesystem:', disk.filesystem);
      console.log('Blocks:', disk.blocks);
      console.log('Used:', disk.used);
      console.log('Available:', disk.available);
      console.log('Capacity:', disk.capacity);
      console.log('Mounted:', disk.mounted, '\n');
  }

}