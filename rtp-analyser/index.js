"use strict";
exports.__esModule = true;
var commandLineArgs = require('command-line-args');
var rtp_1 = require("./rtp");
// Command line arguments
// ----------------------
var optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: "RTP-" + Date.now().toString(32) },
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
var PacketStatus;
(function (PacketStatus) {
    PacketStatus[PacketStatus["OK"] = 0] = "OK";
    PacketStatus[PacketStatus["RESET"] = 1] = "RESET";
    PacketStatus[PacketStatus["WRONG_SSRC"] = 2] = "WRONG_SSRC";
    PacketStatus[PacketStatus["WRONG_PAYLOAD"] = 3] = "WRONG_PAYLOAD";
    PacketStatus[PacketStatus["OUT_OF_ORDER"] = 4] = "OUT_OF_ORDER";
    PacketStatus[PacketStatus["LATE"] = 5] = "LATE";
})(PacketStatus || (PacketStatus = {}));
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
        _gReceivers[cmd.ReceiverId] = new rtp_1.RTPReceiver(params.maddress, params.port);
    }
    else if (cmd.Action == "stop") {
        _gReceivers[cmd.ReceiverId] = null;
    }
    else
        return;
};
