---
title: nodejs实现http和https代理服务
date: 2019-04-30 10:22:55
categories:
    - 前端
tags: 
    - node
---

## http/https协议

HTTP(Hypertext Transfer Protocol，超文本传输协议) 在OSI七层模型属于应用层协议，在网络与传输层使用可靠的数据传输协议TCP/IP，HTTP协议采用明文传输信息的方式。

HTTPS (Secure Hypertext Transfer Protocol，安全超文本传输协议）是一个安全通信通道，基于HTTP开发，用于在客户端和服务器之间交换信息时采用安全套接字层(SSL)进行信息交换。通俗地讲，HTTPS是HTTP的安全版，即使用了TLS/SSL加密的HTTP协议。

![](http://mailshark.nos-jd.163yun.com/document/static/8F1DCA29F7FB5FE337DDFA83B6471964.jpg)

从上图可以知道HTTPS的分层是在传输层之上建立了安全层，所有的HTTP请求都在安全层上传输。所以对于http代理，我们只需要拦截请求，就可获取到信息，但是对于https代理，我还需要做一些处理才能拿到请求明文信息。更多SSL/TLS协议知识可以参考[SSL/TLS协议运行机制的概述](http://www.ruanyifeng.com/blog/2014/02/ssl_tls.html)

## http/https代理原理

### “中间人”代理

MITM（中间人）代理的技术在实际开发和测试中经常会使用。调试接口、查看HTTP请求与响应时使用的http抓包调试工具如：Fiddler、 Charles，就是基于该原理实现的。用户通过设置代理，网络请求就会通过中间人代理，再发往正式服务器。

所以我们的实现原理就是**建立一个可以同时与客户端和服务端进行通信的网络服务**。

中间人代理有两种实现方式，一种如下示意图：

![](http://mailshark.nos-jd.163yun.com/document/static/5B345D71EFA7AF8C3DDA5B4FE5434BD7.webp)

那么http代理的实现方案就是：

![](http://mailshark.nos-jd.163yun.com/document/static/2B7C00F90320601594FCD623CF6A4B8C.jpg)

此时的代理就是“中间人”，代理拦截到请求之后可以修改请求数据，再向服务器发起请求，获取到数据后也可以修改数据，再返回给客户端。

```ts
const http = require('http');
const url = require('url');

function request(cReq, cRes) {
    const u = url.parse(cReq.url);

    const options = {
        hostname : u.hostname, 
        port     : u.port || 80,
        path     : u.path,
        method     : cReq.method,
        headers     : cReq.headers
    };

    const pReq = http.request(options, function(pRes) {
        // console.log(options);
        cRes.writeHead(pRes.statusCode, pRes.headers);
        pRes.pipe(cRes);
    }).on('error', function(e) {
        cRes.end();
    });

    cReq.pipe(pReq);
}

const server = http.createServer(request);

server.listen(8888);
```

另外一种实现方式是TCP隧道：

由于https请求数据在安全层上传输，我们不能像http请求那样直接解析请求报文，但是，我们可以开启一个TCP服务，监听CONNECT请求，因为应用层也是基于传输层的，所以数据在到达应用层之前会首先经过传输层，从而实现传输层数据监听。这种方式就像为客户端和服务器之间打通了一条TCP连接的隧道，作为HTTP代理对隧道里传输的内容一概不予理会，只负责传输。所以隧道代理可以代理所有基于TCP的流量，http数据也是可以监听到，不过会浪费一次TCP连接往返。

TCP隧道连接如下示意图：

![](http://mailshark.nos-jd.163yun.com/document/static/8D7EDB84587FE23E1CB02664AE71A948.webp)

那么隧道连接代码实现方案：

```ts
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

```

最后，我们还需要支持域名证书验证，才能拿到https的请求明文信息。域名证书 是每个支持HTTPS网站都需要有的一份证书，用于客户端验证该网站的安全性，而该证书通常是通过安全机构申请的，这个机构就是 CA（Certificate Authority，证书颁发机构）。在每台用户计算机的操作系统或浏览器中，都会保存一份CA列表，也就是有多个根证书，不同CA分别包含了不同的域名证书，浏览器在获取到域名证书之后，会向CA根证书进行验证，如果验证通过则能正常收发请求。所以我们需要在代理服务器上伪造证书，实现方案是，node生成根证书，安装并信任，在拦截到https请求时，我们利用根证书动态签发域名证书，并将证书返回给浏览器，浏览器验证证书，由于域名证书是我们信任的根证书签发的，所以会验证通过。于是我们也能解析请求报文了。

生成根证书：
```base
openssl genrsa -out private.pem 2048
openssl req -new -x509 -key private.pem -out public.crt -days 99999
```
安装并信任即可

伪造证书示意图：

![](http://mailshark.nos-jd.163yun.com/document/static/E62F9F910F91BD31926C2DB92DBC6F42.jpg)

那么https代理的实现方案就是：

![]()

```ts
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
```