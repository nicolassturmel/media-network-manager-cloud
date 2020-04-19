const udp = require('dgram')
const os = require('os');

const danteAskStreamers = (dstIp) => {
    return new Promise((resolve,reject) => {
        let streams = []
        let data1 = new Uint8Array([0x27, 0x29, 0x00, 0x10, 0x00, 0x00, 0x22, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        let client = udp.createSocket('udp4');
        client.on('message',function(msg,info){
            //console.log('Data received from server : ' , msg);
            //console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
            let p = 0
            do {
                p = parsePacketSendingStreams(msg,p,streams)
            } while(p > 0);
            if(msg.length > 1000) {
                data1[13] = streams.length
                client.send(data1,4440,dstIp,function(error){
                    if(error){
                    client.close();
                    }else{
                    //console.log('Cmd sent !!!');
                    }
                })
            }
            else {
                client.close()
                resolve(streams)
            }
        });
        
        client.send(data1,4440,dstIp,function(error){
            if(error){
            }else{
            //console.log('Cmd sent !!!');
            }
        });
    })
}

// creating a udp server
let server = udp.createSocket('udp4');

//emits after the socket is closed using socket.close();
server.on('close',function(){
    console.log('CMC Socket is closed !');

});

// console.log("Bind 8800")
// server.bind({
//     port: 8800,
//     exclusive: false
// });

const danteIntroduction = (localMac,dstIp) => {
    return new Promise((resolve,reject) => {
 

        let init2 = new Uint8Array([0x12, 0x00, 0x00, 0x14, 0x64, 0xb3, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, localMac[0], localMac[1], localMac[2], localMac[3], localMac[4], localMac[5], 00,00])
        console.log("Ready 8800")
            server.send(init2,8800,dstIp,(error) => { 
                if(error){
                }else{
                    console.log('Init sent !!!');
                }
                setTimeout(() => {
                    resolve()
                }, 100)
            })
    })
}

const parsePacketSendingStreams = (msg,p,streams) => {
    let ret = -1;
    if(p == 0)  p = msg.readUInt16BE(12)
    if(p + 55 > msg.length) {
        //console.log(p,msg.length)
        return ret
    }
    let sndId = msg.readUInt16BE(p)
    let i = p+2
    if(sndId < 0 || sndId > 128) return ret;
    i+=10
    let numStreams = msg.readUInt16BE(i)
    i+=2
    let numChan = msg.readUInt16BE(i)
    let Chans = []
    i+=(2+2*numStreams)
    for(let c = 0; c < Math.min(numChan,8) ; c++) {
        Chans[c] = msg.readUInt16BE(i)
        i+=2
    }
    i+=(2*numStreams)
    let streamsAddr = {}
    for(let s = 0; s < numStreams; s++) {
        if(s == 0) {
            streamsAddr.format = msg.readUInt16BE(i)
            i+=2
            streamsAddr.dstPort = msg.readUInt16BE(i)
            i+=2
            streamsAddr.dstIp = msg[i] + "." + msg[i+1] + "." + msg[i+2] + "." + msg[i+3]
            i+=4
        }
        else if(s == 1) {
            i+=4
            streamsAddr.dstIp2 = msg[i] + "." + msg[i+1] + "." + msg[i+2] + "." + msg[i+3]
            i+=4
        }
        else {
            i+=8
        }
    }

    i+=8
    let Type = msg.readUInt16BE(i)
    let strType = "Dante"
    if(Type == 0x30)
    {
        //console.log("AES67 stream " + numChan + " channels to " + dstIp + ":" + dstPort)
        strType = "AES67"
        ret = i + 2 + 42
    }
    else if(Type == 0x10)
    {
        //console.log("Dante stream " + numChan + " channels to " + dstIp + ":" + dstPort)
        ret = i + 2 + 14
    }
    else if(Type == 0x3c)
    {
        ret = i + 2 + 38
        strType = "DanteUni"
    }
    else {
        console.log(p,sndId)
        throw "Dante unknown stream type: " + Type 
    }
    streams[sndId] = {
        "Id": sndId,
        "Address": streamsAddr.dstIp,
        "Port": streamsAddr.dstPort,
        "Type": strType,
        "numChan": numChan,
        "Channels": Chans,
        "numStreams": numStreams
    }
    if(numStreams > 1)
        streama[sndId].Address2 = streamsAddr.dstIp2
    return ret
}


module.exports = (dstIp) => {
    console.log("Looking or net")
    let interfaces = os.networkInterfaces()
    let len = 0
    let mac = [0, 0, 0, 0, 0, 0]
    Object.keys(interfaces).forEach(k => {
        if(!interfaces[k]) return
        let IP4 = interfaces[k].filter(l => l.family == "IPv4")
        for(i of IP4) {
            let dd = i.address
            let s = 0
            while(s < dd.length && s < dstIp.length && dd[0,s] == dstIp[0,s]) {
                if(s > len) {
                    len = s
                    mac = i.mac
                }
                s++
            }
        }
    })
    console.log("Handshake " + dstIp)
    return danteIntroduction(mac,dstIp).then(() => danteAskStreamers(dstIp))
}
