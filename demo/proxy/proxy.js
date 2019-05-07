const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const url = require('url');

function request(cReq, cRes) {
  const u = url.parse(cReq.url);

  const options = {
    hostname : u.hostname, 
    port     : u.port || 80,
    path     : u.path,       
    method   : cReq.method,
    headers  : cReq.headers
  };

  const pReq = http.request(options, function(pRes) {
    cRes.writeHead(pRes.statusCode, pRes.headers);
    pRes.pipe(cRes);
  }).on('error', function(e) {
    cRes.end();
  });

  cReq.pipe(pReq);
}

function connect(cReq, cSock) {
  const u = url.parse('http://' + cReq.url);

  const pSock = net.connect(u.port, u.hostname, function() {
    cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    pSock.pipe(cSock);
  }).on('error', function(e) {
    cSock.end();
  });

  cSock.pipe(pSock);
}

const options = {
  key  : fs.readFileSync('./private.pem'),
  cert : fs.readFileSync('./public.crt')
};

const server = https.createServer(options)
server.on('request', request)
server.on('connect', connect)
server.listen(8888);