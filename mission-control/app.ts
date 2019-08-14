
var mdns = require('multicast-dns')()
var arp = require('node-arp');
var os = require('os');
var sock = require('ws');
var http = require('http')
var exp = require('express')
var uniqid = require('uniqid');
var mdnsBrowser = require('../mdns-browser')
var id_local = 0;


// Side connected to other services
//---------------------------------

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
        mergeNodes(i,node,"")
      calculateInterConnect()
    });
   
  });


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

  var mdnsBrowser_cb = (node) => {
    if(node.Name != null) {
        let i = Nodes.findIndex(k => k.IP == node.IP);
        if(i == -1) {
            Nodes.push(
                {Name: node.Name,
                IP: node.IP,
                Type: "Empty"}
            )
            i = Nodes.findIndex(k => k.Name == node.Name);
        }
        mergeNodes(i,node,node.Name)
        console.log(node)
    }
  }

  let mdB = mdnsBrowser(mdnsBrowser_cb,mdns)

function mergeNodes(index,newValue,Name: String)
{
    if(Nodes[index] == newValue) return
    if(newValue.Type == "switch") {
        if(newValue.Schema == 1) {
            Nodes[index].Mac = newValue.Mac
            if(Nodes[index].Ports && Nodes[index].Ports.length != newValue.Ports.length) Nodes[index].Ports = []
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
            Nodes[index].Name = Name 
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
        if(Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
            if(!linkd[i]) linkd[i] = {}
            linkd[i].dataRef = i;
            linkd[i].ports = [];
            conns[i] = []
            for(let j : number =0 ; j < Nodes.length ; j++) {
                if(Nodes[j].Type == "switch" && Nodes[j].Ports.length > 0) {
                    console.log("Lookimg for " + Nodes[j].Mac)
                    for(let l in Nodes[i].Ports) {
                        if(Nodes[j].Macs && Nodes[i].Ports[l].ConnectedMacs.some(k => Nodes[j].Macs.some(l => l === k))) {
                            if(!linkd[i].ports[l] ) linkd[i].ports[l] = []
                            if(!linkd[i].ports[l].some(k => k == j)) linkd[i].ports[l].push(j);
                        }
                    }
                }
            }
        }
    }
    console.log(linkd)

    console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))

    let old_cleared = null;
    while(linkd.some(k => k.ports.some(l => l.length > 1))) {
        let cleared = linkd.filter(k => k.ports.some(l => l.length == 1))
        if(cleared == old_cleared) break;
        old_cleared = cleared
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
    for(let i in Nodes) {
        if(Nodes[i].Mac) console.log(Nodes[i].Mac)
        if(Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
            let connlist = linkd.filter(k => k.dataRef == i)[0];
            console.log(connlist)
            for(let p in Nodes[i].Ports) {
                if(connlist.ports[p]) {
                    Nodes[i].Ports[p].Neighbour=Nodes[connlist.ports[p][0]].IP
                }
                else if(Nodes[i].Ports[p].ConnectedMacs.length == 1){
                    let d = Nodes.filter(k => k.Macs && k.Macs.some(l => l === Nodes[i].Ports[p].ConnectedMacs[0]))
                    console.log("size 1 : " + Nodes[i].Ports[p].ConnectedMacs[0] + " : d size " + d.length + " N->" + Nodes[i].Ports[p].Neighbour)
                    if(d.length >= 1)
                        Nodes[i].Ports[p].Neighbour=d[0].IP
                }
                console.log(Nodes[i].Ports[p].Neighbour)
            }
        }
    }

    console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
}


// User and GUI side
//------------------

const user_app = exp();

//initialize the WebSocket server instance
const user_wss = new sock.Server({ port: 8889 });

user_wss.on('connection', (ws) => {

    //connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {
        ws.send(JSON.stringify(Nodes));
    });

    //send immediatly a feedback to the incoming connection    
    ws.send(JSON.stringify(Nodes))
});



//start our server

user_app.use('/', exp.static(__dirname + '/html'));

user_app.listen(8888, () => {
    console.log(`Server started on port 8888 :)`);
});

user_app.get("/rest", (req, res, next) => {
    res.json({"ola chica" : "aie aie aie"})
})
