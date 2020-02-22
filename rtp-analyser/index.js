"use strict";
exports.__esModule = true;
var dgram = require("dgram");
var commandLineArgs = require('command-line-args');
// Command line arguments
// ----------------------
var optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: "PTP-" + Date.now().toString(32) },
    { name: 'rcvNum', alias: 'n', type: String, defaultValue: 4 },
    { name: "missioncontrol", alias: "m", type: String }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var _gReceivers = [];
var RESET_INTERVAL = 512;
// Connecting to MnMs
//-------------------
var client = require('../mnms-client-ws-interface');
client.challenge(options.key);
client.setCallback(function (data) { console.log(data); });
client.run(options.missioncontrol);
client.info({
    Info: "RTP analyser",
    ServiceClass: "Analysers",
    id: options.id
});
var PacketStatus;
(function (PacketStatus) {
    PacketStatus[PacketStatus["OK"] = 0] = "OK";
    PacketStatus[PacketStatus["RESET"] = 1] = "RESET";
    PacketStatus[PacketStatus["WRONG_SSRC"] = 2] = "WRONG_SSRC";
    PacketStatus[PacketStatus["WRONG_PAYLOAD"] = 3] = "WRONG_PAYLOAD";
    PacketStatus[PacketStatus["OUT_OF_ORDER"] = 4] = "OUT_OF_ORDER";
    PacketStatus[PacketStatus["LATE"] = 5] = "LATE";
})(PacketStatus || (PacketStatus = {}));
var RTPReceiver = /** @class */ (function () {
    function RTPReceiver(maddress, port) {
        this._maddress = maddress;
        this._port = port;
        this.SSRC = -1;
        var socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        socket.bind(port);
        socket.on("listening", function () {
            var socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
            socket.addMembership(maddress);
            var address = socket.address();
            socket.on("message", function (message, rinfo) {
                // Analysing packet
            });
        });
    }
    RTPReceiver.prototype.reset = function () {
        this.SSRC = -1;
    };
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
    RTPReceiver.prototype.newPacket = function (data) {
        if (this.SSRC == -1) {
            this.SSRC = data.SSRC;
            this.lastSeenSeq = data.Seqnum;
            this.lastSeenTS = data.TS;
            this.lastRcvTime = data.RcvTime;
            return 1;
        }
        else {
            if (this.SSRC != data.SSRC) {
                console.log("Seen wrong SSRC");
                return 2;
            }
            if (this.expectedPayloadType != data.payloadType) {
                console.log("Wrong payload type");
                return 3;
            }
            var nextSeq = (this.lastSeenSeq + 1) % 65535;
            if (nextSeq == data.Seqnum) {
                // All ok
                var interval = data.RcvTime - this.lastRcvTime;
                this.lastRcvTime = data.RcvTime;
                if (interval > this.maxInterval)
                    this.maxInterval = interval;
                this.lastSeenTS = data.TS;
                this.lastSeenSeq = nextSeq;
                return 0;
            }
            if (data.Seqnum > nextSeq) {
                if (data.Seqnum - nextSeq > RESET_INTERVAL) {
                    console.log("Too many dropped packets, reseting");
                    this.reset();
                    return this.newPacket(data);
                }
                console.log("Out of order packet");
                this.lastRcvTime = data.RcvTime;
                this.lastSeenTS = data.TS;
                this.lastSeenSeq = data.Seqnum;
                return 4;
            }
            if (data.Seqnum < nextSeq) {
                console.log("Late packet");
                return 5;
            }
        }
    };
    return RTPReceiver;
}());
var extractFromSdp = function (SDP) {
    return {
        maddress: "",
        port: 5004
    };
};
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
var commandReceived = function (cmd) {
    var jCmd = JSON.parse(cmd);
    if (!cmd.Action || !cmd.ReceiverId)
        return;
    if (cmd.ReceiverId >= options.rcvNum)
        return;
    if (cmd.Action == "start") {
        if (!cmd.SDP)
            return;
        var params = extractFromSdp(cmd.SDP);
        _gReceivers[cmd.ReceiverId] = new RTPReceiver(params.maddress, params.port);
    }
    else if (cmd.Action == "stop") {
        _gReceivers[cmd.ReceiverId] = null;
    }
    else
        return;
};
