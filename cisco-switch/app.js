"use strict";
exports.__esModule = true;
var SwitchPollTime = 0.5;
var Telnet = require('telnet-client');
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.201' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'cisco' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'cisco' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var client = require('../mnms-client-ws-interface');
client.challenge(options.key);
client.setCallback(function (data) { console.log(data); });
client.run(options.missioncontrol);
client.info({
    Info: "Cisco  switch client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var SwitchData = {};
var OldValue = {};
var Switch = {
    Type: "switch",
    IP: options.ip,
    Schema: 1,
    Ports: [],
    Multicast: "off",
    Neighbour: "",
    Mac: "",
    id: options.id
};
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData;
var params = {
    host: options.ip,
    port: 23,
    shellPrompt: /.+#/,
    loginPrompt: "User Name:",
    passwordPrompt: "Password:",
    username: options.user,
    password: options.password,
    pageSeparator: /More: <space>,  Qu.*/,
    timeout: 0,
    execTimeout: 10000
};
var switchTelnet = new Telnet();
var ParseState;
(function (ParseState) {
    ParseState["In"] = "In";
    ParseState["Out"] = "Out";
})(ParseState || (ParseState = {}));
switchTelnet.on('ready', function (prompt) {
    StartSwitchDatamine();
});
switchTelnet.on('timeout', function () {
    console.log('socket timeout!');
});
switchTelnet.on('error', function () {
});
switchTelnet.on('close', function () {
    console.log('connection closed');
    setTimeout(startTelenetToSwitch, 20000);
});
//switchTelnet.on('data', (data) => { console.log(data.toString())})
function startTelenetToSwitch() {
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
    Switch.Ports = [];
    Object.keys(SwitchData).forEach(function (key) {
        var val = SwitchData[key];
        //console.log("Port " + key + " - In : " + Math.round(val.In*8/10/1024/1024*100)/100 + "Mb/s - Out : " +  Math.round(val.Out*8/10/1024/1024*100)/100 + "Mb/s")
        var speed = "n.c.";
        var AdminState = "n.c.";
        var ConnectedMacs = [];
        if (val.ConnectedMacs)
            ConnectedMacs = val.ConnectedMacs;
        if (val.Speed)
            speed = val.Speed;
        if (val.AdminState)
            AdminState = val.AdminState;
        Switch.Ports.push({
            Name: key,
            ConnectedMacs: ConnectedMacs,
            IGMP: {
                ForwardAll: val.ForwardAll,
                Groups: val.IGMPGroups
            },
            AdminState: AdminState,
            Speed: speed,
            In: Math.round(val.In * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10,
            Out: Math.round(val.Out * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10
        });
    });
    NewData = true;
    try {
        client.send(JSON.stringify(Switch));
        console.log("OK! " + options.ip);
    }
    catch (error) {
        console.error("Waiting to reconnect to ws...");
    }
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
                SwitchData[port[0]].ForwardAll = (port[1] == "Forward") ? "on" : "off";
            }
        }
        setTimeout(getNextFct("getBridgeIgmpStatus"), SwitchPollTime * 1000);
    });
}
function getMacAddressTable() {
    switchTelnet.exec("show mac address-table ", function (err, response) {
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
        Object.keys(SwitchData).forEach(function (key) {
            SwitchData[key].ConnectedMacs = [];
        });
        for (var _i = 0, array_5 = array; _i < array_5.length; _i++) {
            var line = array_5[_i];
            var add = line.split(/\s+/);
            //console.log(add)
            if (add[1] == 1) {
                if (add[3] == 0) {
                    Switch.Mac = add[2];
                }
                else {
                    if (SwitchData[add[3]]) {
                        SwitchData[add[3]].ConnectedMacs.push(add[2]);
                    }
                }
            }
        }
        setTimeout(getNextFct("getMacAddressTable"), SwitchPollTime * 1000);
    });
}
function portList(x) {
    var list = [];
    if (!x)
        return [];
    for (var _i = 0, _a = x.split(","); _i < _a.length; _i++) {
        var e = _a[_i];
        var r = e.match(/gi(\d+)-(\d+)/);
        if (r) {
            for (var i = parseInt(r[1]); i <= parseInt(r[2]); i++)
                list.push("gi" + i);
        }
        else
            list.push(e);
    }
    return list;
}
function getMulticastSources() {
    switchTelnet.exec("show bridge multicast address-table", function (err, response) {
        if (response) {
            var tabs = response.split("\n\n");
            Object.keys(SwitchData).forEach(function (key) {
                SwitchData[key].IGMPGroups = {};
            });
            for (var i in tabs) {
                var lines = void 0;
                switch (parseInt(i)) {
                    case 5:
                        //console.log("Tab", tabs[i])
                        lines = tabs[i].split("\n");
                        lines.splice(0, 2);
                        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                            var line = lines_1[_i];
                            var toks = line.split(/\s+/);
                            if (toks.length < 3)
                                break;
                            var ps = portList(toks[3]);
                            for (var _a = 0, ps_1 = ps; _a < ps_1.length; _a++) {
                                var p = ps_1[_a];
                                SwitchData[p].IGMPGroups[toks[1]] = true;
                            }
                        }
                        break;
                    case 7:
                        lines = tabs[i].split("\n");
                        lines.splice(0, 2);
                        for (var _b = 0, lines_2 = lines; _b < lines_2.length; _b++) {
                            var line = lines_2[_b];
                            var toks = line.split(/\s+/);
                            if (toks.length < 2)
                                break;
                            var ps = portList(toks[2]);
                            for (var _c = 0, ps_2 = ps; _c < ps_2.length; _c++) {
                                var p = ps_2[_c];
                                SwitchData[p].IGMPGroups[toks[1]] = true;
                            }
                        }
                        break;
                    case 9:
                        lines = tabs[i].split("\n");
                        lines.splice(0, 2);
                        for (var _d = 0, lines_3 = lines; _d < lines_3.length; _d++) {
                            var line = lines_3[_d];
                            var toks = line.split(/\s+/);
                            if (toks.length < 3)
                                break;
                            var ps = portList(toks[3]);
                            for (var _e = 0, ps_3 = ps; _e < ps_3.length; _e++) {
                                var p = ps_3[_e];
                                SwitchData[p].IGMPGroups[toks[1]] = true;
                            }
                        }
                        break;
                    case 11:
                        lines = tabs[i].split("\n");
                        lines.splice(0, 2);
                        for (var _f = 0, lines_4 = lines; _f < lines_4.length; _f++) {
                            var line = lines_4[_f];
                            var toks = line.split(/\s+/);
                            if (toks.length < 2)
                                break;
                            var ps = portList(toks[2]);
                            for (var _g = 0, ps_4 = ps; _g < ps_4.length; _g++) {
                                var p = ps_4[_g];
                                SwitchData[p].IGMPGroups[toks[1]] = true;
                            }
                        }
                        break;
                }
            }
            setTimeout(getNextFct("getMulticastSources"), SwitchPollTime * 1000);
        }
        else {
            console.log("Oupsy, error !", err, response);
            setTimeout(getNextFct("getMulticastSources"), SwitchPollTime * 1000);
        }
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
            return getMacAddressTable;
        case "getMacAddressTable":
            return getMulticastSources;
        case "getMulticastSources":
            return get_count;
    }
}
function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", function (err, respond) {
        switchTelnet.exec("terminal width 0", function (err, respond) {
            setTimeout(clear_count, 1000);
        });
    });
}
console.log("start");
startTelenetToSwitch();
