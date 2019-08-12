
import arp from 'node-arp'
import uniqid from 'uniqid'

let mdns
var Nodes : any = [{ Type: "null", id : "0"}]
let Hosts : object = {};
let Services : object = {}
let getMacClear = true;
let id_local = 0;

let mergeNodes = function(index,newValue,Name) {}

export = (cb,_mdns) => {
        if(_mdns) 
            mdns = _mdns
        else
            mdns = require('multicast-dns')()
        mdns.on('response', (response) => {
            handleResponse(response)
        })
        mergeNodes = cb;
        mdns.query({
            questions:[{
              name: '_http._tcp.local',
              type: 'SRV'
            }]
        });
    }

function handleResponse(response) {
    for(let k of response.answers){
        handleItem(k)
    }
    for(let k of response.additionals){
        handleItem(k)
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
                if(Services[k.name]) {
                    refresh = (subs == Services[k.name])? refresh : true;
                    subs = Services[k.name]
                }
                if(!Hosts[k.data.target].Services[k.name])
                    refresh = true;
                Hosts[k.data.target].Services[k.name] = {
                    port: k.data.port,
                    subs : subs
                }
            }
        }
        else if(k.type == "PTR")
        {
            let comps = k.name.split("._");
            if(comps[1] == "sub" ){
                if(!Services[k.data] ){
                    Services[k.data] = []
                }
                if(!Services[k.data].some(p => p === comps[0]) && comps[2] == "http") Services[k.data].push(comps[0])
            } 
            //console.log(k)
        }
        else if(k.type == "A")
        {
            //console.log(k)
            let getmac = false
            HostToRefresh = k.name
            if(!Hosts[k.name]) {
                Hosts[k.name] = {
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
                waitClearGetMac()
                function waitClearGetMac() {
                    if(!getMacClear) {
                        setTimeout(waitClearGetMac, 100);
                    }
                    else {
                        getMacClear = false;
                        arp.getMAC(k.data, function(err, mac) {
                            if (!err && mac.length>12) {
                                Hosts[k.name].Macs.push(mac);
                                Hosts[k.name].Mac = mac
                            }
                            getMacClear = true
                        });
                    }
                }
            }
        }
        if(refresh) {
            if(HostToRefresh != null) {
                let i = Nodes.findIndex(k => k.IP == Hosts[HostToRefresh].IP);
                if(i == -1) {
                    Nodes.push(
                        {Name: HostToRefresh,
                        IP: Hosts[HostToRefresh].IP,
                        Type: "Empty"}
                    )
                    i = Nodes.findIndex(k => k.Name == HostToRefresh);
                }
                mergeNodes(i,Hosts[HostToRefresh],HostToRefresh)
                //console.log(Nodes)
            }
        }
    }
}