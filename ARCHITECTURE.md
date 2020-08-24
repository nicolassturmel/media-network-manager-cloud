# MNMS Architecure

MNMS describes itself as a cloud. Altough 99% of the time all the service are run on the same mahine, nothing prevents from running MNMS on multiples machines accross a network. All inter service communication is done through the network anyway.

The central point is mission-control, and MNMS Desktop is just a wrapper arround mission control for a "desktop like" experience.

## The micro service pricinple

The idea of MNMS is to have a high nnumber of small, functionnaly limited services. This micro servvices principle gives the following benefits:
- resilience: crashing a micro service should have n impact on the others
- simplicity of dev and maintenace: small code to maintain, easy functionnal target
- distributability: micro services can be scattered on the network, improving resilience
This makes MNMS a perfect candidate for deployment over Docker.

Right now, the only micro services MNMS has fully working are the switch data miners. PTP and RTP analysis micro service are still at dev state.

## The node API (aka: node schema)

In the ```types``` subdir, you will find typescript interface that describe the typical MNMS node.
```typescript
export interface MnMs_node {
    Type: "switch" | "MdnsNode" | "ManualNode" | "disconnected" | "null"; 
    IP: string; // Current IP of the node
    OtherIPs?: string[]; // if node has multiples IPs
    Name?: string; // Name of the node, need to be displayed on UI
    Schema: number;// Schema version
    Ports?: MnMs_node_port[]; // Ports descriptions
    Services?: object; // Services description
    Multicast: boolString; // Is node routing multicast 
    Neighbour: string; // Nodes neighbour
    Mac: string; // Nodes mac address
    Macs?: string[]; // Other mac address if multiples
    id: string; // unic id
    Capabilities?: object; // Capabilities of the node, right now only tells if can route multicast
    UIParams?: UI_parameters; // Added by mission-control
    System?: SystemParams; // System parameters such as CPU, Temp
    _Timers?: node_timers[]; // Refresh timer infos
    seqnum?: number; // Added by mission-control
    Errors?: any; // Work in progress
}
```

Fields marked with ? are optionnal, Name is the only required for testing a node micro service.

## Other services API

There will be others API when stabalized: ARP data, analyser service...

## Central point, the mission control

```mission-control``` is the current central point of the system. Every service has to connect to it, provide a unique id, and authenticate using the challenge (displayed on the webpage).

Once this is done mission control will:
- try to merge nodes, two nodes to be merge have same Mac, IP or Name
- push data from the analyser service to the UI client
- analyse data to deduct topology
- analyse data to deduct error (work in progress)

### Data storage, relauching service on restart

When lauching a service through mission-control, data will be stored and service will be restart when mission-control restart.

## Socket helper: mnms-client-ws-interface

In order to have an esy connection of a service to mission control, I have written an absctraction layer. This allow of focus solely on the Node data building that you can send when ready.

```javascript
const request = require('request')

const SwitchPollTime = 5

const commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

// Command line arguments
const optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge(options.key) // The challemge displayed in MNMS left menu
client.setCallback((data) => {console.log(data)}) //Communication from mission control to the service
client.run(options.missioncontrol) // Start the websocket connect, if no argumwent is given, it will use DNS-SD to find mission-control
client.info({
    Info: "Node client",
    ServiceClass: "Switches",
    id: options.id
})   // Client identification

/*
    build here your node data
    */

// Gets time between send, average and update Node data
Switch._Timers[0].time = client.getSendInterval()
// Send node data, sending in text format
client.send(JSON.stringify(Node))
```

## Thinking about the future

### Using a message broker instead of websockets

Using a message broker allow a much more robust communication between micro services.The single pint of faillure that is mission control can be avoided and service can run by topics, allowing multiple mission controls running in parralel with different levels of system view.

### Redundancy

This obvously a must have, and can be set with or without a message brocker.

For instance: on MNMS on each network or two fully independant MNMS (if configuration is not expected to change)
