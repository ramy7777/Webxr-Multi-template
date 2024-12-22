const fs = require('fs');
const path = require('path');

const dirs = [
    'public',
    'src',
    'src/network',
    'src/xr',
    'src/utils',
    'server'
];

dirs.forEach(dir => {
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});
