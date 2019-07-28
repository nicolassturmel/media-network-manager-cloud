var mdns = require('multicast-dns')();
var arp = require('node-arp');
mdns.on('response', function (response) {
    handleResponse(response);
});
mdns.on('query', function (query) {
    //console.log(query)
});
var Hosts = {};
var Services = {};
var getMacClear = true;
function handleResponse(response) {
    for (var _i = 0, _a = response.answers; _i < _a.length; _i++) {
        var k = _a[_i];
        handleItem(k);
    }
    for (var _b = 0, _c = response.additionals; _b < _c.length; _b++) {
        var k = _c[_b];
        handleItem(k);
    }
    function handleItem(k) {
        var refresh = false;
        if (k.type == "SRV") {
            //console.log(k)
            if (Hosts[k.data.target]) {
                var subs = (Hosts[k.data.target].Services[k.name]) ? Hosts[k.data.target].Services[k.name].subs : [];
                if (Services[k.name]) {
                    refresh = (subs == Services[k.name]) ? refresh : true;
                    subs = Services[k.name];
                }
                if (!Hosts[k.data.target].Services[k.name])
                    refresh = true;
                Hosts[k.data.target].Services[k.name] = {
                    port: k.data.port,
                    subs: subs
                };
            }
        }
        else if (k.type == "PTR") {
            var comps_1 = k.name.split("._");
            if (comps_1[1] == "sub") {
                if (!Services[k.data]) {
                    Services[k.data] = [];
                }
                if (!Services[k.data].some(function (p) { return p === comps_1[0]; }) && comps_1[2] == "http")
                    Services[k.data].push(comps_1[0]);
            }
            //console.log(k)
        }
        else if (k.type == "A") {
            //console.log(k)
            var getmac = false;
            if (!Hosts[k.name]) {
                Hosts[k.name] = {
                    IP: k.data,
                    Services: {},
                    OtherIPs: [],
                    Macs: []
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
                waitClearGetMac();
                function waitClearGetMac() {
                    if (!getMacClear) {
                        setTimeout(waitClearGetMac, 100);
                    }
                    else {
                        getMacClear = false;
                        arp.getMAC(k.data, function (err, mac) {
                            if (!err) {
                                Hosts[k.name].Macs.push(mac);
                            }
                            getMacClear = true;
                        });
                    }
                }
            }
        }
        if (refresh)
            console.log(Hosts);
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
