var udp = require('dgram');

// --------------------creating a udp server --------------------

// creating a udp server
var server = udp.createSocket('udp4');

//emits after the socket is closed using socket.close();
server.on('close',function(){
  console.log('Socket is closed !');
});

server.bind(8800);


// -------------------- udp client ----------------

var buffer = require('buffer');

// creating a client socket
var client = udp.createSocket('udp4');

//buffer msg

client.on('message',function(msg,info){
  console.log('Data received from server : ' , msg);
  console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
});

var mac=[0x6c, 0x40, 0x08, 0xaa, 0xb5, 0x04]
var init=new Uint8Array([0xff, 0xff, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5], 0x00, 0x00, 0x41, 0x75, 0x64, 0x69, 0x6e, 0x61, 0x74, 0x65, 0x07, 0x27, 0x00, 0x61, 0x00, 0x00, 0x00, 0x00])

// Handshake
var init2 = new Uint8Array([0x12, 0x00, 0x00, 0x14, 0x64, 0xb3, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5], 00,00])
//var data1 = new Uint8Array([0x27, 0x29, 0x00, 0x0a, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00])

// Asking for out streams (multicast included)
var data1 = new Uint8Array([0x27, 0x29, 0x00, 0x10, 0x00, 0x00, 0x22, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);

//sending multiple msg

server.send(init2,8800,'192.168.1.149',(error) => { 
    if(error){
        client.close();
      }else{
        console.log('Init sent !!!');
      }
    })
client.send(data1,4440,'192.168.1.149',function(error){
  if(error){
    client.close();
  }else{
    console.log('Cmd sent !!!');
  }
});