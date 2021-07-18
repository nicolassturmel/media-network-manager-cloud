var Collector = require('node-sflow');
var Ethernet = require('ethernet')
var IpHeader = require('ip-header');
var pcap = require('pcap')

console.log(Ethernet.default)

let masterList = []
let countersList = []

setInterval(() => {
    console.log('------')
    masterList.forEach(e => console.log(e.source + ':' + e.sid + '   ' + e.sip + ':' + e.sport + "-"+ e.proto+"->" + e.dip + ':' + e.dport + '     ' + e.seen))
   // Object.keys(countersList).forEach(e => console.log(countersList[e]))
}, 2000);

var processCounters = (flow,n) => {
    let Switch = flow.rinfo.address
    if(!countersList[Switch]) {
        countersList[Switch] = {
            lastSeenMS: flow.header.uptimeMS,
            ports: []
        }
    }
    let port = n.ifIndex
    if(!countersList[Switch].ports[port]) {
        countersList[Switch].ports[port] = {}
        countersList[Switch].ports[port].inBW = 0
        countersList[Switch].ports[port].outBW = 0
    } 
    else {
        countersList[Switch].ports[port].inBW = (n.ifInOctets - countersList[Switch].ports[port].inOctets)/(flow.header.uptimeMS - countersList[Switch].ports[port].lastSeen)
        countersList[Switch].ports[port].outBW = (n.ifOutOctets - countersList[Switch].ports[port].outOctets)/(flow.header.uptimeMS - countersList[Switch].ports[port].lastSeen)
    }
    countersList[Switch].ports[port] = {
        statusAdmin: n.ifStatusAdmin,
        statusOper: n.ifStatusOper,
        inOctets: n.ifInOctets,
        inBW: countersList[Switch].ports[port].inBW,
        inErrors: n.ifInErrors,
        inDiscards: n.ifInDiscards,
        outOctets: n.ifOutOctets,
        outBW: countersList[Switch].ports[port].outBW,
        outErrors: n.ifOutErrors,
        outDiscards: n.ifOutDiscards,
        lastSeen: flow.header.uptimeMS
    }
}

var processPkt = (flow,pkt) => {
    if(flow && flow.flow && flow.rinfo 
    && pkt && pkt.payload && pkt.payload.payload) {
        let source = flow.rinfo.address
        let ipSource = pkt.payload.payload.saddr.addr.join('.')
        let ipDst = pkt.payload.payload.daddr.addr.join('.')
        let proto = pkt.payload.payload.protocol
        let protoport = { source: -1, destination: -1}
        let sid = flow.flow.sourceIdIndex
        if(proto == 17 || proto == 6) {
            protoport = {
                source: pkt.payload.payload.payload.sport,
                destination: pkt.payload.payload.payload.dport
            }
        } 
        let lineIndex = masterList.findIndex(e => e.source == source
                            && e.sid == sid
                            && e.sip == ipSource
                            && e.dip == ipDst
                            && e.proto == proto
                            && e.sport == protoport.source
                            && e.dport == protoport.destination)
        if(lineIndex >= 0) {
            masterList[lineIndex].lastSeen = Date.now()
            masterList[lineIndex].seen++
        }
        else {
            masterList.push({
                source: source,
                sid: sid,
                sip: ipSource,
                dip: ipDst,
                proto: proto,
                sport: protoport.source,
                dport: protoport.destination,
                lastSeen: Date.now(),
                seen:1
            })
        }
    }
}

Collector(function(flow) {
    //console.log(masterList)
    if(flow && flow.flow && flow.flow.counters) {
        flow.flow.counters.forEach( n => {
            if(n.format == 1) processCounters(flow,n)
        })
    }
    if (flow && flow.flow.records && flow.flow.records.length>0) {
        flow.flow.records.forEach(function(n) {
            if (n.type == 'raw') {
                if (n.protocolText == 'ethernet') {
                    try {
                            let eth = Ethernet.default(n.header)
                            let ip = 0
                            let lenStr = n.header.length.toString(16)
                            while(lenStr.length < 8) lenStr = '0' + lenStr
                            //console.log(lenStr)
                            let head = '00000000000000000' + lenStr + lenStr
                            //console.log(flow.flow)
                            let pkt = pcap.decode.packet({
                                link_type:"LINKTYPE_ETHERNET",
                                header:Buffer.from(head,'hex'),
                                buf:n.header
                                })
                            //console.log(pkt,pkt.payload.payload)
                            processPkt(flow,pkt)
                         } catch(e) { console.log(e); }
                }
            }
        });
    }
}).listen(3000);