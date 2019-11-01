"use strict";
exports.__esModule = true;
var dgram = require("dgram");
var MessageType;
(function (MessageType) {
    MessageType[MessageType["SYNC"] = 0] = "SYNC";
    MessageType[MessageType["DELAY_REQ"] = 1] = "DELAY_REQ";
    MessageType[MessageType["PDELAY_REQ"] = 2] = "PDELAY_REQ";
    MessageType[MessageType["PDELAY_RESP"] = 3] = "PDELAY_RESP";
    MessageType[MessageType["FOLLOW_UP"] = 8] = "FOLLOW_UP";
    MessageType[MessageType["DELAY_RESP"] = 9] = "DELAY_RESP";
    MessageType[MessageType["PDELAY_RESP_FOLLOW_UP"] = 10] = "PDELAY_RESP_FOLLOW_UP";
    MessageType[MessageType["ANNOUNCE"] = 11] = "ANNOUNCE";
    MessageType[MessageType["SIGNALING"] = 12] = "SIGNALING";
    MessageType[MessageType["MANAGEMENT"] = 13] = "MANAGEMENT";
    /* marker only */
    MessageType[MessageType["PTP_MAX_MESSAGE"] = 14] = "PTP_MAX_MESSAGE";
})(MessageType || (MessageType = {}));
;
var PtPPacketHeader = /** @class */ (function () {
    function PtPPacketHeader(data) {
        this._data = data;
    }
    PtPPacketHeader.prototype.version = function () {
        return 0x0F & this._data.readInt8(1);
    };
    PtPPacketHeader.prototype.messageType = function () {
        return (0x0F & this._data.readInt8(0));
    };
    PtPPacketHeader.prototype.domain = function () {
        if (this._data.length < 34)
            return -1;
        return this._data.readInt8(4);
    };
    return PtPPacketHeader;
}());
var PtpDomain = /** @class */ (function () {
    function PtpDomain(number) {
        this._number = number;
    }
    PtpDomain.prototype.rcvSync = function (message) {
        return { error: 0, message: "" };
    };
    PtpDomain.prototype.rcvAnnounce = function (message) {
        return { error: 0, message: "" };
    };
    return PtpDomain;
}());
var socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
var socket2 = dgram.createSocket({ type: "udp4", reuseAddr: true });
var PORT = 319;
var MULTICAST_ADDR = "224.0.1.129";
socket.bind(PORT);
socket.on("listening", function () {
    socket.addMembership(MULTICAST_ADDR);
    var address = socket.address();
    socket.on("message", function (message, rinfo) {
        var pack = new PtPPacketHeader(message);
        if (pack.messageType() == MessageType.SYNC) {
            console.info("Sync from: " + rinfo.address + ":" + rinfo.port + ", domain " + pack.domain() + " for version " + pack.version());
        }
    });
});
socket2.bind(PORT + 1);
socket2.on("listening", function () {
    socket2.addMembership(MULTICAST_ADDR);
    var address = socket2.address();
    socket2.on("message", function (message, rinfo) {
        var pack = new PtPPacketHeader(message);
        if (pack.messageType() == MessageType.ANNOUNCE) {
            console.info("Annouce from: " + rinfo.address + ":" + rinfo.port + ", domain " + pack.domain() + " for version " + pack.version());
        }
        if (pack.messageType() == MessageType.SYNC) {
            console.info("Sync from: " + rinfo.address + ":" + rinfo.port + ", domain " + pack.domain() + " for version " + pack.version());
        }
    });
});
