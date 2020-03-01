"use strict";
/*for(let i = 0; i < 65536 ; i++) {
    let SA = false;
    let SB = false;
    if(((parseInt('0000000011000000', 2) & i) ^ parseInt('0000000000000000', 2))) SA = true
    if(((parseInt('0000000011000000', 2) & i) ^ parseInt('0000000011000000', 2))) SB = true

    if(!SA) console.log("A: not sent for " + i.toString(2))
    if(!SB)  console.log("B: not sent for " + i.toString(2))
}*/
exports.__esModule = true;
var rtp_simu_1 = require("./rtp-simu");
var R = new rtp_simu_1.RTPReceiver("239.1.1.159", 5004, 98);
setInterval(function () { return console.log(R.getInfos()); }, 2000);
