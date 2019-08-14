
var arp = require('node-arp');
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
            //console.log(k)
            HostToRefresh = k.data.target;
            if(Hosts[k.data.target]) {
                
                let subs = (Hosts[k.data.target].Services[k.name])? Hosts[k.data.target].Services[k.name].subs : [];
                let txt = (Hosts[k.data.target].Services[k.name])? Hosts[k.data.target].Services[k.name].txt : [];

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
            Services[k.name].txt = k.data
        }
        else if(k.type == "A")
        {
            //console.log(k)
            let getmac = false
            HostToRefresh = k.name
            if(!Hosts[k.name]) {
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
    mdns.query({
        questions:[{
            name: '_http._tcp.local',
            type: 'SRV'
        }]
    });
}