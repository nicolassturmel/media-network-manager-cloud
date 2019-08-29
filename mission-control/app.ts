
var mdns = require('multicast-dns')()
var os = require('os');
var sock = require('ws');
var http = require('http')
var exp = require('express')
var mdnsBrowser = require('../mdns-browser')
var fs = require('fs');
var _ = require('lodash');
const sdpgetter = require("../rtsp-sdp-query")
const { spawn } = require('child_process');


// Options and exports
//--------------------------------

var Options = {
    database: "data.db",
    services_port: 16060,
    clients_port: 8888,
    launch_services: null,
    launch_options: {},
    client_cb: null
}

export = function(LocalOptions) {

    if(!LocalOptions) LocalOptions = {}
    if(LocalOptions.database) Options.database = LocalOptions.database
    if(LocalOptions.services_port) Options.services_port = LocalOptions.services_port
    if(LocalOptions.clients_port) Options.clients_port = LocalOptions.clients_port
    if(LocalOptions.launch_services) Options.launch_services = LocalOptions.launch_services
    if(LocalOptions.launch_options) Options.launch_options = LocalOptions.launch_options
    if(LocalOptions.client_cb) Options.client_cb = LocalOptions.client_cb


    // Side connected to other services
    //---------------------------------

    var pc_name = os.hostname()
    var prename = pc_name.split('.')[0];
    var Nodes : any = [{ Type: "null", id : "0"}]

    var privateKey = fs.readFileSync('./server.key', 'utf8');
    var certificate = fs.readFileSync('./server.cert', 'utf8');

    var credentials = { key: privateKey, cert: certificate };
    var https = require('https');

    var httpsServer = https.createServer(credentials);
    httpsServer.listen(Options.services_port);

    const wss = new sock.Server({ server: httpsServer })
    wss.on('connection', function connection(ws) {
        console.log("new client connected")
        ws._data = {
            auth : false
        }
        ws.on('message', function incoming(message) {
            let node = JSON.parse(message)
            if(!ws._data.auth && node.Type == "auth") {
                if(node.Challenge == MnmsData.Challenge) {
                    ws._data.auth = true
                    console.log("new client Auth")
                }
                else {
                    console.log(node.Challemge,MnmsData.Challenge)
                }
            } 
            else if(ws._data.auth && node.Type == "switch") {
                let i = Nodes.findIndex(k => k.IP == node.IP);
                let sw = MnmsData.Switches.filter(k => k.UID == node.id)
                if(sw.length == 1) {
                    let t = new Date
                    sw[0].Timer = t.getTime()
                    //console.log(node.id,MnmsData.Switches.filter(k => k.UID == node.id)[0].Timer)
                }
                else {
                    console.log("Could not find id =",node.id)
                }
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
            }
            else {
                console.log("Forbiden",ws._data,node)
            }
        });
    
    });

    
    // Handling MDNS query for mission control
    //------------------

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
        }
    }


    // Browsing services
    //------------------

    let mdB = mdnsBrowser(mdnsBrowser_cb,mdns)


    // Shaping and linking data
    //-----------

    function mergeNodes(index,newValue,Name: String)
    {
        if(_.isEqual(Nodes[index] , newValue)) return
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
                if(!Nodes[index].Services) Nodes[index].Services = {} 
                if(true) {
                    Object.keys(newValue.Services).forEach((key) => {
                        if(!(Nodes[index].Services[key] && _.isEqual(Nodes[index].Services[key],newValue.Services[key]))) {
                            Nodes[index].Services[key] = newValue.Services[key]
                            if(key.includes("_rtsp._tcp")) {
                                sdpgetter("rtsp://" + newValue.IP + ":" + newValue.Services[key].port + "/by-name/" +  encodeURIComponent(key.split("._")[0]),(sdp) => {  Nodes[index].Services[key].SDP = sdp})
                            }
                        }
                    })
                }
                Nodes[index].OtherIPs = newValue.OtherIPs
                Nodes[index].Macs = newValue.Macs  
                Nodes[index].Neighbour = newValue.Neighbour
                Nodes[index].Mac = newValue.Mac
                Nodes[index].id = newValue.id
                Nodes[index].Name = Name 
            }
        }
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
        //console.log(linkd)

        //console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))

        let old_cleared = null;
        while(linkd.some(k => k.ports.some(l => l.length > 1))) {
            let cleared = linkd.filter(k => k.ports.some(l => l.length == 1))
            if(_.isEqual(cleared, old_cleared)) break;
            old_cleared = JSON.parse(JSON.stringify(cleared))
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
            //if(Nodes[i].Mac) console.log(Nodes[i].Mac)
            if(Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
                let connlist = linkd.filter(k => k.dataRef == i)[0];
            // console.log(connlist)
                for(let p in Nodes[i].Ports) {
                    if(connlist.ports[p]) {
                        Nodes[i].Ports[p].Neighbour=Nodes[connlist.ports[p][0]].IP
                    }
                    else if(Nodes[i].Ports[p].ConnectedMacs.length == 1){
                        let d = Nodes.filter(k => k.Macs && k.Macs.some(l => l === Nodes[i].Ports[p].ConnectedMacs[0]))
                //       console.log("size 1 : " + Nodes[i].Ports[p].ConnectedMacs[0] + " : d size " + d.length + " N->" + Nodes[i].Ports[p].Neighbour)
                        if(d.length >= 1)
                            Nodes[i].Ports[p].Neighbour=d[0].IP
                    }
                // console.log(Nodes[i].Ports[p].Neighbour)
                }
            }
        }

        //console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
    }


    // User and GUI side
    //------------------

    const user_app = exp();

    const server = http.createServer(user_app);

    user_app.use('/', exp.static(__dirname + '/html'));

    server.listen(Options.clients_port, () => {
        console.log(`Server started on port ` + Options.clients_port + ` :)`);
    });

    const user_wss = new sock.Server({ server: server });

    user_wss.on('connection', (ws) => {

        ws.on('message', (message: string) => {
            if(message == "nodes") {
                ws.send(JSON.stringify(Nodes));
            }
            else if(message == "data") {
                let t = new Date;
                MnmsData.CurrentTime = t.getTime()
                ws.send(JSON.stringify(MnmsData))
            }
        });

        //send immediatly a feedback to the incoming connection    
        ws.send(JSON.stringify(MnmsData))
        ws.send(JSON.stringify(Nodes))
    });


    // db and other services start
    //------------------

    var Datastore = require('nedb')
    , db = new Datastore({ filename: Options.database, autoload: true });

    var MnmsData = {
        Type: "MnmsData",
        Workspace: "Nicolas' test network",
        CurrentTime: 0,
        Challenge: "thisisatest",
        Switches : [
                {
                    Type: "ciscoSG",
                    IP : "192.168.1.201",
                    Child: null,
                    Timer: null,
                    UID: "ddjtzlzégndfe"
                },
                {
                    Type: "ciscoSG",
                    IP : "192.168.1.129",
                    Child: null,
                    Timer: null,
                    UID: "aewtuzhmfdfgh"
                },
                {
                    Type: "ciscoSG",
                    IP : "192.168.1.130",
                    Child: null,
                    Timer: null,
                    UID: "bn,héioàtzjrtwrgw"
                }
            ]
    }

    var ServicesDirectory = {
        cisco_switch: "../cisco-switch/app.js"
    }

    var serviceLauncher = (ServiceOptions) => {
        let child_info
        if(Options.launch_services) {
            child_info = Options.launch_services(ServiceOptions)
        }
        else {
            child_info = spawn("node",[ServicesDirectory[ServiceOptions.Name],"-i",ServiceOptions.Params.IP,"-k",MnmsData.Challenge,"-y",ServiceOptions.UID ])
            child_info.on("error",() => {
                child_info.kill()
            })
        }
        return child_info
    }

    for(let s in MnmsData.Switches ){
        if(MnmsData.Switches[s].Type == "ciscoSG") {
            MnmsData.Switches[s].Child = serviceLauncher({
                Name : "cisco_switch",
                Params:{IP : MnmsData.Switches[s].IP},
                Challenge: MnmsData.Challenge, 
                UID: MnmsData.Switches[s].UID
            })
        }
    }
}