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