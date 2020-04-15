const dante = require("./index.js")


var mac=[0x6c, 0x40, 0x08, 0xaa, 0xb5, 0x04]
dante(mac,"192.168.1.149").then((streams) => console.log("Ok",streams), 200)