
const mdns = require('multicast-dns')()
const ws = require('ws');
var fs = require('fs');

let wsc = null;

var mc_target;
var mc_ip
var mc_port = 16060
var lookfor_target = false

let whoami = "not specified"
let challenge = "none"
let callback = (data) => {}

function run(target) {
    if(!target) {
        mdns.on('response', function(response) {
            if(response.answers.length == 1) {
                if(response.answers[0].name.startsWith('missioncontrol')) {
                    mc_port = response.answers[0].data.port
                    mc_target = response.answers[0].data.target
                    lookfor_target = true;
                    mdns.query({
                        questions:[{
                            name: mc_target,
                            type: 'A'
                        }]
                    })
                }
                if(lookfor_target) {
                    for(let k of response.answers){
                        handleItem(k)
                    }
                    for(let k of response.additionals){
                        handleItem(k)
                    }
                
                }
            }
        })
    }
    else {
        console.log('wss://' + target + ':' + mc_port)
        if(wsc == null) {
            wsc = new ws('wss://' + target + ':' + mc_port, {
                //protocolVersion: 8,
                origin: 'wss://' + target + ':' + mc_port,
                rejectUnauthorized: false,
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
                process.exit()
                //setTimeout(() => { handleItem(k)}, 2000);
            });

            wsc.on('error', function close() {
                console.log('error disconnected');
            });
        }
    }
    
    
    function handleItem(k) {
        if(k.type == "A")
            if(k.name == mc_target) {
                lookfor_target = false
                mc_ip = k.data
                console.log(mc_target)
                console.log(mc_ip)

                console.log('wss://' + k.name + ':' + mc_port)
                if(wsc == null) {
                    wsc = new ws('wss://' + k.name + ':' + mc_port, {
                        //protocolVersion: 8,
                        origin: 'wss://' + k.name + ':' + mc_port,
                        rejectUnauthorized: false,
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
                        process.exit()
                        //setTimeout(() => { handleItem(k)}, 2000);
                    });

                    wsc.on('error', function close() {
                        console.log('error disconnected');
                    });
                }
            }
    }
    
    mdns.query({
        questions:[{
            name: '_missioncontrol._socketio.local',
            type: 'SRV'
        }]
    })
}

export = {
    run: run,
    send: (data) => { if(wsc) wsc.send(data) },
    setCallback: (cb) => { callback = cb},
    whoami: (w) => {whoami = w},
    challenge: (c) => {challenge = c}
}