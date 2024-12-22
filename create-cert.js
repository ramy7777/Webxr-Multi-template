const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

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

fs.writeFileSync(path.join(__dirname, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(__dirname, 'key.pem'), pems.private);

console.log('Certificate files generated successfully!');
