import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HttpsServer {
    constructor(port = 8443) {
        this.port = port;
        this.options = {
            key: fs.readFileSync(path.join(__dirname, '..', 'cert', 'key.pem')),
            cert: fs.readFileSync(path.join(__dirname, '..', 'cert', 'cert.pem'))
        };
    }

    start() {
        const handler = this._createHandler();
        const server = https.createServer(this.options, handler);

        server.listen(this.port, () => {
            const ipAddress = this._getLocalIpAddress();
            console.log(`Server running at https://localhost:${this.port}/`);
            console.log(`Access from Quest browser at https://${ipAddress}:${this.port}/`);
        });
    }

    _createHandler() {
        return (req, res) => {
            let filePath = path.join(__dirname, '..', 'public', req.url === '/' ? 'index.html' : req.url);
            
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

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if(error.code === 'ENOENT') {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(500);
                        res.end('Server error: ' + error.code);
                    }
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        };
    }

    _getLocalIpAddress() {
        const interfaces = os.networkInterfaces();
        let ipAddress = '';
        
        Object.keys(interfaces).forEach((interfaceName) => {
            interfaces[interfaceName].forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ipAddress = iface.address;
                }
            });
        });
        
        return ipAddress;
    }
}

export default HttpsServer;
