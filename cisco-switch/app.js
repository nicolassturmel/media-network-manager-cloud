'use strict';
var SwitchPollTime = 1;
var Telnet = require('telnet-client');
var SwitchData = {};
var OldValue = {};
var Switch = { Ports: {}, Multicast: "off" };
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData;
var params = {
    host: '192.168.1.201',
    port: 23,
    shellPrompt: /\D+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: "cisco",
    password: "cisco",
    pageSeparator: /More: <space>,  Qu.*/,
    timeout: 0
};
var express = require("express");
var app = express();
app.use('/', express.static(__dirname + '/html'));
app.listen(3000, function () {
    console.log("Server running on port 3000");
});
app.get("/bw", function (req, res, next) {
    function waitNewData() { if (NewData == true)
        res.json(Switch);
    else
        setTimeout(waitNewData, 200); }
    waitNewData();
});
var switchTelnet = new Telnet();
var ParseState;
(function (ParseState) {
    ParseState["In"] = "In";
    ParseState["Out"] = "Out";
})(ParseState || (ParseState = {}));
function startTelenetToSwitch() {
    switchTelnet.on('ready', function (prompt) {
        StartSwitchDatamine();
    });
    switchTelnet.on('timeout', function () {
        console.log('socket timeout!');
    });
    switchTelnet.on('error', function () {
        setTimeout(startTelenetToSwitch, 2000);
    });
    switchTelnet.on('close', function () {
        console.log('connection closed');
        setTimeout(startTelenetToSwitch, 20000);
    });
    switchTelnet.connect(params);
}
function get_count() {
    var State = ParseState.In;
    switchTelnet.exec("show int coun", function (err, response) {
        var now = new Date;
        //console.log(response)
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(function () { get_count(); }, SwitchPollTime * 1000);
            return;
        }
        CountTime = now.getTime() - ClearTime;
        ClearTime = now.getTime();
        var Bit = [0];
        var CurrentPortNumber = 0;
        for (var _i = 0, array_1 = array; _i < array_1.length; _i++) {
            var str = array_1[_i];
            str = str.replace("0m", "");
            var T = str.split(/\D+/).slice(1, -1);
            if (T.length == 0) { }
            else {
                if (T.length == 1) {
                    Bit[Bit.length - 1] += T[0] + "";
                }
                else {
                    for (var j in Bit)
                        Bit[j] = parseInt(Bit[j]);
                    //console.log(Bit)
                    if (Bit[0] < CurrentPortNumber) {
                        CurrentPortNumber = 1;
                        if (State == ParseState.Out) {
                            setTimeout(getNextFct("get_count"), SwitchPollTime * 1000);
                            computeBandWidth();
                            return;
                        }
                        State = ParseState.Out;
                    }
                    if (Bit[0] == CurrentPortNumber) {
                        if (Bit[0]) {
                            if (SwitchData["gi" + CurrentPortNumber] == undefined) {
                                SwitchData["gi" + CurrentPortNumber] = {};
                                OldValue["gi" + CurrentPortNumber] = {};
                            }
                            if (SwitchData["gi" + CurrentPortNumber][State] == undefined) {
                                SwitchData["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1];
                                OldValue["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1];
                            }
                            else {
                                SwitchData["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1] - OldValue["gi" + CurrentPortNumber][State];
                                OldValue["gi" + CurrentPortNumber][State] = Bit[Bit.length - 1];
                            }
                        }
                        CurrentPortNumber++;
                    }
                    Bit = T;
                }
            }
        }
    });
}
function clear_count() {
    NewData = false;
    switchTelnet.exec("clear counters", function (err, respond) {
        console.log("c : " + respond);
        if (respond != undefined) {
            var now = new Date;
            ClearTime = now.getTime();
            setTimeout(getNextFct("clear_count"), SwitchPollTime * 1000);
        }
        else
            setTimeout(function () { clear_count(); }, SwitchPollTime * 1000);
    });
}
function computeBandWidth() {
    //console.log(CountTime)
    Object.keys(SwitchData).forEach(function (key) {
        var val = SwitchData[key];
        //console.log("Port " + key + " - In : " + Math.round(val.In*8/10/1024/1024*100)/100 + "Mb/s - Out : " +  Math.round(val.Out*8/10/1024/1024*100)/100 + "Mb/s")
        var speed = "n.c.";
        var AdminState = "n.c.";
        if (val.Speed)
            speed = val.Speed;
        if (val.AdminState)
            AdminState = val.AdminState;
        if (!Switch.Ports[key])
            Switch.Ports[key] = {};
        Switch.Ports[key] = { IGMP: { ForwardAll: val.ForwardAll, Groups: [] }, AdminState: AdminState, Speed: speed, In: Math.round(val.In * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10, Out: Math.round(val.Out * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10 };
    });
    NewData = true;
    console.log(Switch);
}
function getPortStatus() {
    switchTelnet.exec("show int status", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(function () { getPortStatus(); }, SwitchPollTime * 1000);
            return;
        }
        for (var _i = 0, array_2 = array; _i < array_2.length; _i++) {
            var line = array_2[_i];
            var port = line.split(/\s+/);
            if (port[0].startsWith("gi")) {
                SwitchData[port[0]].Speed = parseInt(port[3]);
            }
        }
        setTimeout(getNextFct("getPortStatus"), SwitchPollTime * 1000);
    });
}
function getPortConfig() {
    switchTelnet.exec("show int config", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(function () { getPortConfig(); }, SwitchPollTime * 1000);
            return;
        }
        for (var _i = 0, array_3 = array; _i < array_3.length; _i++) {
            var line = array_3[_i];
            var port = line.split(/\s+/);
            if (port[0].startsWith("gi")) {
                SwitchData[port[0]].AdminState = (port[6]);
            }
        }
        setTimeout(getNextFct("getPortConfig"), SwitchPollTime * 1000);
    });
}
function getBridgeIgmpStatus() {
    switchTelnet.exec("show bridge multicast filtering 1", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(function () { getPortConfig(); }, SwitchPollTime * 1000);
            return;
        }
        for (var _i = 0, array_4 = array; _i < array_4.length; _i++) {
            var line = array_4[_i];
            if (line.startsWith("Filtering: Enabled"))
                Switch.Multicast = "on";
            if (line.startsWith("gi")) {
                var port = line.split(/\s+/);
                SwitchData[port[0]].ForwardAll = (port[1] == "Forward") ? "Yes" : "No";
            }
        }
        setTimeout(getNextFct("getBridgeIgmpStatus"), SwitchPollTime * 1000);
    });
}
function getNextFct(current) {
    switch (current) {
        case "clear_count":
            return get_count;
        case "get_count":
            return getPortStatus;
        case "getPortStatus":
            return getPortConfig;
        case "getPortConfig":
            return getBridgeIgmpStatus;
        case "getBridgeIgmpStatus":
            return get_count;
    }
}
function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", function (err, respond) { });
    setTimeout(clear_count, 1000);
}
console.log("start");
startTelenetToSwitch();
