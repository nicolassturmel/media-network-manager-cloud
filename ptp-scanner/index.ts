import dgram = require ("dgram");
import process = require  ("process")
const commandLineArgs = require('command-line-args')

import { MnMs_node } from "../types/types"

// Command line arguments
// ----------------------
const optionDefinitions = [
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: "PTP-" + Date.now().toString(32) },
    { name: "missioncontrol", alias: "m", type: String}
  ]

const options = commandLineArgs(optionDefinitions)
console.log(options)

// Connecting to MnMs
//-------------------
var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.setCallback((data) => {console.log(data)})
//client.run(options.missioncontrol)
client.info({
    Info: "PTP scannner",
    ServiceClass: "Analysers",
    id: options.id
})

// PTP Code
//---------

enum MessageType{
	SYNC=0x0,
	DELAY_REQ=0x1,
	PDELAY_REQ,
	PDELAY_RESP,
	FOLLOW_UP=0x8,
	DELAY_RESP,
	PDELAY_RESP_FOLLOW_UP,
	ANNOUNCE,
	SIGNALING,
	MANAGEMENT,
	/* marker only */
	PTP_MAX_MESSAGE
};

enum Status {
    NONE=0x0,
    OK,
    WARN,
    ERROR
}

class PtPPacketHeader {
    _data: any;
    version: number
    messageType: number
    domain: number
    valid: boolean

    constructor(data) {
        this.valid = true
        this._data = data;
        this.version = 0x0F & this._data.readInt8(1)
        this.messageType = (0x0F & this._data.readInt8(0))
        if(this._data.length < 34) this.valid = false;
        if(this.version != 1 && this.version != 2) this.valid = false
        this.domain = this._data.readInt8(4)
    }
}

var makeSize = (d,n,c) => {
    while(d.length < n)
        d = c + d
    return d
}
class PtPAnnoncePayload {
    _GMID: string;
    annonceInterval: number
    
    constructor(data) {
        this._GMID = makeSize(data.readUInt8(20).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(21).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(22).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(23).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(24).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(25).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(26).toString(16),2,"0") + ":" +
                makeSize(data.readUInt8(27).toString(16),2,"0") 
        this.annonceInterval = Math.pow(2,data.readInt8(33))
    }
}

class PtpDomain {
    _number: number;
    _version: number;
    _masterAddress: string;
    _lastSeenAnnonce: number;
    _lastSeenSync: number;
    _annonceInterval: number
    _GMID: string
    status: number;
    message: string

    constructor(version,number) {
        this._number = number;
        this._version = version
        this._masterAddress = ""
        this._lastSeenAnnonce = this._lastSeenSync = 0
        this.status = Status.NONE
        this.message = "Init..."
        this._annonceInterval = 1
    }

    rcvSync(packet, rcvInfo) : object {
        console.log("Version ",this._version," - Sync for ",this._number)
        return {error: 0, message: ""}
    }
    rcvAnnounce(packet, rcvInfo) : object {
        console.log("Version ",this._version," - Announce for ",this._number)
        return {error: 0, message: ""}
    }
    rcvDelayReq(packet, rcvinfo) {
        console.log("Delay Req for domain " + this._number + " from " + rcvinfo.address)
    }
    rcvMessage(packet : PtPPacketHeader, rcvInfo, port) : object {
        let suggestedMaster = rcvInfo.address
        let rcvTime = Date.now()
        switch (packet.messageType) {
            case MessageType.DELAY_REQ:
                this.rcvDelayReq(packet,rcvInfo)
                break
            case MessageType.ANNOUNCE:
                let Payload = new PtPAnnoncePayload(packet._data)
                if(this._masterAddress != suggestedMaster) {
                    if(rcvTime - this._lastSeenAnnonce > 3*this._annonceInterval) {
                        this._masterAddress = suggestedMaster
                        this._lastSeenAnnonce = rcvTime
                        this._lastSeenSync = 0
                        this.status = Status.OK
                        this.message = "ok"
                        this._GMID = Payload._GMID
                        this._annonceInterval = Payload.annonceInterval
                    }
                    else {
                        this.status = Status.ERROR
                        this.message = "Conflicing master with " + suggestedMaster
                    }
                }
                else
                    this._lastSeenAnnonce = rcvTime
                console.log(JSON.stringify(DomainsPerVersion))
                client.send(JSON.stringify(DomainsPerVersion))
                break
            case MessageType.SYNC:
                if(this._masterAddress != suggestedMaster) {
                    if(rcvTime - this._lastSeenAnnonce > 6000 && this._version == 1) {
                        this._masterAddress = suggestedMaster
                        this._lastSeenSync = rcvTime
                        this.status = Status.OK
                        this.message = "ok"
                    }
                    else {
                        this.status = Status.ERROR
                        this.message = "Conflicing syncs emitted from " + suggestedMaster
                    }
                }
                else
                    this._lastSeenSync = rcvTime
                break
            default:
                break
        }
        return {error: 0, message: ""}
    }
}

var DomainsPerVersion = {
    1 : {},
    2 : {}
}

var receivePtp2Packet = (msg,rcvInfo,port) => {
    let pack = new PtPPacketHeader(msg)
    if(!pack.valid) {
        return;
    }
    if(!DomainsPerVersion[pack.version][pack.domain])
        DomainsPerVersion[pack.version][pack.domain] = new PtpDomain(pack.version,pack.domain)
    DomainsPerVersion[pack.version][pack.domain].rcvMessage(pack,rcvInfo,port)
}

const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
const socket2 = dgram.createSocket({ type: "udp4", reuseAddr: true });
const PORT = 319;
const MULTICAST_ADDR = "224.0.1.129";

 
socket.on("message", function(message, rinfo) {
    //let pack = new PtPPacketHeader(message)
    console.log("message")
    receivePtp2Packet(message,rinfo,320)
});

socket.on("listening", function() {
    socket.addMembership(MULTICAST_ADDR,"192.168.201.3");
    const address = socket.address();
    console.log("Ready to receive")
    console.log(`server listening ${address.address}:${address.port}`);
  });
socket.bind(PORT,"192.168.201.3")
  
socket2.on("message", function(message, rinfo) {
    //let pack = new PtPPacketHeader(message)
    console.log("message")
    receivePtp2Packet(message,rinfo,320)
});

socket2.on("listening", function() {
    socket2.addMembership(MULTICAST_ADDR,"192.168.201.3");
    const address = socket2.address();
    console.log("Ready to receive")
    console.log(`server listening ${address.address}:${address.port}`);
  });
socket2.bind(PORT+1,"192.168.201.3")


  console.log("started")