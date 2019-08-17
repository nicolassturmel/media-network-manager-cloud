
var arp = require('node-arp');
var dns_txt = require('dns-txt')()
var uniqid = require('uniqid');

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
                if (!err && mac.length>12) {
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
            if(comps[1] == "sub" ){
                if(!Services[k.data] ){
                    Services[k.data] = {}
                    Services[k.data].subs = []
                    Services[k.data].txt = null
                }
                if(!Services[k.data].subs.some(p => p === comps[0]) && comps[2] == "http") Services[k.data].subs.push(comps[0])
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


export = (cb,_mdns) => {
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
    setTimeout(() => {
        mdns.query({
            questions:[{
                name: '_http._tcp.local',
                type: 'SRV'
            }]
        });
        mdns.query({
            questions:[{
                name: '_ravenna_stream._sub._rtsp._tcp.local',
                type: 'SRV'
            }]
        });
        mdns.query({
            questions:[{
                name: '_ravenna._sub._http._tcp.local',
                type: 'SRV'
            }]
        });
        mdns.query({
            questions:[{
                name: '_ember._tcp.local',
                type: 'SRV'
            }]
        });
        mdns.query({
            questions:[{
                name: '_csco-sb._tcp.local',
                type: 'SRV'
            }]
        });
        mdns.query({
            questions:[{
                name: '_telnet._tcp.local',
                type: 'SRV'
            }]
        });
    },1000)
}