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