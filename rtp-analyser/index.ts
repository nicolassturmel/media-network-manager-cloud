import dgram = require ("dgram");
import process = require  ("process")
const commandLineArgs = require('command-line-args')

import { MnMs_node } from "../types/types"

// Command line arguments
// ----------------------
const optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: "PTP-" + Date.now().toString(32) },
    { name: 'rcvNum', alias: 'n', type: String, defaultValue: 4 },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

var _gReceivers = []
var RESET_INTERVAL = 512

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

class RTPReceiver {
    _socket : any
    _port: number
    _maddress: string
    SSRC: number
    lastSeenSeq: number
    expectedPayloadType: number
    lastSeenTS: number
    lastRcvTime: number
    maxInterval: number

    constructor(maddress,port) {
        this._maddress = maddress
        this._port = port
        this.SSRC = -1

        const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

        socket.bind(port);

        socket.on("listening", function() {
            const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
            socket.addMembership(maddress);
            const address = socket.address();
            socket.on("message", function(message, rinfo) {
                // Analysing packet
            });
        });
    }

    reset() {
        this.SSRC = -1
    }

    
    /*
    * Data is
    * {
    *  SSRC
    *  Seqnum
    *  TS
    *  RcvTime
    *  payloadType
    * }
    */
    newPacket(data) {
        if(this.SSRC == -1) {
            this.SSRC = data.SSRC
            this.lastSeenSeq  = data.Seqnum
            this.lastSeenTS = data.TS
            this.lastRcvTime = data.RcvTime
            return 1
        }
        else {
            if(this.SSRC != data.SSRC) {
                console.log("Seen wrong SSRC")
                return 2
            }
            if(this.expectedPayloadType != data.payloadType) {
                console.log("Wrong payload type")
                return 3
            }
            let nextSeq = (this.lastSeenSeq + 1) % 65535
            if(nextSeq == data.Seqnum) {
                // All ok
                let interval = data.RcvTime - this.lastRcvTime
                this.lastRcvTime = data.RcvTime
                if(interval > this.maxInterval) this.maxInterval = interval
                this.lastSeenTS = data.TS
                this.lastSeenSeq = nextSeq
                return 0
            }
            if(data.Seqnum > nextSeq) {
                if(data.Seqnum - nextSeq > RESET_INTERVAL) {
                    console.log("Too many dropped packets, reseting")
                    this.reset()
                    return this.newPacket(data)
                }
                console.log("Out of order packet")
                this.lastRcvTime = data.RcvTime
                this.lastSeenTS = data.TS
                this.lastSeenSeq = data.Seqnum
                return 4
            }
            if(data.Seqnum < nextSeq) {
                console.log("Late packet")
                return 5
            }
        }
    }
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

