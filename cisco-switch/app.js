"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var SwitchPollTime = 600;
var Telnet = require('telnet-client');
var commandLineArgs = require('command-line-args');
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.3' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'cisco' },
    { name: 'password', alias: 'p', type: String, defaultValue: 'cisco' },
    { name: 'key', alias: 'k', type: String, defaultValue: '5kQs7H1FGtdqY1sj50Zf' },
    { name: 'id', alias: 'y', type: String, defaultValue: 'fghjkldfghjk' },
    { name: "missioncontrol", alias: "m", type: String },
    { name: "allowcontrol", alias: "c", type: Boolean }
];
var options = commandLineArgs(optionDefinitions);
console.log(options);
var client = require('../mnms-client-ws-interface');
// Commands
var SwitchCommands = [];
var SwitchBlink = false;
var SwitchBlinkTimer;
client.challenge(options.key);
client.setCallback(function (sdata) {
    var data = JSON.parse(sdata);
    if (data.action) {
        if (data.action.name == "identify") {
            console.log("Processing identify");
            SwitchBlink = !SwitchBlink;
            if (SwitchBlink) {
                SwitchCommands.push('blink off');
                SwitchBlinkTimer = setTimeout(function () { SwitchBlink = !SwitchBlink; }, data.action.parameters[0].defaultValue * 1000);
            }
            else {
                clearTimeout(SwitchBlinkTimer);
            }
        }
        else {
            console.log("Not known");
        }
    }
    else {
        console.log("no action in Data");
    }
});
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
    id: options.id,
    System: {
        CPU5s: 0,
        CPU1min: 0,
        CPU5min: 0,
        CPUSpeeds: [],
        CPUTemps: [],
        DiskBuzy: 0
    },
    _Timers: [
        {
            path: "$",
            time: 10
        }
    ],
    Actions: [
        {
            name: 'identify',
            description: 'switch leds will blink for X seconds',
            parameters: [{
                    name: 'length',
                    type: 'integer',
                    defaultValue: 20
                }],
            type: "simple"
        }
    ]
};
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
var ArpData = [];
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
            activeSleep(get_count, SwitchPollTime);
            return;
        }
        CountTime = now.getTime() - ClearTime;
        ClearTime = now.getTime();
        var previousExtractedNumbers = [0];
        var CurrentPortNumber = 0;
        for (var _i = 0, array_1 = array; _i < array_1.length; _i++) {
            var line = array_1[_i];
            var extractedNumbers = line.split(/\D+/).slice(1, -1);
            //console.log(line,extractedNumbers,previousExtractedNumbers,CurrentPortNumber)
            if (extractedNumbers.length == 0) { }
            else {
                if (previousExtractedNumbers[0] < CurrentPortNumber) {
                    CurrentPortNumber = 1;
                    if (State == ParseState.Out) {
                        activeSleep(getNextFct("get_count"), SwitchPollTime);
                        return;
                    }
                    State = ParseState.Out;
                }
                if (previousExtractedNumbers[0] == CurrentPortNumber && CurrentPortNumber != 0) {
                    //console.log("Filling ",CurrentPortNumber)
                    if (SwitchData["gi" + CurrentPortNumber] == undefined) {
                        SwitchData["gi" + CurrentPortNumber] = {};
                        OldValue["gi" + CurrentPortNumber] = {};
                    }
                    if (SwitchData["gi" + CurrentPortNumber][State] == undefined) {
                        SwitchData["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4];
                        OldValue["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4];
                    }
                    else {
                        SwitchData["gi" + CurrentPortNumber][State] = (Math.pow(2, 32) + previousExtractedNumbers[4] - OldValue["gi" + CurrentPortNumber][State]) % Math.pow(2, 32);
                        OldValue["gi" + CurrentPortNumber][State] = previousExtractedNumbers[4];
                    }
                }
                CurrentPortNumber++;
                previousExtractedNumbers = extractedNumbers;
            }
        }
        activeSleep(get_count, SwitchPollTime);
    });
}
function clear_count() {
    NewData = false;
    switchTelnet.exec("clear counters", function (err, respond) {
        console.log("c : " + respond);
        if (respond != undefined) {
            var now = new Date;
            ClearTime = now.getTime();
            activeSleep(getNextFct("clear_count"), SwitchPollTime);
        }
        else
            activeSleep(function () { clear_count(); }, 500);
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
        var p = Switch.Ports.push({
            Name: key,
            ConnectedMacs: ConnectedMacs,
            IGMP: {
                ForwardAll: val.ForwardAll,
                Groups: val.IGMPGroups
            },
            Vlan: val.Vlan,
            AdminState: AdminState,
            Speed: speed,
            In: Math.round(val.In * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10,
            Out: Math.round(val.Out * 8 / CountTime / 1024 / 1024 * 10 * 1000) / 10
        });
        if (val.Neighbour)
            Switch.Ports[p - 1].Neighbour = val.Neighbour;
    });
    NewData = true;
    console.log(Switch);
    try {
        Switch._Timers[0].time = client.getSendInterval();
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
            activeSleep(function () { getPortStatus(); }, SwitchPollTime);
            return;
        }
        for (var _i = 0, array_2 = array; _i < array_2.length; _i++) {
            var line = array_2[_i];
            var port = line.split(/\s+/);
            if (port[0].startsWith("gi")) {
                SwitchData[port[0]].Speed = parseInt(port[3]);
            }
        }
        activeSleep(getNextFct("getPortStatus"), SwitchPollTime);
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
            activeSleep(function () { getPortConfig(); }, SwitchPollTime);
            return;
        }
        for (var _i = 0, array_3 = array; _i < array_3.length; _i++) {
            var line = array_3[_i];
            var port = line.split(/\s+/);
            if (port[0].startsWith("gi")) {
                SwitchData[port[0]].AdminState = (port[6]);
            }
        }
        activeSleep(getNextFct("getPortConfig"), SwitchPollTime);
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
            activeSleep(function () { getPortConfig(); }, SwitchPollTime);
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
        activeSleep(getNextFct("getBridgeIgmpStatus"), SwitchPollTime);
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
            setTimeout(function () { getPortConfig(); }, SwitchPollTime);
            return;
        }
        Object.keys(SwitchData).forEach(function (key) {
            SwitchData[key].ConnectedMacs = [];
        });
        for (var _i = 0, array_5 = array; _i < array_5.length; _i++) {
            var line = array_5[_i];
            var add = line.split(/\s+/);
            if (add.length == 6) {
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
        activeSleep(getNextFct("getMacAddressTable"), SwitchPollTime);
    });
}
function getArp() {
    switchTelnet.exec("show arp ", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            activeSleep(function () { getPortConfig(); }, SwitchPollTime);
            return;
        }
        ArpData = [];
        var Ports = {};
        for (var _i = 0, array_6 = array; _i < array_6.length; _i++) {
            var line = array_6[_i];
            var add = line.split(/\s+/);
            if (add.length >= 7) {
                if (!Ports[add[2]])
                    Ports[add[2]] = [];
                Ports[add[2]].push(add[3]);
                ArpData.push({ Ip: add[3], Mac: add[4] });
                console.log(ArpData);
            }
        }
        client.send(JSON.stringify({ Type: "ARP", Data: ArpData }));
        activeSleep(getNextFct("getArp"), SwitchPollTime);
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
            activeSleep(getNextFct("getMulticastSources"), SwitchPollTime);
        }
        else {
            console.log("Oupsy, error !", err, response);
            activeSleep(getNextFct("getMulticastSources"), SwitchPollTime);
        }
    });
}
function getLLDP() {
    switchTelnet.exec("show lldp neig", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(function () { getPortConfig(); }, SwitchPollTime);
            return;
        }
        for (var _i = 0, array_7 = array; _i < array_7.length; _i++) {
            var line = array_7[_i];
            var toks = line.split(/\s+/);
            if (SwitchData[toks[0]]) {
                if (SwitchData[toks[0]].ConnectedMacs.includes(toks[1])) {
                    SwitchData[toks[0]].ConnectedMacs = [toks[1]];
                }
                else {
                    //console.log("Error " + toks[0] +  ", not in array",toks[1],SwitchData[toks[0]].ConnectedMacs)
                }
            }
            else {
                //console.log("not found",toks[0])
            }
        }
        activeSleep(getNextFct("getLLDP"), SwitchPollTime);
    });
}
function systemInfo() {
    switchTelnet.exec("show system", function (err, response) {
        var array;
        try {
            array = response.split("\n");
            if (array[3].includes("System Name"))
                Switch.Name = array[3].split(/\s+/)[2];
        }
        catch (error) {
            console.log("Response error : can not split in array");
            console.log(response);
            setTimeout(getNextFct("systemInfo"), SwitchPollTime);
            return;
        }
        var llineNumber;
        for (llineNumber in array) {
            llineNumber = parseInt(llineNumber);
            if (array[llineNumber].startsWith("Unit") && array[llineNumber].includes("Temp") && llineNumber < array.length) {
                Switch.System.CPUTemps = [parseInt(array[llineNumber + 2].split(/\s+/)[2])];
            }
        }
        setTimeout(function () { return switchTelnet.exec("show system tcam utili", function (err, response) {
            try {
                array = response.split("\n");
            }
            catch (error) {
                console.log("Response error : can not split in array");
                console.log(response);
                activeSleep(getNextFct("systemInfo"), SwitchPollTime);
                return;
            }
            Switch.System.MemBusy = parseInt(array[0].split(" ")[1]);
            setTimeout(function () { return switchTelnet.exec("show cpu util", function (err, response) {
                try {
                    array = response.split("\n");
                }
                catch (error) {
                    console.log("Response error : can not split in array");
                    console.log(response);
                    activeSleep(getNextFct("systemInfo"), SwitchPollTime);
                    return;
                }
                if (array.length >= 5) {
                    var p = array[4].split(/\s+/);
                    Switch.System.CPU5s = parseInt(p[2]);
                    Switch.System.CPU1min = parseInt(p[5]);
                    Switch.System.CPU5min = parseInt(p[8]);
                }
                activeSleep(getNextFct("systemInfo"), SwitchPollTime);
            }); }, 300);
        }); }, 300);
    });
}
function getVlans() {
    Object.keys(SwitchData).forEach(function (k) {
        SwitchData[k].Vlan = null;
    });
    var portList = function (l) {
        var it = l.replace(/\s/g, "").split(",");
        var r = [];
        for (var _i = 0, it_1 = it; _i < it_1.length; _i++) {
            var s = it_1[_i];
            if (s.startsWith("gi")) {
                var g = s.split('-');
                r.push(g[0]);
                if (g.length == 2) {
                    var start = parseInt(g[0].substr(2));
                    var stop_1 = parseInt(g[1]);
                    for (var p = start + 1; p <= stop_1; p++)
                        r.push("gi" + p);
                }
            }
        }
        return r;
    };
    switchTelnet.exec("show vlan", function (err, response) {
        var array;
        try {
            array = response.split("\n");
        }
        catch (error) {
        }
        if (!array || array.length < 3) { }
        else {
            var grid = array[3];
            var items = grid.split(" ");
            if (items.length > 3)
                for (var l = 4; l < array.length - 2; l++) {
                    var vlan = parseInt(array[l].substr(0, items[0].length));
                    var nextstop = items[0].length + 1;
                    nextstop += items[1].length + 1;
                    var taged = array[l].substr(nextstop, items[2].length);
                    nextstop += items[2].length + 1;
                    var untaged = array[l].substr(nextstop, items[3].length);
                    for (var _i = 0, _a = portList(taged); _i < _a.length; _i++) {
                        var p = _a[_i];
                        if (!SwitchData[p].Vlan)
                            SwitchData[p].Vlan = { Tagged: [], Untagged: [] };
                        SwitchData[p].Vlan.Tagged.push(vlan);
                    }
                    for (var _b = 0, _c = portList(untaged); _b < _c.length; _b++) {
                        var p = _c[_b];
                        if (!SwitchData[p].Vlan)
                            SwitchData[p].Vlan = { Tagged: [], Untagged: [] };
                        SwitchData[p].Vlan.Untagged.push(vlan);
                    }
                }
        }
        activeSleep(getNextFct("getVlans"), SwitchPollTime);
    });
}
function blink(str) {
    if (str === void 0) { str = ""; }
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        switchTelnet.exec("config", function (err, respond) {
                            console.log(err, respond);
                            console.log('trying disable poirt led:' + str + '  -->  ' + str + "disable port led");
                            switchTelnet.exec(str + "disable port led", function (err, respond) {
                                console.log(err, respond);
                                switchTelnet.exec("exit", function (err, respond) {
                                    console.log(err, respond);
                                    setTimeout(resolve, 300);
                                });
                            });
                        });
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function activeSleep(nextStep, time) {
    while (SwitchCommands.length > 0) {
        switch (SwitchCommands[0]) {
            case 'blink on':
                blink();
                setTimeout(function () { return SwitchCommands.push('blink off'); }, 1500);
                break;
            case 'blink off':
                blink("no ");
                if (SwitchBlink)
                    setTimeout(function () { return SwitchCommands.push('blink on'); }, 1500);
                break;
            default:
                break;
        }
        SwitchCommands.splice(0, 1);
    }
    if (time <= 0)
        return nextStep();
    else
        setTimeout(function () { return activeSleep(nextStep, time - 100); }, 100);
}
var cycle = 100;
function getNextFct(current) {
    //console.log(cycle)
    console.log(current);
    switch (current) {
        case "clear_count":
            return get_count;
        case "get_count":
            return getPortStatus;
        case "getPortStatus":
            return systemInfo;
        case "systemInfo":
            return getPortConfig;
        case "getPortConfig":
            return getBridgeIgmpStatus;
        case "getBridgeIgmpStatus":
            return getMacAddressTable;
        case "getMacAddressTable":
            return getLLDP;
        case "getLLDP":
            return getMulticastSources;
        case "getMulticastSources":
            computeBandWidth();
            return getVlans;
        case "getVlans":
            return getArp;
        case "getArp":
            return get_count;
    }
}
function StartSwitchDatamine() {
    switchTelnet.exec("terminal datad", function (err, respond) {
        switchTelnet.exec("terminal width 0", function (err, respond) {
            switchTelnet.exec("config", function (err, respond) {
                console.log(err, respond);
                switchTelnet.exec("no logging console", function (err, respond) {
                    console.log(err, respond);
                    switchTelnet.exec("exit", function (err, respond) {
                        console.log(err, respond);
                        setTimeout(clear_count, 1000);
                    });
                });
            });
        });
    });
}
console.log("start");
startTelenetToSwitch();
