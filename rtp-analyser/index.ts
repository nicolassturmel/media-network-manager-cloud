import dgram = require ("dgram");
import process = require  ("process")
const commandLineArgs = require('command-line-args')

import { MnMs_node } from "../types/types"
import { RTPReceiver } from "./rtp"

// Command line arguments
// ----------------------
const optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: "RTP-" + Date.now().toString(32) },
    { name: 'rcvNum', alias: 'n', type: String, defaultValue: 4 },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var _gReceivers = []

// Connecting to MnMs
//-------------------
var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.setCallback((data) => {console.log(data)})
client.run(options.missioncontrol)
client.info({
    Info: "RTP analyser",
    ServiceClass: "Analysers",
    id: options.id
})

enum PacketStatus {
    OK=0,
    RESET,
    WRONG_SSRC,
    WRONG_PAYLOAD,
    OUT_OF_ORDER,
    LATE
}

var extractFromSdp = (SDP) => {
    return {
        maddress : "",
        port: 5004
    }
}
/*
 * Format of received command:
 * {
 *  Action: <string, strat or stop>
 *  ReceiverId: <number, id of receiver to use>
 *  SDP: <sdp object in JSON only when creating>
 * }
 * 
 * 
 * 
 */
var commandReceived = (cmd) => {
    let jCmd = JSON.parse(cmd)
    if(!cmd.Action || !cmd.ReceiverId)
        return
    if(cmd.ReceiverId >= options.rcvNum)
        return
    if(cmd.Action == "start") {
        if(!cmd.SDP)
            return
        let params = extractFromSdp(cmd.SDP)
        _gReceivers[cmd.ReceiverId] = new RTPReceiver(params.maddress,params.port)
    }
    else if(cmd.Action == "stop") {
        _gReceivers[cmd.ReceiverId] = null
    }
    else
        return
}

