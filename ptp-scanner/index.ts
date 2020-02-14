import dgram = require ("dgram");
import process = require  ("process")

enum MessageType{
	SYNC=0x0,
	DELAY_REQ,
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

class PtpDomain {
    _number: number;
    _version: number;
    _masterAddress: string;
    _lastSeenAnnonce: number;
    _lastSeenSync: number;
    status: number;
    message: string

    constructor(version,number) {
        this._number = number;
        this._version = version
        this._masterAddress = ""
        this._lastSeenAnnonce = this._lastSeenSync = 0
        this.status = Status.NONE
        this.message = "Init..."
    }

    rcvSync(packet, rcvInfo) : object {
        console.log("Version ",this._version," - Sync for ",this._number)
        return {error: 0, message: ""}
    }
    rcvAnnounce(packet, rcvInfo) : object {
        console.log("Version ",this._version," - Announce for ",this._number)
        return {error: 0, message: ""}
    }
    rcvMessage(packet : PtPPacketHeader, rcvInfo, port) : object {
        let suggestedMaster = rcvInfo.address
        let rcvTime = Date.now()
        switch (packet.messageType) {
            case MessageType.ANNOUNCE:
                //this.rcvAnnounce(packet,rcvInfo)
                if(this._masterAddress != suggestedMaster) {
                    if(rcvTime - this._lastSeenAnnonce > 6000) {
                        this._masterAddress = suggestedMaster
                        this._lastSeenAnnonce = rcvTime
                        this._lastSeenSync = 0
                        this.status = Status.OK
                        this.message = "ok"
                    }
                    else {
                        this.status = Status.ERROR
                        this.message = "Conflicing master with " + suggestedMaster
                    }
                }
                console.log(JSON.stringify(DomainsPerVersion))
                break
            case MessageType.SYNC:
                //this.rcvSync(packet,rcvInfo)
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

socket.bind(PORT);

socket.on("listening", function() {
    socket.addMembership(MULTICAST_ADDR);
    const address = socket.address();
    socket.on("message", function(message, rinfo) {
        let pack = new PtPPacketHeader(message)
        receivePtp2Packet(message,rinfo,319)
      });
  });
  
socket2.bind(PORT+1);

socket2.on("listening", function() {
    socket2.addMembership(MULTICAST_ADDR);
    const address = socket2.address();
    socket2.on("message", function(message, rinfo) {
        let pack = new PtPPacketHeader(message)
        receivePtp2Packet(message,rinfo,320)
      });
  });