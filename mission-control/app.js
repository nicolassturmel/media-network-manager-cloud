var mdns = require('multicast-dns')();
mdns.on('response', function (response) {
    handleResponse(response);
});
mdns.on('query', function (query) {
    //console.log(query)
});
var Host = {};
var Services = {};
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
            if (Host[k.data.target]) {
                var subs = (Host[k.data.target].Services[k.name]) ? Host[k.data.target].Services[k.name].subs : [];
                if (Services[k.name]) {
                    refresh = (subs == Services[k.name]) ? refresh : true;
                    subs = Services[k.name];
                }
                if (!Host[k.data.target].Services[k.name])
                    refresh = true;
                Host[k.data.target].Services[k.name] = {
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
            if (!Host[k.name]) {
                Host[k.name] = {
                    IP: k.data,
                    Services: {}
                };
                refresh = true;
            }
        }
        if (refresh)
            console.log(Host);
    }
}
mdns.query({
    questions: [{
            name: '_http._tcp.local',
            type: 'SRV'
        }]
});
