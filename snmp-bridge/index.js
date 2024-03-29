"use strict";
exports.__esModule = true;
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.201' },
    { name: 'community', alias: 'c', type: String, defaultValue: 'public' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var client = require('../mnms-client-ws-interface');
client.challenge(options.key);
client.setCallback(function (data) { console.log(data); });
client.run(options.missioncontrol);
client.info({
    Info: "SNMP switch client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var SwitchData = {
    oldT: 0
};
var Switch = {
    Name: "SNMP",
    Type: "switch",
    IP: options.ip,
    Schema: 1,
    Ports: [],
    Multicast: "off",
    Neighbour: "",
    Mac: "",
    id: options.id,
    Capabilities : {
        Name: "yes",
        System: "no",
        MacFwdTable: "yes",
        MulticastRoute: "no",
        PortStats: "yes"
    },
    _Timers: [{
        path: "$",
        time: 10
    }]
};

var BW_Data = []

var snmp = require ("net-snmp");

var session = snmp.createSession (options.ip, options.community);

var getNext = (oid) => {
    return new Promise((resolve, reject) => {
        session.getNext ([oid], function (error, varbinds) {
            if (error) {
                console.error (error.toString ());
            } else {
                for (var i = 0; i < varbinds.length; i++) {
                    if (snmp.isVarbindError (varbinds[i]))
                        console.error (snmp.varbindError (varbinds[i]));
                    else
                    {
                        resolve(varbinds[i]);
                    }
                }
            }
        });
    })
}

var justGet = (oid) => {
    return new Promise((resolve, reject) => {
        session.get ([oid], function (error, varbinds) {
            if (error) {
                console.error (error.toString ());
            } else {
                for (var i = 0; i < varbinds.length; i++) {
                    if (snmp.isVarbindError (varbinds[i]))
                        console.error (snmp.varbindError (varbinds[i]));
                    else
                        resolve(varbinds[i]);
                }
            }
        });
    })
}

var compareOIDs = (in_,new_) => {
    if(new_.length < in_.length)
        return false
    if(in_ == new_.substr(0,in_.length))
        return true;
    //console.log(in_," ",in_.length," ",new_.substr(0,in_.length))
    return false
}

var name_oid = "1.3.6.1.2.1.1"
var portsName_oid = "1.3.6.1.2.1.2.2.1.2"
var portsType_oid = "1.3.6.1.2.1.2.2.1.3"
var portsSpeed_oid = "1.3.6.1.2.1.2.2.1.5"
var portsAdmin_oid = "1.3.6.1.2.1.2.2.1.7"
var portsOper_oid = "1.3.6.1.2.1.2.2.1.8"
var portsInb_oid = "1.3.6.1.2.1.2.2.1.10"
var portsInE_oid = "1.3.6.1.2.1.2.2.1.14"
var portsOutb_oid = "1.3.6.1.2.1.2.2.1.16"
var portsOutE_oid = "1.3.6.1.2.1.2.2.1.20"
var fwdmac = "1.3.6.1.2.1.17.4.3.1.2"
var fwdtype = "1.3.6.1.2.1.17.4.3.1.3"
var portindex = "1.3.6.1.2.1.17.1.4.1.2"
var vlansActive = "1.3.6.1.2.1.17.7.1.4.2.1.3"
var vlanUntagged = "1.3.6.1.2.1.17.7.1.4.2.1.5"
var vlanEgress = "1.3.6.1.2.1.17.7.1.4.2.1.4"

async function run(oid) {
}


async function getName() {
    Switch.Name = (await justGet("1.3.6.1.2.1.1.5.0")).value.toString()
}

async function getPorts() {
    let oid = portsType_oid
    let nn = oid
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(e.oid," ",idx[idx.length-1] + " -> " + e.value + " ")
        if(Number(e.value) == 6)
        {
            if(!BW_Data[idx[idx.length-1]])
                BW_Data[idx[idx.length-1]] = {
                    InTime: 0,
                    Inb: 0,
                    OutTime: 0,
                    Outb: 0
                }
            Switch.Ports[idx[idx.length-1]] = {
                Name: "To fill",
                ConnectedMacs: [],
                IGMP: {
                    ForwardAll: "off",
                    Groups: {}
                },
                AdminState: "Up",
                Speed: 0,
                In: 0,
                Out: 0
            }
        }

    }

    oid = portsName_oid
    nn = oid
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Switch.Ports[idx[idx.length-1]])
            Switch.Ports[idx[idx.length-1]].Name = e.value.toString().replace("Gigabit","G").replace("Ethernet","E")

    }
    oid = portsSpeed_oid
    nn = oid

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Switch.Ports[idx[idx.length-1]])
            Switch.Ports[idx[idx.length-1]].Speed = Number(e.value)

    }
    oid = portsOper_oid
    nn = oid

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Number(e.value) != 1 && Switch.Ports[idx[idx.length-1]])
            Switch.Ports[idx[idx.length-1]].Speed = 0

    }
    oid = portsAdmin_oid
    nn = oid

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Switch.Ports[idx[idx.length-1]])
            Switch.Ports[idx[idx.length-1]].AdminState = Number(e.value) != 1 ? "down" : "Up"

    }

    oid = portsInb_oid
    nn = oid

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Switch.Ports[idx[idx.length-1]]) {
            let x = idx[idx.length-1]
            let i = Number(e.value)
            let t = Date.now()
            Switch.Ports[x].In = Number((i - BW_Data[x].Inb + Math.pow(2,32) )%(Math.pow(2,32)))/(t - BW_Data[x].InTime)*8/1000
            Switch.Ports[x].In = Math.floor(Switch.Ports[x].In*10)/10
            BW_Data[x].Inb = i
            BW_Data[x].InTime = t
        }

    }

    oid = portsOutb_oid
    nn = oid

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        //console.log(idx[idx.length-1] + " -> " + e.value + " ")
        if(Switch.Ports[idx[idx.length-1]]) {
            let x = idx[idx.length-1]
            let i = Number(e.value)
            let t = Date.now()
            Switch.Ports[x].Out = Number((i - BW_Data[x].Outb + Math.pow(2,32))%(Math.pow(2,32)))/(t - BW_Data[x].OutTime)*8/1000
            Switch.Ports[x].Out = Math.floor(Switch.Ports[x].Out*10)/10
            BW_Data[x].Outb = i
            BW_Data[x].OutTime = t
            
        }

    }


    /*Switch.Ports = Switch.Ports.filter(function (el) {
        return el != null;
      });*/
    //console.log(Switch)
    //console.log(BW_Data)
    //client.send(JSON.stringify(Switch))
}

var oidToMac = (oid) => {
    let idx = oid.split('.')
    function toHex(id) {
        let N = parseInt(idx[idx.length-id-1]).toString(16)
        if(N.length == 1)
            N = "0" +N
        return N
    }
    return toHex(5) + ":" +toHex(4) + ":" +toHex(3) + ":" +toHex(2) + ":" +toHex(1) + ":" +toHex(0)
}

async function getMacs() {

    let pindex= []
    let oid = portindex
    let nn = oid
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        pindex[idx[idx.length-1]] = Number(e.value)
    }

    //console.log(pindex)

    oid = fwdmac
    nn = oid
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        if(pindex[Number(e.value)] && Switch.Ports[pindex[Number(e.value)]]) {
            Switch.Ports[pindex[Number(e.value)]].ConnectedMacs.push(oidToMac(e.oid))
        }
        nn = e.oid
    }
    oid = fwdtype
    nn = oid
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        if(e.value == 4 ) {
            Switch.Mac = oidToMac(e.oid)
            break;
        }
        if(e.value == 5 && !Switch.Mac ) {
            Switch.Mac = oidToMac(e.oid)
        }
        nn = e.oid
    }
}

async function getVlans() {
    let vlans = [];
    let oid = vlansActive
    let nn = oid
    console.log("getVlans")

    function vlanUBitParse(vlan,buf) {
        for(let i = 0; i < buf.length ; i++) {
            let c = buf.readUInt8(i)
            let p = 8*(i+1)
            while(c > 0) {
                if(c%2 == 1)
                {
                    if(Switch.Ports[p]) {
                        if(!Switch.Ports[p].Vlan) Switch.Ports[p].Vlan = { Tagged: [], Untagged: null}
                        Switch.Ports[p].Vlan.Untagged = vlan
                    }
                    c --
                }
                c=c/2
                p--
            }
        }
    }

    function vlanEBitParse(vlan,buf) {
        for(let i = 0; i < buf.length ; i++) {
            let c = buf.readUInt8(i)
            let p = 8*(i+1)
            while(c > 0) {
                if(c%2 == 1) {
                    if(Switch.Ports[p]) {
                        if(!Switch.Ports[p].Vlan) Switch.Ports[p].Vlan = { Tagged: [], Untagged: null}
                        if(Switch.Ports[p].Vlan.Untagged != vlan) Switch.Ports[p].Vlan.Tagged.push(vlan)
                    }
                    c--
                }
                c=c/2
                p--
            }
        }
    }

    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        vlans[idx[idx.length-1]] = Number(e.value)
    }
    oid = vlanUntagged
    nn = oid
    console.log("-- a")
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        vlanUBitParse(idx[idx.length-1],e.value)
    }
    oid = vlanEgress
    nn = oid
    console.log("-- b")
    while(1) {
        let e = await getNext(nn)
        nn = e.oid
        if(!compareOIDs(oid,nn)) break
        let idx = e.oid.split('.')
        vlanEBitParse(idx[idx.length-1],e.value)
    }
}

async function run() {
 await getName()
 await getPorts()
 await getMacs()
 await getVlans()
 Switch.Ports = Switch.Ports.filter(function (el) {
    return el != null;
  });
  Switch._Timers[0].time = client.getSendInterval()
  console.log(Switch)
 client.send(JSON.stringify(Switch))
 //console.log(Switch)
 console.log("Sent SNMP from " + options.ip)
 Switch.Ports = []
 setTimeout(run, 2000)
}
run()