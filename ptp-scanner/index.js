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
var Status;
(function (Status) {
    Status[Status["NONE"] = 0] = "NONE";
    Status[Status["OK"] = 1] = "OK";
    Status[Status["WARN"] = 2] = "WARN";
    Status[Status["ERROR"] = 3] = "ERROR";
})(Status || (Status = {}));
var PtPPacketHeader = /** @class */ (function () {
    function PtPPacketHeader(data) {
        this.valid = true;
        this._data = data;
        this.version = 0x0F & this._data.readInt8(1);
        this.messageType = (0x0F & this._data.readInt8(0));
        if (this._data.length < 34)
            this.valid = false;
        if (this.version != 1 && this.version != 2)
            this.valid = false;
        this.domain = this._data.readInt8(4);
    }
    return PtPPacketHeader;
}());
var makeSize = function (d, n, c) {
    while (d.length < n)
        d = c + d;
    return d;
};
var PtPAnnoncePayload = /** @class */ (function () {
    function PtPAnnoncePayload(data) {
        this._GMID = makeSize(data.readUInt8(20).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(21).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(22).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(23).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(24).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(25).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(26).toString(16), 2, "0") + ":" +
            makeSize(data.readUInt8(27).toString(16), 2, "0");
        this.annonceInterval = Math.pow(2, data.readInt8(33));
    }
    return PtPAnnoncePayload;
}());
var PtpDomain = /** @class */ (function () {
    function PtpDomain(version, number) {
        this._number = number;
        this._version = version;
        this._masterAddress = "";
        this._lastSeenAnnonce = this._lastSeenSync = 0;
        this.status = Status.NONE;
        this.message = "Init...";
        this._annonceInterval = 1;
    }
    PtpDomain.prototype.rcvSync = function (packet, rcvInfo) {
        console.log("Version ", this._version, " - Sync for ", this._number);
        return { error: 0, message: "" };
    };
    PtpDomain.prototype.rcvAnnounce = function (packet, rcvInfo) {
        console.log("Version ", this._version, " - Announce for ", this._number);
        return { error: 0, message: "" };
    };
    PtpDomain.prototype.rcvMessage = function (packet, rcvInfo, port) {
        var suggestedMaster = rcvInfo.address;
        var rcvTime = Date.now();
        switch (packet.messageType) {
            case MessageType.ANNOUNCE:
                var Payload = new PtPAnnoncePayload(packet._data);
                if (this._masterAddress != suggestedMaster) {
                    if (rcvTime - this._lastSeenAnnonce > 3 * this._annonceInterval) {
                        this._masterAddress = suggestedMaster;
                        this._lastSeenAnnonce = rcvTime;
                        this._lastSeenSync = 0;
                        this.status = Status.OK;
                        this.message = "ok";
                        this._GMID = Payload._GMID;
                        this._annonceInterval = Payload.annonceInterval;
                    }
                    else {
                        this.status = Status.ERROR;
                        this.message = "Conflicing master with " + suggestedMaster;
                    }
                }
                else
                    this._lastSeenAnnonce = rcvTime;
                console.log(JSON.stringify(DomainsPerVersion));
                break;
            case MessageType.SYNC:
                if (this._masterAddress != suggestedMaster) {
                    if (rcvTime - this._lastSeenAnnonce > 6000 && this._version == 1) {
                        this._masterAddress = suggestedMaster;
                        this._lastSeenSync = rcvTime;
                        this.status = Status.OK;
                        this.message = "ok";
                    }
                    else {
                        this.status = Status.ERROR;
                        this.message = "Conflicing syncs emitted from " + suggestedMaster;
                    }
                }
                else
                    this._lastSeenSync = rcvTime;
                break;
            default:
                break;
        }
        return { error: 0, message: "" };
    };
    return PtpDomain;
}());
var DomainsPerVersion = {
    1: {},
    2: {}
};
var receivePtp2Packet = function (msg, rcvInfo, port) {
    var pack = new PtPPacketHeader(msg);
    if (!pack.valid) {
        return;
    }
    if (!DomainsPerVersion[pack.version][pack.domain])
        DomainsPerVersion[pack.version][pack.domain] = new PtpDomain(pack.version, pack.domain);
    DomainsPerVersion[pack.version][pack.domain].rcvMessage(pack, rcvInfo, port);
};
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
        receivePtp2Packet(message, rinfo, 319);
    });
});
socket2.bind(PORT + 1);
socket2.on("listening", function () {
    socket2.addMembership(MULTICAST_ADDR);
    var address = socket2.address();
    socket2.on("message", function (message, rinfo) {
        var pack = new PtPPacketHeader(message);
        receivePtp2Packet(message, rinfo, 320);
    });
});
