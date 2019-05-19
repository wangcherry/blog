---
title: nodejs实现http和https代理服务
date: 2019-04-30 10:22:55
categories:
    - 前端
tags: 
    - node
---

## http/https协议

作为一个程序员，我们经常会使用到代理，例如将本地请求转到线上环境以复现bug；或将某些请求转发到指定服务器等。那么代理转发的实现原理是什么呢？下面将介绍nodejs如何实现http和https代理服务。

关于HTTP和HTTPS协议：

HTTP(Hypertext Transfer Protocol，超文本传输协议) 在OSI七层模型属于应用层协议，在网络与传输层使用可靠的数据传输协议TCP/IP，HTTP协议采用明文传输信息的方式。

HTTPS (Secure Hypertext Transfer Protocol，安全超文本传输协议）是一个安全通信通道，基于HTTP开发，用于在客户端和服务器之间交换信息时采用安全套接字层(SSL)进行信息交换。通俗地讲，HTTPS是HTTP的安全版，即使用了TLS/SSL加密的HTTP协议。

## http/https代理原理

下面主要介绍两种代理实现，一种是“中间人”代理（《http权威指南》第六章），还有一种是隧道代理（《http权威指南》第八章）

### “中间人”代理

MITM（中间人）代理在实际开发和测试中经常会使用。调试接口、查看HTTP请求与响应时使用的http抓包调试工具如：Fiddler、 Charles，就是基于该原理实现的。用户通过设置代理，网络请求就会通过中间人代理，再发往正式服务器。

所以我们的实现原理就是**建立一个可以同时与客户端和服务端进行通信的网络服务**。

中间人代理示意图（来源于《HTTP权威指南》）：

![](http://mailshark.nos-jd.163yun.com/document/static/5B345D71EFA7AF8C3DDA5B4FE5434BD7.webp)

HTTP客户端会向代理发送请求报文，代理服务器必须像Web服务器一样，正确的处理请求和连接，然后返回响应。同时，代理自身要向服务器发送请求，这样，其行为就必须像正确的HTTP客户端一样，要发送请求并接受响应。

那么http代理的实现方案就是：

![](http://mailshark.nos-jd.163yun.com/document/static/2B7C00F90320601594FCD623CF6A4B8C.jpg)

此时的代理就是“中间人”，代理拦截到请求之后可以修改请求数据，再向服务器发起请求，获取到数据后也可以修改数据，再返回给客户端。当然，代理也可以不向服务器发起请求，而是直接返回本地的数据，那就是数据mock。

用node运行下面代码（注意需要设置开启代理）
```ts
const http = require('http');
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
        console.log('http proxy：' + options.hostname);
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    }).on('error', function(e) {
        res.end();
    });

    req.pipe(proxyReq);
}

const proxy = http.createServer(request);

proxy.listen(8888);
```

### 隧道代理

上面已经完成了HTTP代理，那么是不是将HTTP换成HTTPS就能实现HTTPS代理呢？答案是不能，首先我们来看下HTTP和HTTPS去区别：

![](http://mailshark.nos-jd.163yun.com/document/static/8F1DCA29F7FB5FE337DDFA83B6471964.jpg)

从上图可以知道HTTPS的分层是在传输层之上建立了安全层，所有的HTTP请求都在安全层上传输。所以对于http代理，我们只需要拦截请求，就可获取到报文信息从而完成转发。但是对于https请求，我们无法获取安全层数据。更多SSL/TLS协议知识可以参考[SSL/TLS协议运行机制的概述](http://www.ruanyifeng.com/blog/2014/02/ssl_tls.html)

那么我们如何转发HTTPS流量呢。方法就是在客户端和服务器之间建立一条Web隧道。Web隧道用HTTP的CONNECT方法建立起来的。

CONNECT方法请求隧道网关创建一条到达任意目的服务器和端口的TCP连接，并对客户端和服务器之间的后继数据进行盲转发。这种方法不仅是代理HTTPS请求，理论上可以代理所有基于TCP协议的请求。不过HTTP流量代理会耗费一次TCP连接，所以默认HTTP不走隧道代理。

下图显示了CONNECT方法如何建立一条到达网关的隧道（来源于《HTTP权威指南》）：

![](http://mailshark.nos-jd.163yun.com/document/static/8D7EDB84587FE23E1CB02664AE71A948.webp)

那么隧道代理的实现方案就是：

![](http://mailshark.nos-jd.163yun.com/document/static/65715FEE17BEE76A566731B117BB29D1.jpg)

第一步：客户端像http代理发起CONNECT请求。
第二步：http代理接收到CONNECT请求后与abc.com的433端口建立tcp连接。
第三步：与abc.com的433端口建立tcp连接成功，通知客户端。

隧道链接示例代码：
```ts
const http = require('http');
const net = require('net');
const url = require('url');

function request(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('响应内容');
}

function connect(req, cltSocket, head) {
    console.log('TCP连接已完成');
    // 连接到原始服务器。
    const srvUrl = url.parse(`http://${req.url}`);
    const srvSocket = net.connect(srvUrl.port, srvUrl.hostname, () => {
        cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-agent: Node.js-Proxy\r\n' +
            '\r\n');
        srvSocket.write(head);
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
    });
}

// 创建 HTTP 隧道代理。
const proxy = http.createServer(request);
proxy.on('connect', connect);

// 代理正在运行。
proxy.listen(8888, '127.0.0.1', () => {

    // 向隧道代理发出请求。
    const options = {
        port: 8888,
        host: '127.0.0.1',
        method: 'CONNECT',
        path: 'nodejs.cn:80'
    };

    const req = http.request(options);
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
```

### 解析HTTPS请求明文信息

如果我们需要将请求转发到指定目标服务器，那么就需要解析HTTPS的请求报文了。我们都知道SSL的三大功能：内容加密、身份验证和校验机制，校验机制依赖于 MAC（Message authentication code）校验机制，下面主要谈一下身份验证和内容加密。

首先，我们需要支持身份认证，才能建立安全连接。身份认证依赖于证书认证机制，域名证书 是每个支持HTTPS网站都需要有的一份证书，用于客户端验证该网站的安全性，而该证书通常是通过安全机构申请的，这个机构就是 CA（Certificate Authority，证书颁发机构）。在每台用户计算机的操作系统或浏览器中，都会维护一份受信任的CA列表，浏览器在获取到域名证书之后，会向CA根证书进行验证，包含在列表之中的证书，或者由列表中的证书签发的证书都会被客户端信任，如果验证通过则能正常收发请求。

客户端验证服务器证书示意图：

![](http://mailshark.nos-jd.163yun.com/document/static/0C79160D00CC86678172657A77CDC566.jpg)

由于代理服务器并没有合法的域名证书（证书只存在真实目标服务器，无法获取到），所以我们需要在代理服务器上伪造证书，实现方案是，node生成根证书，安装并信任，在拦截到https请求时，我们利用根证书动态签发域名证书，并将证书返回给浏览器，浏览器验证证书，由于域名证书是我们信任的根证书签发的，所以会验证通过。

生成根证书：
```base
openssl genrsa -out private.pem 2048
openssl req -new -x509 -key private.pem -out public.crt -days 99999
```
注意运行第二条信息时，需要填写一些证书信息，我们是本地测试，Common Name 可以填写127.0.0.1。然后安装并信任即可（安装信任证书请自行百度）

最后，我们来看下代理服务器如何解析HTTPS请求报文。我们知道，SSL的内容加密功能依赖于密钥协商机制，

报文信息加密解密示意图（简化版）：

![](http://mailshark.nos-jd.163yun.com/document/static/27FC7C77CBEC7A774610F33BBBD7DDA4.jpg)

1，建立连接时，客户端发起请求；代理拦截后生成域名证书B和私钥b，并用私钥b给证书B签名；同时，代理跟服务器建立连接；服务器用私钥a给证书A签名，并返回给代理；代理将证书B返回给客户端。随后客户端随机生成主密钥M，并用证书B加密，由主密钥生成会话密钥Q；代理拦截后用私钥b解密获得主密钥M，并随机生成主密钥N，用证书A加密发往服务器，并由主密钥生成会话密钥P；服务器解密获得主密钥N。
2，完成连接后，客户端用会话密钥Q加密请求；代理拦截后解密获得明文信息，再用会话密钥P加密发往服务器；服务器解密获得明文信息，返回数据；

到此，我们的代理就能解析HTTPS请求的明文信息了，也可以修改信息后发往目标服务器，从而实现HTTPS代理。

## 最后

代理服务器可以实现各种时髦且有用的功能。它们可以改善安全性，提高性能，节省费用。代理服务器可以看到并接触到所有流过的HTTP流量，所以代理服务器可以监视流量并对其进行修改，以实现很多有用的增值Web服务。希望以上的原理介绍可以帮助到大家更好的理解代理服务。

