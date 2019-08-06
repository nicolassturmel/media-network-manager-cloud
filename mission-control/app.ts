
var mdns = require('multicast-dns')()
var arp = require('node-arp');
var os = require('os');
var sock = require('ws');
var http = require('http')
var exp = require('express')
var uniqid = require('uniqid');
var id_local = 0;


// Side connected to other services

var pc_name = os.hostname()
var prename = pc_name.split('.')[0];
var Nodes : any = [{ Type: "null", id : "0"}]
let Hosts : object = {};
let Services : object = {}
let getMacClear = true;

const wss = new sock.Server({ port: 16060 })
wss.on('connection', function connection(ws) {
    console.log("new client connected")
    ws.on('message', function incoming(message) {
        let node = JSON.parse(message)
        let i = Nodes.findIndex(k => k.IP == node.IP);
        if(i == -1) {
            Nodes.push(
                {
                IP: node.IP,
                Type: "Empty"}
            )
            i = Nodes.findIndex(k => k.IP == node.IP);
        }
        mergeNodes(i,node)
        //Nodes.push(JSON.parse(message))
      console.log('received: %s - where ? %s', node, i);
      calculateInterConnect()
    });
   
  });

mdns.on('response', (response) => {
    handleResponse(response)
})

mdns.on('query', (query) => {
    if(query.questions.some(k => k.name == "_missioncontrol._socketio.local")) {

        mdns.respond({
            answers: [{
              name: 'missioncontrol_'+prename+'._missioncontrol._socketio.local',
              type: 'SRV',
              data: {
                port:16060,
                weigth: 0,
                priority: 10,
                target: prename+'.local'
              }
            }]
          })
    }

})

mdns.respond({
    answers: [{
      name: 'missioncontrol_'+prename+'._missioncontrol._socketio.local',
      type: 'SRV',
      data: {
        port:16060,
        weigth: 0,
        priority: 10,
        target: prename+'.local'
      }
    }]
  })

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
                            if (!err) {
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
                mergeNodes(i,Hosts[HostToRefresh])
                console.log(Nodes)
            }
        }
    }
}

function mergeNodes(index,newValue)
{
    if(Nodes[index] == newValue) return
    if(newValue.Type == "switch") {
        console.log("merging switch")
        if(newValue.Schema == 1) {
            Nodes[index].Mac = newValue.Mac
            Nodes[index].Ports = newValue.Ports
            Nodes[index].Multicast = newValue.Multicast
            Nodes[index].id = newValue.id 
            Nodes[index].Type = newValue.Type 
        }
    }
    if(newValue.Type == "MdnsNode") {
        if(newValue.Schema == 1) {
            if(Nodes[index].Type && Nodes[index].Type != "switch") Nodes[index].Type = newValue.Type
            Nodes[index].Services = newValue.Services
            Nodes[index].OtherIPs = newValue.OtherIPs
            Nodes[index].Macs = newValue.Macs 
            Nodes[index].Neighbour = newValue.Neighbour
            Nodes[index].Mac = newValue.Mac
            Nodes[index].id = newValue.id
        }
    }
}

mdns.query({
    questions:[{
      name: '_http._tcp.local',
      type: 'SRV'
    }]
});

function buildServiceHttpLink(obj) {

}

function calculateInterConnect() {
    var linkd = []
    let conns = [];

    // Detecting interconnect
    for(let i in Nodes) {
        if(Nodes[i].Type == "switch") {
            console.log(Nodes[i])
            if(!linkd[i]) linkd[i] = {}
            linkd[i].dataRef = i;
            linkd[i].ports = [];
            conns[i] = []
            for(let j : number =0 ; j < Nodes.length ; j++) {
                console.log("Lookimg for " + Nodes[j].Mac)
                for(let l in Nodes[i].Ports) {
                    if(Nodes[i].Ports[l].ConnectedMacs.some(k => k == Nodes[j].Mac)) {
                        if(!linkd[i].ports[l] ) linkd[i].ports[l] = []
                        if(!linkd[i].ports[l].some(k => k == j)) linkd[i].ports[l].push(j);
                    }
                }
            }
        }
    }
    console.log(linkd)

    console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))

    while(linkd.some(k => k.ports.some(l => l.length > 1))) {
        let cleared = linkd.filter(k => k.ports.some(l => l.length == 1))
        for(let i in linkd) {
            if(!(cleared.some(k => k.dataRef == linkd[i].dataRef ))) {
                for(let p in linkd[i].ports) {
                    if(linkd[i].ports[p] != undefined && linkd[i].ports[p].length > 1) {
                        let keep = null;
                        for(let j of linkd[i].ports[p]) {
                            if(cleared.filter(q => q.dataRef == j).length == 1) keep = j;
                        }
                        if(keep != null) {
                            linkd[i].ports[p] = [keep]
                        }
                    }
                }
            }
        }
    }
   
    // Building connection graph

    console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
}


// User and GUI side

const user_app = exp();

//initialize the WebSocket server instance
const user_wss = new sock.Server({ server: user_app });

user_wss.on('connection', (ws) => {

    //connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {

        //log the received message and send it back to the client
        console.log('received: %s', message);
        ws.send(`Hello, you sent -> ${message}`);
    });

    //send immediatly a feedback to the incoming connection    
    ws.send('Hi there, I am a WebSocket server');
});

//start our server

app.use('/', express.static(__dirname + '/html'));

user_app.listen(8888, () => {
    console.log(`Server started on port 8888 :)`);
});

user_app.get("/rest", (req, res, next) => {
    res.json({"ola chica" : "aie aie aie"})
})
