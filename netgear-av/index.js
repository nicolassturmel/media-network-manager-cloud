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
var axios_1 = require("axios");
var SwitchPollTime = 5;
var commandLineArgs = require('command-line-args');
var https = require("https");
// Désactiver la vérification SSL
var httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
// Command line arguments
var optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.107' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'admin' },
    { name: 'password', alias: 'p', type: String, defaultValue: '' },
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
    Info: "Netgear AV switch client",
    ServiceClass: "Switches",
    id: options.id
});
// Connecting to switch
var SwitchData = {
    oldT: 0
};
var OldValue = {};
var Switch = {
    Name: "Netgear AV",
    Type: "switch",
    IP: options.ip,
    Schema: 1,
    Ports: [],
    Multicast: "off",
    Neighbour: "",
    Mac: "",
    id: options.id,
    _Timers: [{
            path: "$",
            time: 10
        }]
};
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData;
var apiPath = options.ip + ':8443/api/v1';
function getAccessToken(username, password) {
    return __awaiter(this, void 0, void 0, function () {
        var response, accessToken, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1["default"].post("https://".concat(apiPath, "/login"), {
                            login: {
                                username: username,
                                password: password
                            }
                        }, {
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            httpsAgent: httpsAgent
                        })];
                case 1:
                    response = _a.sent();
                    accessToken = response.data.login.token;
                    return [2 /*return*/, accessToken];
                case 2:
                    error_1 = _a.sent();
                    console.error('Erreur lors de l\'obtention du jeton d\'accès:', error_1);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getDeviceInfo(token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, cpu, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    headers = {
                        'Authorization': "Bearer ".concat(token),
                        'Content-Type': 'application/json'
                    };
                    return [4 /*yield*/, axios_1["default"].get("https://".concat(apiPath, "/device_info"), { headers: headers, httpsAgent: httpsAgent })];
                case 1:
                    response = _a.sent();
                    if (response.data.resp.status != 'success') {
                        console.log("error when getting device info");
                        return [2 /*return*/];
                    }
                    Switch.Name = response.data.deviceInfo.model + ' ' + response.data.serialNumber;
                    Switch.Mac = response.data.deviceInfo.macAddr;
                    cpu = response.data.deviceInfo.cpuUsage;
                    Switch.System = {
                        CPUTemps: response.data.deviceInfo.temperatureSensors.sensorTemp,
                        CPU5s: cpu,
                        CPU1min: cpu,
                        CPU5min: cpu,
                        MemBusy: response.data.deviceInfo.memoryUsage
                    };
                    Switch.IP = options.ip;
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error('Erreur lors de la récupération de la table des adresses MAC:', error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getPorts(token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, port, rstatus, response, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    headers = {
                        'Authorization': "Bearer ".concat(token),
                        'Content-Type': 'application/json'
                    };
                    port = 1;
                    rstatus = false;
                    _a.label = 1;
                case 1: return [4 /*yield*/, axios_1["default"].get("https://".concat(apiPath, "/sw_portstats?portid=").concat(port), { headers: headers, httpsAgent: httpsAgent })];
                case 2:
                    response = _a.sent();
                    port++;
                    rstatus = (response.data.resp && (response.data.resp.status == "success"));
                    console.log(rstatus);
                    if (rstatus) {
                        // console.log(response.data.switchStatsPort)
                    }
                    _a.label = 3;
                case 3:
                    if (rstatus) return [3 /*break*/, 1];
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    console.error('Erreur lors de la récupération de ports', error_3);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function lldp(token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    headers = {
                        'Authorization': "Bearer ".concat(token),
                        'Content-Type': 'application/json'
                    };
                    console.log("fdbs");
                    return [4 /*yield*/, axios_1["default"].get("https://".concat(apiPath, "/fdbs"), { headers: headers, httpsAgent: httpsAgent })];
                case 1:
                    response = _a.sent();
                    console.log("got", response);
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Erreur lors de la récupération de la table lldp', error_4);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function template(token) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, response, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    headers = {
                        'Authorization': "Bearer ".concat(token),
                        'Content-Type': 'application/json'
                    };
                    return [4 /*yield*/, axios_1["default"].get("https://".concat(apiPath, "/device_info"), { headers: headers, httpsAgent: httpsAgent })];
                case 1:
                    response = _a.sent();
                    console.log(response);
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Erreur lors de la récupération de la table des adresses MAC:', error_5);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
getAccessToken(options.user, options.password).then(function (token) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!token) return [3 /*break*/, 4];
                console.log('Jeton d\'accès obtenu:', token);
                // Vous pouvez maintenant utiliser ce jeton pour les requêtes suivantes
                return [4 /*yield*/, getDeviceInfo(token)];
            case 1:
                // Vous pouvez maintenant utiliser ce jeton pour les requêtes suivantes
                _a.sent();
                return [4 /*yield*/, getPorts(token)];
            case 2:
                _a.sent();
                return [4 /*yield*/, lldp(token)];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
