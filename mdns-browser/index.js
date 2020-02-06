"use strict";
var arp = require('node-arp');
var dns_txt = require('dns-txt')();
var uniqid = require('uniqid');
module.exports = function (cb, _mdns) {
    var mdns;
    var Hosts = {};
    var Services = {};
    var getMacClear = true;
    var id_local = 0;
    var sendNode = function (Value) { };
    function handleResponse(response) {
        for (var _i = 0, _a = response.answers; _i < _a.length; _i++) {
            var k = _a[_i];
            handleItem(k);
        }
        for (var _b = 0, _c = response.additionals; _b < _c.length; _b++) {
            var k = _c[_b];
            handleItem(k);
        }
        function waitClearGetMac(k) {
            if (!k)
                return;
            if (!getMacClear) {
                setTimeout(function () { waitClearGetMac(k); }, 100);
            }
            else {
                getMacClear = false;
                arp.getMAC(k.data, function (err, mac) {
                    if (!err && mac.length > 12) {
                        var macout_1 = [];
                        mac.split(":").forEach(function (e, i, a) { console.log(e); if (e.length < 2)
                            macout_1[i] = "0" + e;
                        else
                            macout_1[i] = e; });
                        mac = macout_1.join(":");
                        Hosts[k.name].Macs.push(mac);
                        Hosts[k.name].Mac = mac;
                        sendNode(Hosts[k.name]);
                    }
                    getMacClear = true;
                });
            }
        }
        function handleItem(k) {
            var refresh = false;
            var HostToRefresh = null;
            //if(k.ttl == 0) console.log(k)
            if (k.type == "SRV") {
                HostToRefresh = k.data.target;
                if (Hosts[k.data.target]) {
                    if (k.ttl > 0) {
                        var subs = (Hosts[k.data.target].Services[k.name]) ? Hosts[k.data.target].Services[k.name].subs : [];
                        var txt = (Hosts[k.data.target].Services[k.name]) ? Hosts[k.data.target].Services[k.name].txt : {};
                        if (Services[k.name]) {
                            refresh = (subs == Services[k.name].subs && txt == Services[k.name].txt) ? refresh : true;
                            subs = Services[k.name].subs;
                            txt = Services[k.name].txt;
                        }
                        if (!Hosts[k.data.target].Services[k.name])
                            refresh = true;
                        Hosts[k.data.target].Services[k.name] = {
                            port: k.data.port,
                            subs: subs,
                            txt: txt
                        };
                    }
                    else {
                        if (Hosts[k.data.target].Services[k.name]) {
                            delete Hosts[k.data.target].Services[k.name];
                            refresh = true;
                        }
                    }
                }
            }
            else if (k.type == "PTR") {
                var comps_1 = k.name.split("._");
                if (k.ttl > 0) {
                    if (comps_1[1] == "sub") {
                        if (!Services[k.data]) {
                            Services[k.data] = {};
                            Services[k.data].subs = [];
                            Services[k.data].txt = null;
                        }
                        if (!Services[k.data].subs.some(function (p) { return p === comps_1[0]; }) && comps_1[2] == "http")
                            Services[k.data].subs.push(comps_1[0]);
                    }
                }
                else {
                    if (Services[k.data]) {
                        Object.keys(Hosts).forEach(function (key) {
                            if (Hosts[key].Services[k.data]) {
                                refresh = true;
                                HostToRefresh = key;
                                delete Hosts[key].Services[k.data];
                            }
                        });
                        delete Services[k.data];
                    }
                }
                //console.log(k)
            }
            else if (k.type == "TXT") {
                if (!Services[k.name]) {
                    Services[k.name] = {};
                    Services[k.name].subs = [];
                    Services[k.name].txt = null;
                }
                if (k.data.length > 0) {
                    var str = Buffer.allocUnsafe(0);
                    for (var _i = 0, _a = k.data; _i < _a.length; _i++) {
                        var s = _a[_i];
                        var size = Buffer.allocUnsafe(1);
                        size.writeUInt8(s.length, 0);
                        str = Buffer.concat([str, size], str.length + size.length);
                        str = Buffer.concat([str, s], str.length + s.length);
                    }
                    Services[k.name].txt = dns_txt.decode(str);
                }
            }
            else if (k.type == "A") {
                //console.log(k)
                var getmac = false;
                HostToRefresh = k.name;
                if (k.ttl > 0) {
                    if (!Hosts[k.name] || Hosts[k.name].Type == "disconnected") {
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
                        };
                        getmac = true;
                    }
                    else if (Hosts[k.name].IP != k.data) {
                        if (!Hosts[k.name].OtherIPs.some(function (p) { return p == k.data; })) {
                            Hosts[k.name].OtherIPs.push(Hosts[k.name].IP);
                            Hosts[k.name].IP = k.data;
                            getmac = true;
                        }
                    }
                    if (getmac) {
                        waitClearGetMac(k);
                    }
                }
                else {
                    console.log("ttl 0");
                    if (Hosts[k.name]) {
                        Hosts[k.name].Type == "disconnected";
                        refresh = true;
                    }
                }
            }
            if (refresh) {
                if (HostToRefresh != null) {
                    sendNode(Hosts[HostToRefresh]);
                    //console.log(Nodes)
                }
            }
        }
    }
    if (!cb) {
        console.log("Error, empty callback given");
        return;
    }
    if (_mdns) {
        mdns = _mdns;
    }
    else {
        mdns = require('multicast-dns')();
    }
    mdns.on('response', function (response) {
        handleResponse(response);
    });
    sendNode = cb;
    var servToScan = {
        serv: "_csco-sb._tcp.local",
        next: {
            serv: '_telnet._tcp.local',
            next: {
                serv: '_rtsp._tcp.local',
                next: {
                    serv: '_http._tcp.local',
                    next: {
                        serv: '_csco-sb._tcp.local',
                        next: {
                            serv: '_ravenna._sub._http._tcp.local',
                            next: {
                                serv: '_ravenna_session._sub._rtsp._tcp.local',
                                next: {
                                    serv: '_netaudio-arc._udp.local'
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    setTimeout(function () {
        console.log("Scanning services");
        var qq = function (stq) {
            console.log(stq.serv);
            mdns.query({ questions: [{ name: stq.serv, type: 'PTR' }] });
            if (stq.next) {
                setTimeout(qq, 1000, stq.next);
            }
        };
        qq(servToScan);
    }, 1000);
    setTimeout(function () {
        console.log("Scanning services");
        var qq = function (stq) {
            console.log(stq.serv);
            mdns.query({ questions: [{ name: stq.serv, type: 'PTR' }] });
            if (stq.next) {
                setTimeout(qq, 1000, stq.next);
            }
        };
        qq(servToScan);
    }, 30000);
};
