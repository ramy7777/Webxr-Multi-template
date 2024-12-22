import XRScene from '../../src/xr/XRScene.js';
import XRController from '../../src/xr/XRController.js';
import PeerConnection from '../../src/network/PeerConnection.js';
import UI from '../../src/utils/UI.js';

class App {
    constructor() {
        this.xrScene = new XRScene();
        this.peerConnection = new PeerConnection();
        this.ui = new UI();
    }

    async initialize() {
        // Initialize scene
        this.xrScene.initialize();
        
        // Initialize UI
        const { input, joinButton } = this.ui.initialize();
        
        // Create main menu buttons
        this.ui.createButton('Host Game', () => this.hostGame());
        this.ui.createButton('Join Game', () => this.showJoinInput());

        // Setup join button click handler
        joinButton.addEventListener('click', () => {
            const code = input.value.trim();
            if (code.length === 4 && /^\d+$/.test(code)) {
                this.joinGame(code);
            } else {
                this.ui.showError('Please enter a valid 4-digit code');
            }
        });

        // Initialize XR controllers
        this.xrController = new XRController(this.xrScene.renderer, this.xrScene.scene);
        this.xrController.setup();

        // Setup controller event handlers
        this.xrController.onSelectStart((controllerIndex) => {
            this.broadcastControllerState(controllerIndex);
        });

        this.xrController.onSelectEnd((controllerIndex) => {
            this.broadcastControllerState(controllerIndex);
        });

        // Setup network handlers
        this.peerConnection.onData((data) => {
            if (data.type === 'controller') {
                this.xrScene.updateRemoteController(data);
            }
        });

        // Start animation loop
        this.xrScene.startAnimation(() => this.update());
    }

    async hostGame() {
        try {
            const hostCode = await this.peerConnection.hostSession();
            this.ui.showHostCode(hostCode);
        } catch (error) {
            this.ui.showError('Failed to create game session');
            console.error('Host error:', error);
        }
    }

    showJoinInput() {
        this.ui.hideError();
        this.ui.showJoinInput();
    }

    async joinGame(code) {
        try {
            await this.peerConnection.joinSession(code);
            this.ui.hide();
        } catch (error) {
            this.ui.showError('Failed to join game. Please check the code and try again.');
            console.error('Join error:', error);
        }
    }

    update() {
        // Broadcast controller states
        this.xrController.controllers.forEach((_, index) => {
            this.broadcastControllerState(index);
        });
    }

    broadcastControllerState(controllerIndex) {
        const state = this.xrController.getControllerState(controllerIndex);
        this.peerConnection.sendData({
            type: 'controller',
            ...state
        });
    }
}

// Start the application
const app = new App();
app.initialize();
