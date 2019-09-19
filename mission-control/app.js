"use strict";
var mdns = require('multicast-dns')();
var os = require('os');
var sock = require('ws');
var http = require('http');
var exp = require('express');
var mdnsBrowser = require('../mdns-browser');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var sdpgetter = require("../rtsp-sdp-query");
var spawn = require('child_process').spawn;
// Utils
//-------------
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
function blankMnmsData(d) {
    var out = JSON.parse(JSON.stringify(d));
    out.Switches.forEach(function (s) {
        s.Child = null;
        s.Timer = null;
        s.StartTime = null;
    });
    return out;
}
// Options and exports
//--------------------------------
var Options = {
    database: "data.db",
    services_port: 16060,
    clients_port: 8888,
    launch_services: null,
    launch_options: {},
    client_cb: null
};
module.exports = function (LocalOptions) {
    if (!LocalOptions)
        LocalOptions = {};
    if (LocalOptions.database)
        Options.database = LocalOptions.database;
    if (LocalOptions.services_port)
        Options.services_port = LocalOptions.services_port;
    if (LocalOptions.clients_port)
        Options.clients_port = LocalOptions.clients_port;
    if (LocalOptions.launch_services)
        Options.launch_services = LocalOptions.launch_services;
    if (LocalOptions.launch_options)
        Options.launch_options = LocalOptions.launch_options;
    if (LocalOptions.client_cb)
        Options.client_cb = LocalOptions.client_cb;
    // Side connected to other services
    //---------------------------------
    var pc_name = os.hostname();
    var prename = pc_name.split('.')[0];
    var Nodes = [{ Type: "null",
            IP: "",
            id: "0",
            Schema: 1,
            Ports: [],
            Services: {},
            Multicast: null,
            Neighbour: "",
            Mac: "" }];
    var privateKey = fs.readFileSync(path.join(__dirname, 'server.key'), 'utf8');
    var certificate = fs.readFileSync(path.join(__dirname, 'server.cert'), 'utf8');
    var credentials = { key: privateKey, cert: certificate };
    var https = require('https');
    var httpsServer = https.createServer(credentials);
    httpsServer.listen(Options.services_port);
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
                else {
                    console.log(node.Challemge, MnmsData.Challenge);
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
                        Type: "null",
                        IP: node.IP,
                        id: "0",
                        Schema: 1,
                        Ports: [],
                        Services: {},
                        Multicast: null,
                        Neighbour: "",
                        Mac: ""
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
    // Handling MDNS query for mission control
    //------------------
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
                    id: "0",
                    Schema: 1,
                    Ports: [],
                    Services: {},
                    Multicast: null,
                    Neighbour: "",
                    Mac: "",
                    IP: node.IP,
                    Type: "null" });
                i = Nodes.findIndex(function (k) { return k.Name == node.Name; });
            }
            mergeNodes(i, node, node.Name);
        }
    };
    // Browsing services
    //------------------
    var mdB = mdnsBrowser(mdnsBrowser_cb, mdns);
    // Shaping and linking data
    //-----------
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
                        if (!(Nodes[index].Services[key]) || !(Nodes[index].Services[key].SDP || _.isEqual(Nodes[index].Services[key], newValue.Services[key]))) {
                            console.log("Creating", key);
                            Nodes[index].Services[key] = newValue.Services[key];
                            if (key.includes("_rtsp._tcp")) {
                                sdpgetter("rtsp://" + newValue.IP + ":" + newValue.Services[key].port + "/by-name/" + encodeURIComponent(key.split("._")[0]), function (sdp) { if (Nodes[index].Services[key])
                                    Nodes[index].Services[key].SDP = sdp; });
                            }
                        }
                    });
                    if (1) {
                        Object.keys(Nodes[index].Services).forEach(function (key) {
                            if (!(newValue.Services[key])) {
                                console.log("Deleting", key);
                                delete Nodes[index].Services[key];
                                if (Object.keys(Nodes[index].Services).length == 0) {
                                    if (Nodes[index].Type && Nodes[index].Type != "switch")
                                        Nodes[index].Type = "disconnected";
                                }
                            }
                        });
                    }
                }
                Nodes[index].OtherIPs = newValue.OtherIPs;
                Nodes[index].Macs = newValue.Macs;
                Nodes[index].Neighbour = newValue.Neighbour;
                Nodes[index].Mac = newValue.Mac;
                Nodes[index].id = newValue.id;
                Nodes[index].Name = Name;
            }
        }
        if (newValue.Type == "disconnected") {
            Nodes[index].Type = "disconnected";
        }
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
                var _loop_1 = function (j) {
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
                    _loop_1(j);
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
            var _loop_2 = function (i) {
                if (!(cleared.some(function (k) { return k.dataRef == linkd[i].dataRef; }))) {
                    for (var p in linkd[i].ports) {
                        if (linkd[i].ports[p] != undefined && linkd[i].ports[p].length > 1) {
                            var keep = null;
                            var _loop_4 = function (j) {
                                if (cleared.filter(function (q) { return q.dataRef == j; }).length == 1)
                                    keep = j;
                            };
                            for (var _i = 0, _a = linkd[i].ports[p]; _i < _a.length; _i++) {
                                var j = _a[_i];
                                _loop_4(j);
                            }
                            if (keep != null) {
                                linkd[i].ports[p] = [keep];
                            }
                        }
                    }
                }
            };
            for (var i in linkd) {
                _loop_2(i);
            }
        }
        var _loop_3 = function (i) {
            //if(Nodes[i].Mac) console.log(Nodes[i].Mac)
            if (Nodes[i].Type == "switch" && Nodes[i].Ports.length > 0) {
                var connlist = linkd.filter(function (k) { return k.dataRef == i; })[0];
                var _loop_5 = function (p) {
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
                    _loop_5(p);
                }
            }
        };
        // Building connection graph
        for (var i in Nodes) {
            _loop_3(i);
        }
        //console.log(JSON.stringify(linkd.filter(k => k.ports.some(l => l.length == 1))))
    }
    // User and GUI side
    //------------------
    var user_app = exp();
    var server = http.createServer(user_app);
    user_app.use('/', exp.static(__dirname + '/html'));
    server.listen(Options.clients_port, function () {
        console.log("Server started on port " + Options.clients_port + " :)");
    });
    var user_wss = new sock.Server({ server: server });
    user_wss.on('connection', function (ws) {
        ws.on('message', function (message) {
            if (message == "nodes") {
                ws.send(JSON.stringify(Nodes));
            }
            else if (message == "data") {
                var t = new Date;
                MnmsData.CurrentTime = t.getTime();
                ws.send(JSON.stringify(MnmsData));
            }
            else {
                try {
                    var D_1 = JSON.parse(message);
                    console.log("D", D_1);
                    if (D_1.Type && D_1.Type == "ciscoSG") {
                        if (!MnmsData.Switches.some(function (k) { return k.IP == D_1.IP; })) {
                            MnmsData.Switches.push({
                                Type: D_1.Type,
                                IP: D_1.IP,
                                Child: null,
                                Timer: null,
                                StartTime: null,
                                UID: "ddjt" + Date.now() + ((encodeURIComponent(D_1.IP)))
                            });
                            db.update({ Type: "MnmsData" }, blankMnmsData(MnmsData), { upsert: true }, function (err, newDoc) { });
                            console.log(MnmsData);
                        }
                    }
                }
                catch (error) {
                    console.log("Error when parsing json on message reception");
                }
            }
        });
        //send immediatly a feedback to the incoming connection    
        ws.send(JSON.stringify(MnmsData));
        ws.send(JSON.stringify(Nodes));
    });
    // db and other services start
    //------------------
    var MnmsData = {
        Type: "MnmsData",
        Workspace: "Mnms - Network Name",
        CurrentTime: 0,
        Challenge: makeid(20),
        OkSwitches: 0,
        Switches: []
    };
    var Datastore = require('nedb'), db = new Datastore({ filename: path.join(__dirname, Options.database), autoload: true });
    db.find({ Type: "MnmsData" }, function (err, docs) {
        console.log(docs);
        if (docs.length == 1) {
            MnmsData = docs[0];
        }
    });
    var ServicesDirectory = {
        cisco_switch: "../cisco-switch/app.js"
    };
    var serviceLauncher = function (ServiceOptions) {
        var child_info;
        if (Options.launch_services) {
            child_info = Options.launch_services(ServiceOptions);
        }
        else {
            var type = ServiceOptions.Name.split(":")[0];
            var action = ServiceOptions.Name.split(":")[1];
            if (action == "start") {
                child_info = spawn("node", [ServicesDirectory[type], "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
                child_info.on("error", function () {
                    child_info.kill();
                });
            }
            else if (action == "stop") {
                if (ServiceOptions.Params.Child.kill)
                    ServiceOptions.Params.Child.kill();
                child_info = null;
            }
        }
        return child_info;
    };
    var watchDog = function () {
        console.log("Waf waf");
        var now = Date.now();
        var okswitches = 0, instart = 0;
        for (var s in MnmsData.Switches) {
            if (MnmsData.Switches[s].Child) {
                if (now - MnmsData.Switches[s].Timer < 10000)
                    okswitches++;
                else if (now - MnmsData.Switches[s].StartTime < 15000)
                    instart++;
                else
                    MnmsData.Switches[s].Child = serviceLauncher({
                        Name: "cisco_switch:stop",
                        Params: { Child: MnmsData.Switches[s].Child },
                        Challenge: MnmsData.Challenge,
                        UID: MnmsData.Switches[s].UID
                    });
            }
            else {
                MnmsData.Switches[s].StartTime = Date.now();
                MnmsData.Switches[s].Child = "starting";
                MnmsData.Switches[s].Child = serviceLauncher({
                    Name: "cisco_switch:start",
                    Params: { IP: MnmsData.Switches[s].IP },
                    Challenge: MnmsData.Challenge,
                    UID: MnmsData.Switches[s].UID
                });
            }
        }
        MnmsData.OkSwitches = okswitches;
    };
    setInterval(watchDog, 2000);
};
