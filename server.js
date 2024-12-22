const https = require('https');
const fs = require('fs');
const path = require('path');

const options = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

const handler = function (req, res) {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            }
            else {
                res.writeHead(500);
                res.end('Server error: '+error.code);
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
};

const server = https.createServer(options, handler);
const port = 8443;

server.listen(port, () => {
    const interfaces = require('os').networkInterfaces();
    let ipAddress = '';
    
    // Find the IPv4 address
    Object.keys(interfaces).forEach((interfaceName) => {
        interfaces[interfaceName].forEach((interface) => {
            if (interface.family === 'IPv4' && !interface.internal) {
                ipAddress = interface.address;
            }
        });
    });
    
    console.log(`Server running at https://localhost:${port}/`);
    console.log(`Access from Quest browser at https://${ipAddress}:${port}/`);
});
