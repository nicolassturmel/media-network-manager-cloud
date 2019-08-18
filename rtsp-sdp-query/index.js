"use strict";
var net = require('net'), parse = require('url').parse, transform = require('sdp-transform');
module.exports = function (url, cb) {
    var _a = parse(url), hostname = _a.hostname, port = _a.port;
    url;
    var id = 1;
    var string = "DESCRIBE " + url + " RTSP/1.0\r\nCSeq: " + id + "\r\n";
    var headers = {
        Accept: 'application/sdp'
    };
    Object.keys(headers).forEach(function (header, index) {
        string += header + ": " + headers[Object.keys(headers)[index]].toString() + "\r\n";
    });
    var client = new net.Socket();
    client.on('error', function () { cb({ "could not find": url, error: "no conection" }); });
    try {
        client.connect(port, hostname, function () {
            client.on('data', on_data);
            client.write(string + '\r\n');
        });
    }
    catch (unused) {
        cb({ "could not find": url, error: "unknown error" });
        return;
    }
    var on_data = function (data) {
        var sData = data.toString('utf8');
        var lines = sData.split('\n');
        var status = 0;
        var headers = {};
        var mediaHeaders = "";
        lines.forEach(function (line, index) {
            if (index == 0) {
                status = parseInt(line.split(' ')[1]);
                return;
            }
            if (status == 200) {
                if (line[1] === '=') {
                    mediaHeaders += line;
                }
                else {
                    var split = line.split(':');
                    var data_1 = split.slice(1).join(':').trim();
                    headers[split[0].trim()] = data_1.match(/^[0-9]+$/) ? parseInt(data_1, 10) : data_1;
                }
            }
        });
        client.destroy();
        if (status == 200)
            cb(transform.parse(mediaHeaders));
        else
            cb({ "could not find": url, error: status });
    };
};
