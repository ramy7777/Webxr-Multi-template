const localtunnel = require('localtunnel');
const { spawn } = require('child_process');

// Start the HTTP server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit'
});

// Start localtunnel
(async function() {
    try {
        const tunnel = await localtunnel({ port: 3000 });
        console.log('\n=== WebXR Multiplayer App ===');
        console.log(`Access your app at: ${tunnel.url}`);
        console.log('Use this URL in both your PC browser and Quest browser');
        console.log('==========================================\n');

        tunnel.on('close', () => {
            console.log('Tunnel closed');
            process.exit(1);
        });
    } catch (err) {
        console.error('Error starting tunnel:', err);
        process.exit(1);
    }
})();
