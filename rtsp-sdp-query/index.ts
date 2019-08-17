const net = require('net'),
    parse = require('url').parse,
    transform = require('sdp-transform') 


export = (url, cb) => {
    const { hostname, port } = parse(url);
    url;

    let id = 1;
    let string = `DESCRIBE ${url} RTSP/1.0\r\nCSeq: ${id}\r\n`;
    let headers = {
        Accept: 'application/sdp'
    }
    Object.keys(headers).forEach((header, index) => {
        string += `${header}: ${headers[Object.keys(headers)[index]].toString()}\r\n`;
    });
    let client = new net.Socket()
    client.on('error', () => {cb({"could not find" : url, error: "no conection"})})
    try {
        client.connect(port, hostname, () => {

            client.on('data', on_data);
            client.write(string + '\r\n');
        });
    } catch (unused) {
        cb({"could not find" : url, error: "unknown error"})
        return
    }
    

    let on_data = (data) => {
        let sData = data.toString('utf8');

        let lines = sData.split('\n');
        let status = 0;
        let headers = {};
        let mediaHeaders = "";

        lines.forEach((line, index) => {
            if (index == 0){
                status = parseInt(line.split(' ')[1]);
                return;
            }
            if(status == 200){
                if (line[1] === '=') {
                    mediaHeaders += line;
                } else {
                    let split = line.split(':');
                    let data = split.slice(1).join(':').trim();

                    headers[split[0].trim()] = data.match(/^[0-9]+$/) ? parseInt(data, 10) : data;
                }
            }
        });

        client.destroy()
        if(status == 200) cb(transform.parse(mediaHeaders))
        else cb({"could not find" : url, error: status})
    }
}