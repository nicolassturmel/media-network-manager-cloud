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
var RTPReceiver = /** @class */ (function () {
    function RTPReceiver(maddress, port) {
        this._maddress = maddress;
        this._port = port;
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
