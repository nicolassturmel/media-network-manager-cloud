"use strict";
var mdns_ = require('../multicast-dns');
var mdnss = [];
var os = require('os');
var sock = require('ws');
var http = require('http');
var exp = require('express');
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
    out.External = [];
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
    client_cb: null,
    interfaces: null
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
    if (LocalOptions.interfaces)
        Options.interfaces = LocalOptions.interfaces;
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
        console.log(">>>>> new client connected");
        ws._data = {
            auth: false
        };
        ws.on("close", function () {
            console.log("Connection close: ", ws._data);
            var sw = MnmsData[ws._data.Info.ServiceClass].findIndex(function (k) { return k.UID == ws._data.UID; });
            if (sw != -1 && MnmsData[ws._data.Info.ServiceClass][sw]["delete"]) {
                console.log("Found at " + sw + " deleting");
                MnmsData[ws._data.Info.ServiceClass].splice(sw, 1);
                db.update({ Type: "MnmsData" }, blankMnmsData(MnmsData), { upsert: true }, function (err, newDoc) { });
            }
            else {
                console.log("WTF !!!! not found service to stop");
            }
            ws._data = {
                auth: false
            };
        });
        ws.on('message', function incoming(message) {
            var node = JSON.parse(message);
            //console.log(message)
            if (node.Type == "auth") {
                if (node.Challenge == MnmsData.Challenge) {
                    ws._data.auth = true;
                    console.log("new client Auth");
                    if (!MnmsData[node.Info.ServiceClass])
                        MnmsData[node.Info.ServiceClass] = [];
                    var sw = MnmsData[node.Info.ServiceClass].filter(function (k) { return k.UID == node.Info.id; });
                    if (sw.length == 1) {
                        sw[0].Ws = ws;
                        //console.log(node.id,MnmsData.Switches.filter(k => k.UID == node.id)[0].Timer)
                    }
                    else {
                        console.log("Could not find id =", node.Info.id);
                        var sw_1 = MnmsData[node.Info.ServiceClass].push({
                            IP: node.IP,
                            Type: node.Info.Type,
                            Ws: ws,
                            UID: node.Info.id,
                            Info: node.Info.Info
                        });
                    }
                    ws._data.UID = node.Info.id;
                    ws._data.Info = node.Info;
                    ws._data.ServiceClass = node.Info.ServiceClass;
                }
                else {
                    console.log(node.Challemge, MnmsData.Challenge);
                }
            }
            else if (ws._data.auth) {
                //console.log("Got a message")
                if (ws._data.ServiceClass == "Switches") {
                    var i_1 = Nodes.findIndex(function (k) { return k.IP == node.IP; });
                    var sw = MnmsData[ws._data.Info.ServiceClass].filter(function (k) { return k.UID == ws._data.Info.id; });
                    if (sw.length == 1) {
                        var t = new Date;
                        sw[0].Timer = t.getTime();
                        //console.log(node.id,MnmsData.Switches.filter(k => k.UID == node.id)[0].Timer)
                    }
                    if (i_1 == -1) {
                        Nodes.push({
                            Type: "null",
                            IP: node.IP,
                            id: "0",
                            Schema: 1,
                            Ports: [],
                            Services: {},
                            Multicast: null,
                            Neighbour: "",
                            Mac: "",
                            OtherIPs: []
                        });
                        i_1 = Nodes.findIndex(function (k) { return k.IP == node.IP; });
                    }
                    //console.log("Merge now...")
                    mergeNodes(i_1, node, "");
                    calculateInterConnect();
                }
                else if (ws._data.ServiceClass == "Analysers") {
                    console.log("Copying");
                    var sw = MnmsData[ws._data.Info.ServiceClass].filter(function (k) { return k.UID == ws._data.Info.id; });
                    if (sw.length == 1) {
                        sw[0].UID = ws._data.UID;
                        sw[0].Ws = ws;
                        sw[0].node = node;
                    }
                }
                else {
                    console.error("Unknown class " + ws._data.ServiceClass);
                }
            }
            else {
                console.log("Forbiden", ws._data, node);
            }
        });
    });
    // Handling MDNS query for mission control
    //------------------
    var mdB = [];
    var mdns_data = [];
    if (Options.interfaces == null) {
        mdnss.push(mdns_());
        mdns_data.push({
            Name: "all",
            Address: "224.0.0.251"
        });
    }
    else {
        Options.interfaces.forEach(function (i) {
            console.log(i);
            mdnss.push(mdns_({
                multicast: true,
                interface: i,
                port: 5353,
                ip: '224.0.0.251',
                ttl: 255,
                loopback: true,
                reuseAddr: true // set the reuseAddr option when creating the socket (requires node >=0.11.13)
            }));
            mdns_data.push({
                Name: i,
                Address: "224.0.0.251"
            });
        });
    }
    var mdnsBrowser_cb = function (node) {
        if (node.Name != null) {
            var i_2 = Nodes.findIndex(function (k) { return k.IP == node.IP; });
            if (i_2 == -1) {
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
                i_2 = Nodes.findIndex(function (k) { return k.Name == node.Name; });
            }
            mergeNodes(i_2, node, node.Name);
        }
    };
    var _loop_1 = function () {
        var mdns = mdnss[i];
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
        // Browsing services
        //------------------
        mdB.push(require('../mdns-browser')(mdnsBrowser_cb, mdnss[i]));
    };
    for (var i in mdnss) {
        _loop_1();
    }
    // Shaping and linking data
    //-----------
    function mergeNodes(index, newValue, Name) {
        if (_.isEqual(Nodes[index], newValue))
            return;
        if (newValue.Type == "switch") {
            if (newValue.Schema == 1) {
                if (newValue.Name)
                    Nodes[index].Name = newValue.Name;
                Nodes[index].Mac = newValue.Mac;
                if (newValue.Macs)
                    Nodes[index].Macs = newValue.Macs;
                if (Nodes[index].Ports && Nodes[index].Ports.length != newValue.Ports.length)
                    Nodes[index].Ports = [];
                Nodes[index].Ports = newValue.Ports;
                Nodes[index].Multicast = newValue.Multicast;
                Nodes[index].id = newValue.id;
                Nodes[index].Type = newValue.Type;
            }
        }
        else if (newValue.Type == "MdnsNode") {
            if (newValue.Schema == 1) {
                if (Nodes[index].Type && Nodes[index].Type != "switch")
                    Nodes[index].Type = newValue.Type;
                if (!Nodes[index].Services)
                    Nodes[index].Services = {};
                if (true) {
                    Object.keys(newValue.Services).forEach(function (key) {
                        if (!(Nodes[index].Services[key]) || !(Nodes[index].Services[key].SDP || _.isEqual(Nodes[index].Services[key], newValue.Services[key]))) {
                            //console.log("Creating",key)
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
                                // console.log("Deleting",key)
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
        else if (newValue.Type == "disconnected") {
            Nodes[index].Type = "disconnected";
        }
        else {
            console.log("Node type : " + newValue.Type + " not handled");
        }
    }
    function calculateInterConnect() {
        var linkd = [];
        var conns = [];
        // Detecting interconnect
        for (var i_3 in Nodes) {
            if (Nodes[i_3].Type == "switch" && Nodes[i_3].Ports.length > 0) {
                if (!linkd[i_3])
                    linkd[i_3] = {};
                linkd[i_3].dataRef = i_3;
                linkd[i_3].ports = [];
                conns[i_3] = [];
                var _loop_2 = function (j) {
                    if (Nodes[j].Type == "switch" && Nodes[j].Ports.length > 0) {
                        for (var l in Nodes[i_3].Ports) {
                            if (Nodes[j].Macs && Nodes[i_3].Ports[l].ConnectedMacs.some(function (k) { return Nodes[j].Macs.some(function (l) { return l === k; }); })) {
                                if (!linkd[i_3].ports[l])
                                    linkd[i_3].ports[l] = [];
                                if (!linkd[i_3].ports[l].some(function (k) { return k == j; }))
                                    linkd[i_3].ports[l].push(j);
                            }
                            if (Nodes[j].Macs && Nodes[i_3].Ports[l].ConnectedMacs.includes(Nodes[j].Mac)) {
                                if (!linkd[i_3].ports[l])
                                    linkd[i_3].ports[l] = [];
                                if (!linkd[i_3].ports[l].some(function (k) { return k == j; }))
                                    linkd[i_3].ports[l].push(j);
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
        //console.log(JSON.stringify(linkd))
        var old_cleared = null;
        while (linkd.some(function (k) { return k.ports.some(function (l) { return l.length > 1; }); })) {
            // Checking if stalled
            var cleared = linkd.filter(function (k) { return k.ports.some(function (l) { return l.length == 1; }); });
            if (JSON.stringify(cleared) == JSON.stringify(old_cleared))
                break;
            old_cleared = JSON.parse(JSON.stringify(cleared));
            var _loop_3 = function (i_4) {
                if (!(cleared.some(function (k) { return k.dataRef == linkd[i_4].dataRef; }))) {
                    for (var p in linkd[i_4].ports) {
                        if (linkd[i_4].ports[p] != undefined && linkd[i_4].ports[p].length > 1) {
                            //console.log("Switch " , i , " port ", p)
                            var keep = null;
                            var ok = true;
                            var _loop_5 = function (j) {
                                if (cleared.filter(function (q) { return q.dataRef == j; }).length == 1) {
                                    var test = cleared.filter(function (q) { return q.dataRef == j; })[0];
                                    for (var _i = 0, _a = test.ports; _i < _a.length; _i++) {
                                        var pk = _a[_i];
                                        if (pk && pk.length == 1 && pk[0] == i_4) {
                                            if (keep == null)
                                                keep = j;
                                            else
                                                ok = false;
                                        }
                                    }
                                }
                            };
                            for (var _i = 0, _a = linkd[i_4].ports[p]; _i < _a.length; _i++) {
                                var j = _a[_i];
                                _loop_5(j);
                            }
                            if (ok && keep != null) {
                                linkd[i_4].ports[p] = [keep];
                            }
                        }
                    }
                }
            };
            //console.log(JSON.stringify(cleared))
            //console.log(JSON.stringify(linkd))
            // Continuing reduction
            for (var i_4 in linkd) {
                _loop_3(i_4);
            }
        }
        var _loop_4 = function (i_5) {
            //if(Nodes[i].Mac) console.log(Nodes[i].Mac)
            if (Nodes[i_5].Type == "switch" && Nodes[i_5].Ports.length > 0) {
                var connlist = linkd.filter(function (k) { return k.dataRef == i_5; })[0];
                var _loop_6 = function (p) {
                    if (connlist.ports[p]) {
                        Nodes[i_5].Ports[p].Neighbour = Nodes[connlist.ports[p][0]].IP;
                    }
                    else if (Nodes[i_5].Ports[p].ConnectedMacs.length >= 1) {
                        var d = Nodes.filter(function (k) { return k.Macs && k.Macs.some(function (l) { return Nodes[i_5].Ports[p].ConnectedMacs.includes(l); }); });
                        //       console.log("size 1 : " + Nodes[i].Ports[p].ConnectedMacs[0] + " : d size " + d.length + " N->" + Nodes[i].Ports[p].Neighbour)
                        if (d.length >= 1)
                            Nodes[i_5].Ports[p].Neighbour = d[0].IP;
                    }
                };
                for (var p in Nodes[i_5].Ports) {
                    _loop_6(p);
                }
            }
        };
        // Building connection graph
        for (var i_5 in Nodes) {
            _loop_4(i_5);
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
                    if (D_1.Type && (D_1.Type == "ciscoSG" || D_1.Type == "artelQ")) {
                        if (!MnmsData.Switches.some(function (k) { return k.IP == D_1.IP; })) {
                            MnmsData.Switches.push({
                                Type: D_1.Type,
                                IP: D_1.IP,
                                User: D_1.User,
                                Password: D_1.Password,
                                Child: null,
                                Timer: null,
                                StartTime: null,
                                UID: "manual:switch" + Date.now() + ((encodeURIComponent(D_1.IP)))
                            });
                            db.update({ Type: "MnmsData" }, blankMnmsData(MnmsData), { upsert: true }, function (err, newDoc) { });
                            console.log(MnmsData);
                        }
                    }
                    else if (D_1.UserAction) {
                        if (D_1.UserAction == "remove_service" && D_1.UID) {
                            console.log("Asked to remove service of UID " + D_1.UID);
                            var obj = ["Switches", "External", "Analysers"];
                            var idx = 0, found = false;
                            do {
                                if (MnmsData[obj[idx]]) {
                                    var l = MnmsData[obj[idx]].filter(function (k) { return k.UID == D_1.UID; });
                                    if (l.length == 1) {
                                        console.log("Found in " + obj[idx]);
                                        l[0]["delete"] = true;
                                        var Ws = l[0].Ws;
                                        Ws.close();
                                        found = true;
                                    }
                                }
                                idx++;
                            } while (found == false || idx >= obj.length);
                            if (found)
                                db.update({ Type: "MnmsData" }, blankMnmsData(MnmsData), { upsert: true }, function (err, newDoc) { });
                        }
                    }
                    else {
                        console.log("No", D_1);
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
        Schema: 2,
        Workspace: "Mnms - Network Name",
        CurrentTime: 0,
        Challenge: makeid(20),
        OkSwitches: 0,
        Switches: [],
        External: [],
        Mdns: mdns_data,
        Services: {
            Type: "ServiceLaunch",
            cisco_switch: {
                Type: "ciscoSG",
                User: "",
                Password: "",
                IP: ""
            },
            artel_switch: {
                Type: "artelQ",
                User: "",
                Password: "",
                IP: ""
            }
        }
    };
    var Datastore = require('nedb'), db = new Datastore({ filename: path.join(__dirname, Options.database), autoload: true });
    db.find({ Type: "MnmsData", Schema: MnmsData.Schema }, function (err, docs) {
        console.log(docs);
        if (docs.length == 1) {
            MnmsData = docs[0];
            MnmsData.Mdns = mdns_data;
            if (!MnmsData.External)
                MnmsData.External = [];
        }
    });
    var ServicesDirectory = {
        cisco_switch: "../cisco-switch/app.js",
        artel_switch: "../artel-quarra-switch/index.js"
    };
    var serviceLauncher = function (ServiceOptions) {
        var child_info;
        if (Options.launch_services) {
            child_info = Options.launch_services(ServiceOptions);
        }
        else {
            var type = ServiceOptions.Name.split(":")[0];
            var action = ServiceOptions.Name.split(":")[1];
            if (type == "cisco_switch") {
                if (action == "start") {
                    child_info = spawn("node", [ServicesDirectory[type], "-p", ServiceOptions.Params.Password, "-u", ServiceOptions.Params.User, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
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
            else if (type == "artel_switch") {
                if (action == "start") {
                    console.log([ServicesDirectory[type], "-p", ServiceOptions.Params.Password || "\"\"", "-u", ServiceOptions.Params.User, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
                    if (ServiceOptions.Params.Password == "")
                        child_info = spawn("node", [ServicesDirectory[type], "-u", ServiceOptions.Params.User, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
                    else
                        child_info = spawn("node", [ServicesDirectory[type], "-p", ServiceOptions.Params.Password, "-u", ServiceOptions.Params.User, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
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
        }
        return child_info;
    };
    var switchShort = {
        "ciscoSG": "cisco_switch",
        "artelQ": "artel_switch"
    };
    var watchDog = function () {
        console.log("Waf waf");
        var now = Date.now();
        var okswitches = 0, instart = 0;
        for (var s in MnmsData.Switches) {
            if (MnmsData.Switches[s].Child) {
                if (now - MnmsData.Switches[s].Timer < 30000)
                    okswitches++;
                else if (now - MnmsData.Switches[s].StartTime < 15000)
                    instart++;
                else
                    MnmsData.Switches[s].Child = serviceLauncher({
                        Name: switchShort[MnmsData.Switches[s].Type] + ":stop",
                        Params: { Child: MnmsData.Switches[s].Child },
                        Challenge: MnmsData.Challenge,
                        UID: MnmsData.Switches[s].UID
                    });
            }
            else {
                MnmsData.Switches[s].StartTime = Date.now();
                MnmsData.Switches[s].Child = "starting";
                MnmsData.Switches[s].Child = serviceLauncher({
                    Name: switchShort[MnmsData.Switches[s].Type] + ":start",
                    Params: {
                        IP: MnmsData.Switches[s].IP,
                        User: MnmsData.Switches[s].User,
                        Password: MnmsData.Switches[s].Password
                    },
                    Challenge: MnmsData.Challenge,
                    UID: MnmsData.Switches[s].UID
                });
            }
        }
        MnmsData.OkSwitches = okswitches;
    };
    setInterval(watchDog, 2000);
};
