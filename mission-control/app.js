var mdns = require('multicast-dns')();
var arp = require('node-arp');
var os = require('os');
var sock = require('ws');
var http = require('http');
var exp = require('express');
var uniqid = require('uniqid');
var mdnsBrowser = require('../mdns-browser');
var id_local = 0;
var fs = require('fs');
var _ = require('lodash');
var RTSPClient = require("yellowstone").RTSPClient;
var sdpgetter = require("../rtsp-sdp-query");
var spawn = require('child_process').spawn;
// Side connected to other services
//---------------------------------
var pc_name = os.hostname();
var prename = pc_name.split('.')[0];
var Nodes = [{ Type: "null", id: "0" }];
var Hosts = {};
var Services = {};
var getMacClear = true;
// Building secure ssl
// read ssl certificate
var privateKey = fs.readFileSync('server.key', 'utf8');
var certificate = fs.readFileSync('server.cert', 'utf8');
var credentials = { key: privateKey, cert: certificate };
var https = require('https');
//pass in your credentials to create an https server
var httpsServer = https.createServer(credentials);
httpsServer.listen(16060);
var wss = new sock.Server({ server: httpsServer });
wss.on('connection', function connection(ws) {
    console.log("new client connected");
    ws._data = {
        auth: false
    };
    ws.on('message', function incoming(message) {
        var node = JSON.parse(message);
        if (!ws._data.auth && node.Type == "auth") {
            if (node.Challenge == MnmsData.Challenge) {
                ws._data.auth = true;
                console.log("new client Auth");
            }
        }
        else if (ws._data.auth && node.Type == "switch") {
            var i = Nodes.findIndex(function (k) { return k.IP == node.IP; });
            var sw = MnmsData.Switches.filter(function (k) { return k.UID == node.id; });
            if (sw.length == 1) {
                var t = new Date;
                sw[0].Timer = t.getTime();
                //console.log(node.id,MnmsData.Switches.filter(k => k.UID == node.id)[0].Timer)
            }
            else {
                console.log("Could not find id =", node.id);
            }
            if (i == -1) {
                Nodes.push({
                    IP: node.IP,
                    Type: "Empty"
                });
                i = Nodes.findIndex(function (k) { return k.IP == node.IP; });
            }
            mergeNodes(i, node, "");
            calculateInterConnect();
        }
        else {
            console.log("Forbiden", ws._data, node);
        }
    });
});
mdns.on('query', function (query) {
    if (query.questions.some(function (k) { return k.name == "_missioncontrol._socketio.local"; })) {
        mdns.respond({
            answers: [{
                    name: 'missioncontrol_' + prename + '._missioncontrol._socketio.local',
                    type: 'SRV',
                    data: {
                        port: 16060,
                        weigth: 0,
                        priority: 10,
                        target: prename + '.local'
                    }
                }]
        });
    }
});
mdns.respond({
    answers: [{
            name: 'missioncontrol_' + prename + '._missioncontrol._socketio.local',
            type: 'SRV',
            data: {
                port: 16060,
                weigth: 0,
                priority: 10,
                target: prename + '.local'
            }
        }]
});
var mdnsBrowser_cb = function (node) {
    if (node.Name != null) {
        var i = Nodes.findIndex(function (k) { return k.IP == node.IP; });
        if (i == -1) {
            Nodes.push({ Name: node.Name,
                IP: node.IP,
                Type: "Empty" });
            i = Nodes.findIndex(function (k) { return k.Name == node.Name; });
        }
        mergeNodes(i, node, node.Name);
    }
};
var mdB = mdnsBrowser(mdnsBrowser_cb, mdns);
function mergeNodes(index, newValue, Name) {
    if (_.isEqual(Nodes[index], newValue))
        return;
    if (newValue.Type == "switch") {
        if (newValue.Schema == 1) {
            Nodes[index].Mac = newValue.Mac;
            if (Nodes[index].Ports && Nodes[index].Ports.length != newValue.Ports.length)
                Nodes[index].Ports = [];
            Nodes[index].Ports = newValue.Ports;
            Nodes[index].Multicast = newValue.Multicast;
            Nodes[index].id = newValue.id;
            Nodes[index].Type = newValue.Type;
        }
    }
    if (newValue.Type == "MdnsNode") {
        if (newValue.Schema == 1) {
            if (Nodes[index].Type && Nodes[index].Type != "switch")
                Nodes[index].Type = newValue.Type;
            if (!Nodes[index].Services)
                Nodes[index].Services = {};
            if (true) {
                Object.keys(newValue.Services).forEach(function (key) {
                    if (!(Nodes[index].Services[key] && _.isEqual(Nodes[index].Services[key], newValue.Services[key]))) {
                        Nodes[index].Services[key] = newValue.Services[key];
                        if (key.includes("_rtsp._tcp")) {
                            sdpgetter("rtsp://" + newValue.IP + ":" + newValue.Services[key].port + "/by-name/" + encodeURIComponent(key.split("._")[0]), function (sdp) { Nodes[index].Services[key].SDP = sdp; });
                        }
                    }
                });
            }
            Nodes[index].OtherIPs = newValue.OtherIPs;
            Nodes[index].Macs = newValue.Macs;
            Nodes[index].Neighbour = newValue.Neighbour;
            Nodes[index].Mac = newValue.Mac;
            Nodes[index].id = newValue.id;
            Nodes[index].Name = Name;
        }
    }
}
mdns.query({
    questions: [{
            name: '_http._tcp.local',
            type: 'SRV'
        }]
});
function buildServiceHttpLink(obj) {
}
function calculateInterConnect() {
    var linkd = [];
    var conns = [];
    // Detecting interconnect
    for (var i in Nodes) {
        if (Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
            if (!linkd[i])
                linkd[i] = {};
            linkd[i].dataRef = i;
            linkd[i].ports = [];
            conns[i] = [];
            var _loop_2 = function (j) {
                if (Nodes[j].Type == "switch" && Nodes[j].Ports.length > 0) {
                    for (var l in Nodes[i].Ports) {
                        if (Nodes[j].Macs && Nodes[i].Ports[l].ConnectedMacs.some(function (k) { return Nodes[j].Macs.some(function (l) { return l === k; }); })) {
                            if (!linkd[i].ports[l])
                                linkd[i].ports[l] = [];
                            if (!linkd[i].ports[l].some(function (k) { return k == j; }))
                                linkd[i].ports[l].push(j);
                        }
                    }
                }
            };
            for (var j = 0; j < Nodes.length; j++) {
                _loop_2(j);
            }
        }
    }
    //console.log(linkd)
    //console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
    var old_cleared = null;
    while (linkd.some(function (k) { return k.ports.some(function (l) { return l.length > 1; }); })) {
        var cleared = linkd.filter(function (k) { return k.ports.some(function (l) { return l.length == 1; }); });
        if (_.isEqual(cleared, old_cleared))
            break;
        old_cleared = JSON.parse(JSON.stringify(cleared));
        var _loop_3 = function (i) {
            if (!(cleared.some(function (k) { return k.dataRef == linkd[i].dataRef; }))) {
                for (var p in linkd[i].ports) {
                    if (linkd[i].ports[p] != undefined && linkd[i].ports[p].length > 1) {
                        var keep = null;
                        var _loop_5 = function (j) {
                            if (cleared.filter(function (q) { return q.dataRef == j; }).length == 1)
                                keep = j;
                        };
                        for (var _i = 0, _a = linkd[i].ports[p]; _i < _a.length; _i++) {
                            var j = _a[_i];
                            _loop_5(j);
                        }
                        if (keep != null) {
                            linkd[i].ports[p] = [keep];
                        }
                    }
                }
            }
        };
        for (var i in linkd) {
            _loop_3(i);
        }
    }
    var _loop_4 = function (i) {
        //if(Nodes[i].Mac) console.log(Nodes[i].Mac)
        if (Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
            var connlist = linkd.filter(function (k) { return k.dataRef == i; })[0];
            var _loop_6 = function (p) {
                if (connlist.ports[p]) {
                    Nodes[i].Ports[p].Neighbour = Nodes[connlist.ports[p][0]].IP;
                }
                else if (Nodes[i].Ports[p].ConnectedMacs.length == 1) {
                    var d = Nodes.filter(function (k) { return k.Macs && k.Macs.some(function (l) { return l === Nodes[i].Ports[p].ConnectedMacs[0]; }); });
                    //       console.log("size 1 : " + Nodes[i].Ports[p].ConnectedMacs[0] + " : d size " + d.length + " N->" + Nodes[i].Ports[p].Neighbour)
                    if (d.length >= 1)
                        Nodes[i].Ports[p].Neighbour = d[0].IP;
                }
            };
            // console.log(connlist)
            for (var p in Nodes[i].Ports) {
                _loop_6(p);
            }
        }
    };
    // Building connection graph
    for (var i in Nodes) {
        _loop_4(i);
    }
    //console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
}
// User and GUI side
//------------------
var user_app = exp();
var server = http.createServer(user_app);
//start our server
user_app.use('/', exp.static(__dirname + '/html'));
server.listen(8888, function () {
    console.log("Server started on port 8888 :)");
});
//initialize the WebSocket server instance
var user_wss = new sock.Server({ server: server });
user_wss.on('connection', function (ws) {
    //connection is up, let's add a simple simple event
    ws.on('message', function (message) {
        if (message == "nodes") {
            ws.send(JSON.stringify(Nodes));
        }
        else if (message == "data") {
            var t = new Date;
            MnmsData.CurrentTime = t.getTime();
            ws.send(JSON.stringify(MnmsData));
        }
    });
    //send immediatly a feedback to the incoming connection    
    ws.send(JSON.stringify(MnmsData));
    ws.send(JSON.stringify(Nodes));
});
// db
var Datastore = require('nedb'), db = new Datastore({ filename: 'data.db', autoload: true });
var MnmsData = {
    Type: "MnmsData",
    Workspace: "Nicolas' test network",
    CurrentTime: 0,
    Challenge: "thisisatest",
    Switches: [
        {
            Type: "ciscoSG",
            IP: "192.168.1.201",
            Child: null,
            Timer: null,
            UID: "ddjtzlzégndfe"
        },
        {
            Type: "ciscoSG",
            IP: "192.168.1.129",
            Child: null,
            Timer: null,
            UID: "aewtuzhmfdfgh"
        },
        {
            Type: "ciscoSG",
            IP: "192.168.1.130",
            Child: null,
            Timer: null,
            UID: "bn,héioàtzjrtwrgw"
        }
    ]
};
var _loop_1 = function (s) {
    if (MnmsData.Switches[s].Type == "ciscoSG") {
        MnmsData.Switches[s].Child = spawn("node", ["../cisco-switch/app.js", "-i", MnmsData.Switches[s].IP, "-k", MnmsData.Challenge, "-y", MnmsData.Switches[s].UID]);
        MnmsData.Switches[s].Child.on("error", function () {
            MnmsData.Switches[s].Child.kill();
        });
    }
};
for (var s in MnmsData.Switches) {
    _loop_1(s);
}
