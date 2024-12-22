import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'US' },
    { name: 'organizationName', value: 'WebXR Dev' },
];

const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256'
});

// Create cert directory if it doesn't exist
const certDir = path.join(__dirname, '..', 'cert');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);

console.log('Certificate files generated successfully in cert/ directory!');
