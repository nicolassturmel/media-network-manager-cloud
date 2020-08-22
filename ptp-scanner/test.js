
var dgram = require("dgram");

const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
const PORT = 319;
const MULTICAST_ADDR = "224.0.1.129";
const HOST = "192.168.201.3"
 
socket.on("message", function(message, rinfo) {
    console.log("message")
});

socket.on("listening", function() {
    socket.addMembership(MULTICAST_ADDR,HOST);
    const address = socket.address();
    console.log("Ready to receive")
    console.log(`server listening ${address.address}:${address.port}`);
  });
socket.bind(PORT,HOST)