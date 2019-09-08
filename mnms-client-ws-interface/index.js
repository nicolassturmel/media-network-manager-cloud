"use strict";
var mdns = require('multicast-dns')();
var ws = require('ws');
var fs = require('fs');
var wsc = null;
var mc_target;
var mc_ip;
var mc_port;
var lookfor_target = false;
var whoami = "not specified";
var challenge = "none";
var callback = function (data) { };
function run() {
    mdns.on('response', function (response) {
        if (response.answers.length == 1) {
            if (response.answers[0].name.startsWith('missioncontrol')) {
                mc_port = response.answers[0].data.port;
                mc_target = response.answers[0].data.target;
                lookfor_target = true;
                mdns.query({
                    questions: [{
                            name: mc_target,
                            type: 'A'
                        }]
                });
            }
            if (lookfor_target) {
                for (var _i = 0, _a = response.answers; _i < _a.length; _i++) {
                    var k = _a[_i];
                    handleItem(k);
                }
                for (var _b = 0, _c = response.additionals; _b < _c.length; _b++) {
                    var k = _c[_b];
                    handleItem(k);
                }
            }
        }
    });
    function handleItem(k) {
        if (k.type == "A")
            if (k.name == mc_target) {
                lookfor_target = false;
                mc_ip = k.data;
                console.log(mc_target);
                console.log(mc_ip);
                console.log('wss://' + k.name + ':' + mc_port);
                wsc = null;
                wsc = new ws('wss://' + k.name + ':' + mc_port, {
                    //protocolVersion: 8,
                    origin: 'wss://' + k.name + ':' + mc_port,
                    rejectUnauthorized: false
                });
                wsc.on('open', function open() {
                    wsc.send(JSON.stringify({
                        Who: whoami,
                        Challenge: challenge,
                        Type: "auth"
                    }));
                });
                wsc.on('message', function incoming(data) {
                    callback(data);
                });
                wsc.on('close', function close() {
                    console.log('close disconnected');
                    process.exit();
                    //setTimeout(() => { handleItem(k)}, 2000);
                });
                wsc.on('error', function close() {
                    console.log('error disconnected');
                });
            }
    }
    mdns.query({
        questions: [{
                name: '_missioncontrol._socketio.local',
                type: 'SRV'
            }]
    });
}
module.exports = {
    run: run,
    send: function (data) { if (wsc)
        wsc.send(data); },
    setCallback: function (cb) { callback = cb; },
    whoami: function (w) { whoami = w; },
    challenge: function (c) { challenge = c; }
};
