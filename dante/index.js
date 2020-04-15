const udp = require('dgram')

const danteAskStreamers = (dstIp) => {
    return new Promise((resolve,reject) => {
        let streams = []
        let data1 = new Uint8Array([0x27, 0x29, 0x00, 0x10, 0x00, 0x00, 0x22, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        let client = udp.createSocket('udp4');
        client.on('message',function(msg,info){
            //console.log('Data received from server : ' , msg);
            //console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
            let p = 44
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


const danteIntroduction = (localMac,dstIp) => {
    // creating a udp server
    let server = udp.createSocket('udp4');

    //emits after the socket is closed using socket.close();
    server.on('close',function(){
        //console.log('Socket is closed !');
    });

    server.bind(8800);
    let init2 = new Uint8Array([0x12, 0x00, 0x00, 0x14, 0x64, 0xb3, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, localMac[0], localMac[1], localMac[2], localMac[3], localMac[4], localMac[5], 00,00])

    server.send(init2,8800,dstIp,(error) => { 
        if(error){
          }else{
            //console.log('Init sent !!!');
          }
        server.close()
        })
}

const parsePacketSendingStreams = (msg,p,streams) => {
    let ret = -1;
    if(p + 55 > msg.length) {
        //console.log(p,msg.length)
        return ret
    }
    let sndId = msg.readUInt16BE(p)
    let i = p+2
    if(sndId < 0 || sndId > 128) return ret;
    i+=12
    let numChan = msg.readUInt16BE(i)
    let Chans = []
    i+=4
    for(let c = 0; c < numChan; c++) {
        Chans[c] = msg.readUInt16BE(i)
        i+=2
    }
    i+=2
    let format = msg.readUInt16BE(i)
    i+=2
    let dstPort = msg.readUInt16BE(i)
    i+=2
    let dstIp = msg[i] + "." + msg[i+1] + "." + msg[i+2] + "." + msg[i+3]
    i+=12
    let Type = msg.readUInt16BE(i)
    let strType = "Dante"
    if(Type == 0x30)
    {
        //console.log("AES67 stream " + numChan + " channels to " + dstIp + ":" + dstPort)
        strType = "AES67"
        ret = i + 2 + 42
    }
    else
    {
        //console.log("Dante stream " + numChan + " channels to " + dstIp + ":" + dstPort)
        ret = i + 2 + 14
    }
    streams[sndId] = {
        "Id": sndId,
        "Address": dstIp,
        "Port": dstPort,
        "Type": strType,
        "numChan": numChan,
        "Channels": Chans
    }
    return ret
}


module.exports = (mac,dstIp) => {
    danteIntroduction(mac,"192.168.1.149")
    return danteAskStreamers("192.168.1.149")
    }
