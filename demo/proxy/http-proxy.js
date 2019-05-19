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