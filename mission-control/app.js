"use strict";
var fs_1 = require("fs");
var mdns_ = require('../multicast-dns');
var mdnss = [];
var os = require('os');
var sock = require('ws');
var http = require('http');
var exp = require('express');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var dante = require('../dante/index.js');
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
    database: path.join(__dirname, "data.db"),
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
    var Nodes = [{
            Type: "null",
            IP: "",
            id: "0",
            Schema: 1,
            Ports: [],
            Services: {},
            Multicast: null,
            Neighbour: "",
            Mac: ""
        }];
    var Snapshot = null;
    var SelectedSnapId = 0;
    var ArpCache = {};
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
            if (!ws._data.Info) {
                ws._data = {
                    auth: false
                };
                return;
            }
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
                    if (node.Type == "switch") {
                        var sw = MnmsData[ws._data.Info.ServiceClass].filter(function (k) { return k.UID == ws._data.Info.id; });
                        if (sw.length == 1) {
                            var t = new Date;
                            sw[0].Timer = t.getTime();
                            //console.log(node.id,MnmsData.Switches.filter(k => k.UID == node.id)[0].Timer)
                        }
                        mergeNodes(null, node, null);
                        calculateInterConnect();
                    }
                    else if (node.Type == "ARP") {
                        node.Data.forEach(function (d) {
                            var Ip = d.Ip;
                            var Mac = d.Mac;
                            ArpCache[Mac] = Ip;
                            var D = Nodes.filter(function (n) { return n.OtherIPs && n.Macs && n.Macs.includes(d.Mac) && !n.OtherIPs.includes(d.Ip); });
                            D.forEach(function (d) { return d.OtherIPs.push(Ip); });
                            D = Nodes.filter(function (n) { return n.OtherIPs && n.Macs && !n.Macs.includes(d.Mac) && n.OtherIPs.includes(d.Ip); });
                            D.forEach(function (d) { return d.Macs.push(Mac); });
                        });
                        console.log(ArpCache);
                    }
                    else {
                        console.error("Unknown type " + node.Type);
                    }
                }
                else if (ws._data.ServiceClass == "Analysers") {
                    console.log("Copying");
                    var sw = MnmsData[ws._data.Info.ServiceClass].filter(function (k) { return k.UID == ws._data.Info.id; });
                    if (sw.length == 1) {
                        sw[0].UID = ws._data.UID;
                        sw[0].Ws = ws;
                        sw[0].node = node;
                        sw[0]["delete"] = true;
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
        node.Name = node.Name.split(".")[0];
        if (node.Name != null) {
            mergeNodes(null, node, null);
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
    var node_timers = [];
    var mergeNodesTimer = function (index, newValue, Name) {
        if (newValue._Timers) {
            if (!Nodes[index]._Timers)
                Nodes[index]._Timers = [];
            var _loop_2 = function (t) {
                var t_index = Nodes[index]._Timers.findIndex(function (k) { return k.path == t.path; });
                if (t_index < 0) {
                    Nodes[index]._Timers.push(t);
                    t_index = Nodes[index]._Timers.findIndex(function (k) { return k.path == t.path; });
                }
                Nodes[index]._Timers[t_index].time = t.time;
                var xt = Nodes[index]._Timers[t_index];
                if (xt.path.startsWith("$."))
                    newValue[xt.path.substr(2)].offline = false;
                if (!node_timers[index])
                    node_timers[index] = {};
                if (node_timers[index][t.path])
                    clearTimeout(node_timers[index][t.path]);
                if (xt.path.startsWith("$."))
                    node_timers[index][t.path] = setTimeout(function () { newValue[xt.path.substr(2)].offline = true; }, 1000 * xt.time);
            };
            for (var _i = 0, _a = newValue._Timers; _i < _a.length; _i++) {
                var t = _a[_i];
                _loop_2(t);
            }
        }
    };
    var mergeNodesUIParams = function (index) {
        if (!Nodes[index].UIParams) {
            console.error("Built new params");
            Nodes[index].UIParams = {
                Ports: {
                    showUnplugged: true,
                    showPlugged: true,
                    showOff: true
                }
            };
        }
    };
    var mergePorts = function (oldPs, newPs) {
        newPs.forEach(function (newP) {
            if (newP.ConnectedMacs.length == 1) {
                if (ArpCache[newP.ConnectedMacs[0]]) {
                    newP.Neighbour = ArpCache[newP.ConnectedMacs[0]];
                    console.log("New neighbor " + newP.Neighbour + " on port " + newP.Name);
                }
            }
        });
        return newPs;
    };
    var mergeNodesSwitch = function (index, newValue, Name) {
        if (newValue.Schema == 1) {
            if (newValue.Name)
                Nodes[index].Name = newValue.Name;
            Nodes[index].Mac = newValue.Mac;
            if (newValue.Macs)
                Nodes[index].Macs = newValue.Macs;
            if (Nodes[index].Ports && Nodes[index].Ports.length != newValue.Ports.length)
                Nodes[index].Ports = [];
            Nodes[index].Ports = mergePorts(Nodes[index].Ports, newValue.Ports);
            Nodes[index].Multicast = newValue.Multicast;
            Nodes[index].id = newValue.id;
            Nodes[index].Type = newValue.Type;
            Nodes[index].Capabilities = newValue.Capabilities;
            var _loop_3 = function (p) {
                if (p.Neighbour && !Nodes.some(function (k) { return (k.IP == p.Neighbour || (k.OtherIPs && k.OtherIPs.includes(p.Neighbour))); })) {
                    var N = {
                        Name: "(G) " + p.Neighbour.replace(/\./g, "-"),
                        Type: "disconnected",
                        IP: p.Neighbour,
                        Neighbour: null,
                        Schema: 1,
                        Multicast: "off",
                        Mac: (p.ConnectedMacs.length > 0) ? p.ConnectedMacs[0] : "00:00:00:00:00:00",
                        id: "(G) " + p.Neighbour
                    };
                    Nodes.push(N);
                }
            };
            // Building ghost devices
            for (var _i = 0, _a = newValue.Ports; _i < _a.length; _i++) {
                var p = _a[_i];
                _loop_3(p);
            }
        }
    };
    var mergeNodesMdnsManual = function (index, newValue, Name) {
        //console.log(newValue)
        if (newValue.Schema == 1) {
            if (Nodes[index].Type && Nodes[index].Type != "switch")
                Nodes[index].Type = newValue.Type;
            if (!Nodes[index].Services)
                Nodes[index].Services = {};
            if (true) {
                if (newValue.Services)
                    Object.keys(newValue.Services).forEach(function (key) {
                        if (!(Nodes[index].Services[key])
                            || !(Nodes[index].Services[key].SDP
                                || _.isEqual(Nodes[index].Services[key], newValue.Services[key]))) {
                            Nodes[index].Services[key] = newValue.Services[key];
                            if (key.includes("_rtsp._tcp")) {
                                sdpgetter("rtsp://" + newValue.IP + ":" + newValue.Services[key].port + "/by-name/" + encodeURIComponent(key.split("._")[0]), function (sdp) { if (Nodes[index].Services[key])
                                    Nodes[index].Services[key].SDP = sdp; });
                            }
                            if (key.includes('_netaudio-arc') && Nodes[index].Services[key] && Nodes[index].Services[key].Polling != true) {
                                if (!Nodes[index].Services[key].lastPoll)
                                    Nodes[index].Services[key].lastPoll = 0;
                                if (!Nodes[index].Services[key].Polling)
                                    Nodes[index].Services[key].Polling = true;
                                if (!Nodes[index].Services[key].Streams)
                                    Nodes[index].Services[key].Streams = [];
                                var poll_1 = function () {
                                    console.log("Polling for " + Nodes[index].Name);
                                    if (Nodes[index] && Nodes[index].Services[key]
                                        && Nodes[index].Services[key].Streams
                                        && Date.now() - Nodes[index].Services[key].lastPoll > 10000) {
                                        Nodes[index].Services[key].lastPoll = Date.now();
                                        dante(newValue.IP).then(function (k) {
                                            Nodes[index].Services[key].Streams = k;
                                            setTimeout(function () {
                                                poll_1();
                                            }, 15000);
                                        });
                                    }
                                };
                                poll_1();
                            }
                        }
                    });
                if (newValue.Services) {
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
            if (!Nodes[index].Macs)
                Nodes[index].Macs = newValue.Macs;
            else
                newValue.Macs.forEach(function (element) {
                    if (!Nodes[index].Macs.includes(element))
                        Nodes[index].Macs.push(element);
                });
            Nodes[index].Neighbour = newValue.Neighbour;
            Nodes[index].Mac = newValue.Mac;
            Nodes[index].id = newValue.id;
            Nodes[index].Name = Name || newValue.Name;
        }
    };
    var findCandidates = function (val) {
        var r = 0;
        r = Nodes.findIndex(function (n) { return n.Name == val.Name; });
        if (r == -1)
            r = Nodes.findIndex(function (n) { return n.Mac == val.Mac; });
        if (r == -1)
            r = Nodes.findIndex(function (n) { return (n.Macs && n.Macs.includes(val.Mac)) || (val.Macs && val.Macs.includes(n.Mac)); });
        if (r == -1)
            r = Nodes.findIndex(function (n) { return n.IP == val.IP; });
        if (r == -1)
            r = Nodes.findIndex(function (n) { return (n.OtherIPs && n.OtherIPs.includes(val.IP)) || (val.OtherIPs && val.OtherIPs.includes(n.IP)); });
        return r;
    };
    function mergeNodes(index, newValue, Name) {
        index = findCandidates(newValue) || index;
        if (!index || index < 0 || index > Nodes.length) {
            console.error("Could not find a node");
            Nodes.push(newValue);
            return;
        }
        mergeNodesUIParams(index);
        mergeNodesTimer(index, newValue, Name);
        switch (newValue.Type) {
            case "switch":
                mergeNodesSwitch(index, newValue, Name);
                break;
            case "MdnsNode":
            case "ManualNode":
                mergeNodesMdnsManual(index, newValue, Name);
                break;
            case "disconnected":
                Nodes[index].Type = "disconnected";
                break;
            default:
                console.log("Node type : " + newValue.Type + " not handled");
                break;
        }
        if (newValue.System)
            Nodes[index].System = newValue.System;
        if (!Nodes[index].seqnum)
            Nodes[index].seqnum = 0;
        if (!Nodes[index].OtherIPs)
            Nodes[index].OtherIPs = [];
        Nodes[index].seqnum++;
    }
    function calculateInterConnect() {
        var linkd = [];
        var conns = [];
        // Detecting interconnect
        for (var i_1 in Nodes) {
            if (Nodes[i_1].Type == "switch" && Nodes[i_1].Ports.length > 0) {
                if (!linkd[i_1])
                    linkd[i_1] = {};
                linkd[i_1].dataRef = i_1;
                linkd[i_1].ports = [];
                conns[i_1] = [];
                var _loop_4 = function (j) {
                    if (Nodes[j].Type == "switch" && Nodes[j].Ports.length > 0) {
                        //console.log("Testing ",j)
                        for (var l in Nodes[i_1].Ports) {
                            //console.log("Testing ",i," port ",l)
                            //console.log(Nodes[j].Macs,Nodes[j].Mac,Nodes[i].Ports[l].ConnectedMacs)
                            if (Nodes[j].Macs && Nodes[i_1].Ports[l].ConnectedMacs.some(function (k) { return Nodes[j].Macs.some(function (l) { return l === k; }); })) {
                                if (!linkd[i_1].ports[l])
                                    linkd[i_1].ports[l] = [];
                                if (!linkd[i_1].ports[l].some(function (k) { return k == j; }))
                                    linkd[i_1].ports[l].push(j);
                            }
                            if (Nodes[j].Mac && Nodes[i_1].Ports[l].ConnectedMacs.includes(Nodes[j].Mac)) {
                                if (!linkd[i_1].ports[l])
                                    linkd[i_1].ports[l] = [];
                                if (!linkd[i_1].ports[l].some(function (k) { return k == j; }))
                                    linkd[i_1].ports[l].push(j);
                            }
                        }
                    }
                };
                for (var j = 0; j < Nodes.length; j++) {
                    _loop_4(j);
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
            var _loop_5 = function (i_2) {
                if (!(cleared.some(function (k) { return k.dataRef == linkd[i_2].dataRef; }))) {
                    for (var p in linkd[i_2].ports) {
                        if (linkd[i_2].ports[p] != undefined && linkd[i_2].ports[p].length > 1) {
                            //console.log("Switch " , i , " port ", p)
                            var keep = null;
                            var ok = true;
                            var _loop_8 = function (j) {
                                if (cleared.filter(function (q) { return q.dataRef == j; }).length == 1) {
                                    var test = cleared.filter(function (q) { return q.dataRef == j; })[0];
                                    for (var _i = 0, _a = test.ports; _i < _a.length; _i++) {
                                        var pk = _a[_i];
                                        if (pk && pk.length == 1 && pk[0] == i_2) {
                                            if (keep == null)
                                                keep = j;
                                            else
                                                ok = false;
                                        }
                                    }
                                }
                            };
                            for (var _i = 0, _a = linkd[i_2].ports[p]; _i < _a.length; _i++) {
                                var j = _a[_i];
                                _loop_8(j);
                            }
                            if (ok && keep != null) {
                                linkd[i_2].ports[p] = [keep];
                            }
                        }
                    }
                }
            };
            //console.log(JSON.stringify(cleared))
            //console.log(JSON.stringify(linkd))
            // Continuing reduction
            for (var i_2 in linkd) {
                _loop_5(i_2);
            }
        }
        var _loop_6 = function (i_3) {
            //if(Nodes[i].Mac) console.log(Nodes[i].Mac)
            if (Nodes[i_3].Type == "switch" && Nodes[i_3].Ports.length > 0) {
                var connlist = linkd.filter(function (k) { return k.dataRef == i_3; })[0];
                var _loop_9 = function (p) {
                    if (connlist.ports[p]) {
                        Nodes[i_3].Ports[p].Neighbour = Nodes[connlist.ports[p][0]].IP;
                    }
                    else if (Nodes[i_3].Ports[p].ConnectedMacs.length >= 1) {
                        var d = Nodes.filter(function (k) { return k.Macs && k.Macs.some(function (l) { return Nodes[i_3].Ports[p].ConnectedMacs.includes(l); }); });
                        //       console.log("size 1 : " + Nodes[i].Ports[p].ConnectedMacs[0] + " : d size " + d.length + " N->" + Nodes[i].Ports[p].Neighbour)
                        if (d.length >= 1) {
                            Nodes[i_3].Ports[p].Neighbour = d[0].IP;
                        }
                    }
                };
                for (var p in Nodes[i_3].Ports) {
                    _loop_9(p);
                }
            }
        };
        // Building connection graph
        for (var i_3 in Nodes) {
            _loop_6(i_3);
        }
        var _loop_7 = function (list) {
            if (list && list.dataRef) {
                var friend_1 = linkd.filter(function (k) { return k.ports.some(function (l) { return l == list.dataRef; }); });
                if (friend_1.length == 1 && friend_1[0]) {
                    var listPort_1 = -1;
                    list.ports.forEach(function (kval, id) {
                        if (kval.includes(parseInt(friend_1[0].dataRef))) {
                            listPort_1 = id;
                            console.log(list.ports, friend_1[0].dataRef, listPort_1);
                        }
                    });
                    var friendPort_1 = -1;
                    friend_1[0].ports.forEach(function (kval, id) {
                        if (kval.includes(parseInt(list.dataRef))) {
                            friendPort_1 = id;
                            console.log(friend_1[0].ports, list.dataRef, friendPort_1);
                        }
                    });
                    // Just to fuck with your head
                    var listNode = Nodes[friend_1[0].dataRef];
                    var friendNode = Nodes[list.dataRef];
                    console.log("VLAN  testing " + friendNode.Name + " - " + listPort_1 + "<->" + listNode.Name + " - " + friendPort_1);
                    if (listPort_1 >= 0
                        && friendPort_1 >= 0
                        && friendNode.Ports[listPort_1]
                        && listNode.Ports[friendPort_1]
                        && friendNode.Ports[listPort_1].Vlan
                        && listNode.Ports[friendPort_1].Vlan
                        && (!_.isEqual(listNode.Ports[friendPort_1].Vlan.Tagged.sort(), friendNode.Ports[listPort_1].Vlan.Tagged.sort())
                            || !_.isEqual(listNode.Ports[friendPort_1].Vlan.Untagged.sort(), friendNode.Ports[listPort_1].Vlan.Untagged.sort()))) {
                        if (!listNode.Errors)
                            listNode.Errors = {};
                        if (!listNode.Errors.Ports)
                            listNode.Errors.Ports = [];
                        if (!listNode.Errors.Ports[friendPort_1])
                            listNode.Errors.Ports[friendPort_1] = {};
                        listNode.Errors.Ports[friendPort_1].vlanMissmatch = "VLAN mismatch with connection to switch " + friendNode.Name;
                        if (!friendNode.Errors)
                            friendNode.Errors = {};
                        if (!friendNode.Errors.Ports)
                            friendNode.Errors.Ports = [];
                        if (!friendNode.Errors.Ports[listPort_1])
                            friendNode.Errors.Ports[listPort_1] = {};
                        friendNode.Errors.Ports[listPort_1].vlanMissmatch = "VLAN mismatch with connection to switch " + listNode.Name;
                        console.log("VLAN  mismatch for switch to switch link on " + friendNode.Name + "-" + listPort_1 + "<->" + listNode.Name + " - " + friendPort_1);
                        //listNode.Errors.Ports[listPort]
                    }
                    if (listPort_1 >= 0
                        && friendPort_1 >= 0
                        && friendNode.Ports[listPort_1]
                        && listNode.Ports[friendPort_1]
                        && friendNode.Ports[listPort_1].Vlan
                        && listNode.Ports[friendPort_1].Vlan)
                        console.log("--------------", friendNode.Ports[listPort_1].Vlan, listNode.Ports[friendPort_1].Vlan);
                }
            }
        };
        // Check vlan symmetry
        for (var _i = 0, _a = linkd.filter(function (k) { return k.ports.some(function (l) { return l.length == 1; }); }); _i < _a.length; _i++) {
            var list = _a[_i];
            _loop_7(list);
        }
        if (SelectedSnapId != 0)
            compareToSnapshot();
        console.log(JSON.stringify(linkd.filter(function (k) { return k.ports.some(function (l) { return l.length == 1; }); })));
    }
    // User and GUI side
    //------------------
    var user_app = exp();
    var server = http.createServer(user_app);
    user_app.use('/', exp.static(__dirname + '/html'));
    user_app.get('/nodes', function (req, res) {
        if (Object.keys(req.query).length == 0)
            res.send(Nodes);
        else
            res.send(Nodes.filter(function (N) {
                var found = false;
                Object.keys(req.query).forEach(function (k) {
                    if (N[k]
                        && ((typeof N[k] == "number" && N[k] == req.query[k])
                            || (typeof N[k] == "string" && N[k].includes(req.query[k]))
                            || (Array.isArray(N[k]) && N[k].includes(req.query[k]))))
                        found = true;
                    else
                        found = false;
                });
                return found;
            }));
    });
    server.listen(Options.clients_port, function () {
        console.log("Server started on port " + Options.clients_port + " :)");
    });
    var user_wss = new sock.Server({ server: server });
    user_wss.broadcast = function broadcast(msg) {
        console.log(msg);
        user_wss.clients.forEach(function each(client) {
            client.send(msg);
        });
    };
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
                    console.log(D_1);
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
                    else if (D_1.Type && (D_1.Type == "snmpB")) {
                        if (!MnmsData.Switches.some(function (k) { return k.IP == D_1.IP; })) {
                            MnmsData.Switches.push({
                                Type: D_1.Type,
                                IP: D_1.IP,
                                Community: D_1.Community,
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
                            } while (found == false && idx < obj.length);
                            if (found)
                                db.update({ Type: "MnmsData" }, blankMnmsData(MnmsData), { upsert: true }, function (err, newDoc) { });
                        }
                    }
                    else if (D_1.Type == "Snapshot::select") {
                        getSnapshot(D_1.id)
                            .then(function (v) {
                            user_wss.broadcast(JSON.stringify(v));
                        });
                    }
                    else if (D_1.Type == "Snapshot::create") {
                        createSnapshot(D_1.Name)
                            .then(function (v) {
                            listSnapshots()
                                .then(function (v) { return user_wss.broadcast(JSON.stringify(v)); });
                        });
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
        listSnapshots().then(function (v) {
            ws.send(JSON.stringify(v));
            if (SelectedSnapId != 0)
                compareToSnapshot();
        });
    });
    // db and other services start
    //------------------
    var MnmsData = {
        Type: "MnmsData",
        Schema: 3,
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
            },
            snmp_switch: {
                Type: "snmpB",
                Community: "",
                IP: ""
            }
        }
    };
    var Datastore = require('nedb'), db = new Datastore({ filename: Options.database, autoload: true });
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
        artel_switch: "../artel-quarra-switch/index.js",
        snmp_switch: "../snmp-bridge/index.js"
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
            else if (type == "snmp_switch") {
                if (action == "start") {
                    console.log([ServicesDirectory[type], "-c", ServiceOptions.Params.Community, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
                    child_info = spawn("node", [ServicesDirectory[type], "-c", ServiceOptions.Params.Community, "-i", ServiceOptions.Params.IP, "-k", MnmsData.Challenge, "-y", ServiceOptions.UID]);
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
        "artelQ": "artel_switch",
        "snmpB": "snmp_switch"
    };
    var watchDog = function () {
        console.log("Waf waf");
        var now = Date.now();
        var okswitches = 0, instart = 0;
        for (var s in MnmsData.Switches) {
            if (MnmsData.Switches[s].Child) {
                if (now - MnmsData.Switches[s].Timer < 30000)
                    okswitches++;
                else if (now - MnmsData.Switches[s].StartTime < 200000)
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
                        Password: MnmsData.Switches[s].Password,
                        Community: MnmsData.Switches[s].Community
                    },
                    Challenge: MnmsData.Challenge,
                    UID: MnmsData.Switches[s].UID
                });
            }
        }
        MnmsData.OkSwitches = okswitches;
    };
    var loadStaticConfig = function () {
        try {
            var file = fs_1.readFileSync("devices.json");
            var Data = JSON.parse(file.toString());
            for (var _i = 0, Data_1 = Data; _i < Data_1.length; _i++) {
                var p = Data_1[_i];
                if (p.Name) {
                    if (p.Macs)
                        for (var i_4 = 0; i_4 < p.Macs.length; i_4++)
                            p.Macs[i_4] = p.Macs[i_4].toLowerCase();
                    var N = {
                        Name: "(S) " + p.Name,
                        Type: "disconnected",
                        IP: (p.IPs && p.IPs.length > 0) ? p.IPs[0] : "",
                        Neighbour: null,
                        Schema: 1,
                        Multicast: "off",
                        Mac: (p.Macs && p.Macs.length > 0) ? p.Macs[0] : "00:00:00:00:00:00",
                        id: "(S) " + p.Neighbour
                    };
                    if (p.IPs)
                        N.OtherIPs = p.IPs;
                    else
                        N.OtherIPs = [];
                    if (p.Macs)
                        N.Macs = p.Macs;
                    Nodes.push(N);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    loadStaticConfig();
    setInterval(watchDog, 2000);
    // Snapshot
    var getSnapshot = function (id) {
        return new Promise(function (resolve, error) {
            if (id == 0) {
                Snapshot = null;
                SelectedSnapId = 0;
                resolve({
                    Type: "MnmsSnapshot",
                    List: null,
                    Options: null,
                    Selected: id,
                    Errors: []
                });
            }
            db.find({ Type: "MnmsSnapshot", id: id }, function (err, docs) {
                console.log(docs);
                if (docs.length == 1) {
                    Snapshot = JSON.parse(docs[0].Data);
                    SelectedSnapId = id;
                    resolve({
                        Type: "MnmsSnapshot",
                        List: null,
                        Options: null,
                        Selected: id,
                        Errors: null
                    });
                }
            });
        });
    };
    var listSnapshots = function () {
        return new Promise(function (resolve, error) {
            db.find({ Type: "MnmsSnapshot" }, function (err, docs) {
                console.log(docs);
                var L = [{ Name: "no snapshot", id: 0 }];
                docs.forEach(function (element) {
                    L.push({ Name: element.Name, id: element.id });
                });
                resolve({
                    Type: "MnmsSnapshot",
                    List: L,
                    Options: null,
                    Selected: SelectedSnapId,
                    Errors: null
                });
            });
        });
    };
    var createSnapshot = function (Name) {
        console.log("Creating snapshots");
        var Snap = {
            Type: "MnmsSnapshot",
            Data: JSON.stringify(Nodes),
            Name: Name,
            id: "snap-" + Date.now()
        };
        return new Promise(function (resolve, error) {
            db.update({ Type: "MnmsSnapshot", id: Snap.id }, Snap, { upsert: true }, function (err, newDoc) {
                if (err)
                    console.log(err);
                resolve();
            });
        });
    };
    var compareToSnapshot = function () {
        var Errors = [];
        Nodes.forEach(function (node) {
            var snode = Snapshot.filter(function (k) { return k.Name == node.Name; });
            if (snode.length == 0) {
                // Device is new
                Errors.push({
                    Type: "new",
                    Name: node.Name
                });
            }
            else {
                var snap = snode[0];
                var mods_1 = [];
                var targetHasIP_1 = function (IP, target) {
                    var found = false;
                    if (target.IP == IP)
                        found = true;
                    if (target.OtherIPs && target.OtherIPs.includes(IP))
                        found = true;
                    return found;
                };
                var checkAllIPs = function (source, target) {
                    var missingIPs = [];
                    if (!targetHasIP_1(source.IP, target))
                        missingIPs.push(source.IP);
                    if (source.OtherIPs)
                        source.OtherIPs.forEach(function (i) {
                            if (!targetHasIP_1(i, target))
                                missingIPs.push(i);
                        });
                    return missingIPs;
                };
                // Checking IPs
                var missingIPs = checkAllIPs(snap, node);
                if (missingIPs.length > 0)
                    mods_1.push({ type: "missing IPs", data: missingIPs });
                var newIPs = checkAllIPs(node, snap);
                if (newIPs.length > 0)
                    mods_1.push({ type: "new IPs", data: newIPs });
                // Checking Macs
                // TO DO
                // Checking services
                // TO DO
                // Checking bandwidth on ports
                Nodes.forEach(function (n) {
                    if (n.Type == "switch") {
                        var interfaces = n.Ports.filter(function (p) { return p.Neighbour && (node.IP == p.Neighbour || (node.OtherIPs && node.OtherIPs.includes(p.Neighbour))); });
                        interfaces.forEach(function (int) {
                            var SnapSw = Snapshot.filter(function (sn) { return sn.Name == n.Name && sn.Type == "switch"; });
                            if (SnapSw.length == 0) {
                                mods_1.push({ type: "Switch changed", data: null });
                            }
                            else {
                                var snint = SnapSw[0].Ports.filter(function (pp) { return pp.Name == int.Name; });
                                if (snint.length == 0) {
                                    mods_1.push({ type: "Switch port changed", data: null });
                                }
                                else {
                                    if (int.In > snint[0].In * 1.2 || int.In < snint[0].In * 0.8)
                                        mods_1.push({ type: "Input bandwith changed", data: null });
                                    if (int.Out > snint[0].Out * 1.2 || int.Out < snint[0].Out * 0.8)
                                        mods_1.push({ type: "Output bandwith changed", data: null });
                                }
                            }
                        });
                    }
                });
                // Finalizing
                if (mods_1.length > 0)
                    Errors.push({
                        Type: "modified",
                        Name: node.Name,
                        Data: mods_1
                    });
            }
        });
        Snapshot.forEach(function (node) {
            var snode = Nodes.filter(function (k) { return k.Name == node.Name; });
            if (snode.length == 0) {
                // Device is new
                Errors.push({
                    Type: "missing",
                    Name: node.Name
                });
                node.IP = "";
                node.OtherIPs = [];
                node.Macs = [];
                node.Mac = "";
                node.Type = "disconnected";
                mergeNodes(null, node, null);
            }
        });
        if (Errors.length > 0)
            user_wss.broadcast(JSON.stringify({
                Type: "MnmsSnapshot",
                List: null,
                Options: null,
                Selected: SelectedSnapId,
                Errors: Errors
            }));
    };
};
