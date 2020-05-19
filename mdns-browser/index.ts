
var arp = require('node-arp');
var dns_txt = require('dns-txt')()
var uniqid = require('uniqid');

import { MnMs_node } from "../types/types"


export = (cb,_mdns) => {
    
    let mdns
    let Hosts : object = {};

    var Services : object = {};

    let getMacClear = true;
    let id_local = 0;

    let sendNode = function(Value) {}

    function handleResponse(response) {
        for(let k of response.answers){
            handleItem(k)
        }
        for(let k of response.additionals){
            handleItem(k)
        }

        function waitClearGetMac(k) {
            if(!k)
                return
            if(!getMacClear) {
                setTimeout(() => {waitClearGetMac(k) }, 100);
            }
            else {
                getMacClear = false;
                arp.getMAC(k.data, function(err, mac) {
                    if (!err && mac && mac.length>12) {
                        let macout = []
                        mac.split(":").forEach((e,i,a) => {if(e.length < 2) macout[i] ="0" + e; else macout[i] = e});
                        mac = macout.join(":")
                        Hosts[k.name].Macs.push(mac);
                        Hosts[k.name].Mac = mac
                        sendNode(Hosts[k.name])
                    }
                    getMacClear = true
                });
            }
        }

        function handleItem(k) {
            let refresh = false;
            let HostToRefresh = null
            //if(k.ttl == 0) console.log(k)
            if(k.type == "SRV")
            {
                HostToRefresh = k.data.target;
                if(Hosts[k.data.target]) {
                    if(k.ttl > 0) {
                        let subs = (Hosts[k.data.target].Services[k.name])? Hosts[k.data.target].Services[k.name].subs : [];
                        let txt = (Hosts[k.data.target].Services[k.name])? Hosts[k.data.target].Services[k.name].txt : {}

                        if(Services[k.name]) {
                            refresh = (subs == Services[k.name].subs && txt == Services[k.name].txt)? refresh : true;
                            subs = Services[k.name].subs
                            txt = Services[k.name].txt
                        }
                        if(!Hosts[k.data.target].Services[k.name])
                            refresh = true;
                            Hosts[k.data.target].Services[k.name] = {
                                port: k.data.port,
                                subs : subs,
                                txt: txt
                            }
                    }
                    else {
                        if(Hosts[k.data.target].Services[k.name]){
                            delete Hosts[k.data.target].Services[k.name]
                            refresh = true
                        }
                    }
                }
            }
            else if(k.type == "PTR")
            {
                let comps = k.name.split("._");
                if(k.ttl > 0) {
                    if(comps[1] == "sub" ){
                        if(!Services[k.data] ){
                            Services[k.data] = {}
                            Services[k.data].subs = []
                            Services[k.data].txt = null
                        }
                        if(!Services[k.data].subs.some(p => p === comps[0]) && comps[2] == "http") Services[k.data].subs.push(comps[0])
                    }
                }
                else {
                    if(Services[k.data]) {
                        Object.keys(Hosts).forEach(key => {
                            if(Hosts[key].Services[k.data]) {
                                refresh = true
                                HostToRefresh = key
                                delete Hosts[key].Services[k.data]
                            }
                        })

                        delete Services[k.data]

                    }  
                } 
                //console.log(k)
            }
            else if(k.type == "TXT")
            {
                if(!Services[k.name] ){
                    Services[k.name] = {}
                    Services[k.name].subs = []
                    Services[k.name].txt = null
                }
                if(k.data.length > 0) {
                    let str = Buffer.allocUnsafe(0);
                    for(let s of k.data) {
                        let size = Buffer.allocUnsafe(1)
                        size.writeUInt8(s.length , 0);
                        str = Buffer.concat([str, size],str.length + size.length)
                        str = Buffer.concat([str, s],str.length + s.length)
                    }
                    Services[k.name].txt = dns_txt.decode(str)
                }
            }
            else if(k.type == "A")
            {
                //console.log(k)
                let getmac = false
                HostToRefresh = k.name
                if(k.ttl > 0) {
                    if(!Hosts[k.name] || Hosts[k.name].Type == "disconnected") {
                        Hosts[k.name] = {
                            Name: k.name,
                            IP: k.data,
                            Type: "MdnsNode",
                            Services: {},
                            OtherIPs: [],
                            Macs: [],
                            Schema: 1,
                            Neighbour: "",
                            Mac: "", 
                            id: uniqid() + id_local++
                        }
                        getmac = true
                    } 
                    else if(Hosts[k.name].IP != k.data) {
                        if(!Hosts[k.name].OtherIPs.some(p => p == k.data)) {
                            Hosts[k.name].OtherIPs.push(Hosts[k.name].IP)
                            Hosts[k.name].IP = k.data
                            getmac = true
                        }
                    }   

                    if(getmac) {
                        waitClearGetMac(k)
                    }
                }
                else {
                    console.log("ttl 0")
                    if(Hosts[k.name]) {
                        Hosts[k.name].Type == "disconnected"
                        refresh = true
                    }
                }
            }
            if(refresh) {
                if(HostToRefresh != null) {
                    sendNode(Hosts[HostToRefresh])
                    //console.log(Nodes)
                }
            }
        }
    }

    if(!cb) {
        console.log("Error, empty callback given")
        return
    }
    if(_mdns) {
        mdns = _mdns
    } else {
        mdns = require('multicast-dns')()
    }
    mdns.on('response', (response) => {
        handleResponse(response)
    })
    sendNode = cb;
    let servToScan = {
        serv: "_csco-sb._tcp.local",
        next: {
            serv: '_telnet._tcp.local',
            next : {
                serv: '_rtsp._tcp.local',
                next: {
                    serv : '_http._tcp.local',
                    next: {
                        serv : '_csco-sb._tcp.local',
                        next: {
                            serv : '_ravenna._sub._http._tcp.local',
                            next: {
                                serv : '_ravenna_session._sub._rtsp._tcp.local',
                                next: {
                                    serv : '_netaudio-arc._udp.local'
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    setTimeout(() => {
        console.log("Scanning services")
        let qq = (stq) => {
            console.log(stq.serv)
            mdns.query({questions: [{name: stq.serv, type: 'PTR'}]})
            if(stq.next) {
                setTimeout(qq,1000,stq.next)
            }
        }

        qq(servToScan)
    },1000)
    setTimeout(() => {
        console.log("Scanning services")
        let qq = (stq) => {
            console.log(stq.serv)
            mdns.query({questions: [{name: stq.serv, type: 'PTR'}]})
            if(stq.next) {
                setTimeout(qq,1000,stq.next)
            }
        }

        qq(servToScan)
    },30000)
}