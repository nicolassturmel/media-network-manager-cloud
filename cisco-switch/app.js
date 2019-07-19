'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
var Telnet = require('telnet-client');
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, params;
        return __generator(this, function (_a) {
            connection = new Telnet();
            params = {
                host: '192.168.1.201',
                port: 23,
                shellPrompt: /\D+#/,
                loginPrompt: "User Name:",
                passwordPrompt: "Password:",
                username: "cisco",
                password: "cisco",
                pageSeparator: "More: <space>,  Quit: q or CTRL+Z, One line: <return> ",
                timeout: 1000
            };
            connection.on('ready', function (prompt) {
                connection.exec("show int coun", function (err, response) {
                    // let array = response.split(/\D+/)
                    var array = response.split("\n");
                    var Bit = [];
                    for (var _i = 0, array_1 = array; _i < array_1.length; _i++) {
                        var str = array_1[_i];
                        var T = str.split(/\D+/).slice(1, -1);
                        if (T.length == 0) { }
                        else {
                            if (T.length == 1) {
                                Bit[Bit.length - 1] += T[0] + "";
                                console.log(T[0]);
                            }
                            else {
                                console.log(Bit);
                                Bit = T;
                            }
                        }
                    }
                    //console.log("rep -> " + JSON.stringify(Bit)
                });
            });
            connection.on('timeout', function () {
                console.log('socket timeout!');
                connection.end();
            });
            connection.on('close', function () {
                console.log('connection closed');
            });
            connection.connect(params);
            return [2 /*return*/];
        });
    });
}
run();
