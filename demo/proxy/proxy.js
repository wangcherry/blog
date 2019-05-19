const http = require('http');
const https = require('https');
const fs = require('fs');
const net = require('net');
const url = require('url');

function request(req, res) {
  const u = url.parse(req.url);

  const options = {
    hostname : u.hostname, 
    port     : u.port || 80,
    path     : u.path,
    method   : req.method,
    headers  : req.headers
  };

  const proxyReq = http.request(options, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  }).on('error', function(e) {
    res.end();
  });

  req.pipe(proxyReq);
}

function connect(req, scok) {
  console.log('TCP连接已完成');
  const u = url.parse('http://' + req.url);

  const pSock = net.connect(u.port, u.hostname, function() {
    scok.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    pSock.pipe(scok);
  }).on('error', function(e) {
    scok.end();
  });

  scok.pipe(pSock);
}

const options = {
  key  : fs.readFileSync('./private.pem'),
  cert : fs.readFileSync('./public.crt')
};

const proxy = https.createServer(options)
proxy.on('request', request)
proxy.on('connect', connect)
proxy.listen(8888, '127.0.0.1', () => {
  const options = {
      hostname : '127.0.0.1',
      port     : 8888,
      path     : 'imququ.com:80',
      method     : 'CONNECT'
  };

  //禁用证书验证，不然自签名的证书无法建立 TLS 连接
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const req = https.request(options);
  req.end();

  req.on('connect', (res, socket, head) => {
      console.log('已连接');

      // 通过 HTTP 隧道发出请求。
      socket.write('GET / HTTP/1.1\r\n' +
          'Host: nodejs.cn:80\r\n' +
          'Connection: close\r\n' +
          '\r\n');
      socket.on('data', (chunk) => {
          console.log(chunk.toString());
      });
      socket.on('end', () => {
          proxy.close();
      });
  });
});