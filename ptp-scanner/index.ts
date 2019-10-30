const dgram = require("dgram");
const process = require("process");

const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
const PORT = 320;
const MULTICAST_ADDR = "224.0.1.129";

socket.bind(PORT);

socket.on("listening", function() {
    socket.addMembership(MULTICAST_ADDR);
    const address = socket.address();
    console.log(
      `UDP socket listening on ${address.address}:${address.port} pid: ${
        process.pid
      }`
    );

    socket.on("message", function(message, rinfo) {
        console.info(`Message from: ${rinfo.address}:${rinfo.port} - ${message}`);
      });
  });