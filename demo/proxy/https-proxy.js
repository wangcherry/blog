const net = require('net');
const http = require('http');
const url = require('url');

function connect(cReq, cSock) {
    const u = url.parse('http://' + cReq.url);

    const pSock = net.connect(u.port, u.hostname, function() {
        // console.log(u);
        cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        pSock.pipe(cSock);
    }).on('error', function(e) {
        cSock.end();
    });

    cSock.pipe(pSock);
}

const server = http.createServer();

server.on('connect', connect);

server.listen(8888);
