class PeerConnection {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.onDataCallback = null;
        this.onConnectedCallback = null;
        this.hostCode = null;
    }

    generateHostCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    async initialize() {
        return new Promise((resolve) => {
            this.peer = new Peer();
            this.peer.on('open', (id) => {
                console.log('Connected to PeerJS server with ID:', id);
                resolve();
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this._setupConnectionHandlers();
            });
        });
    }

    async hostSession() {
        await this.initialize();
        this.hostCode = this.generateHostCode();
        // Store the mapping between host code and peer ID
        sessionStorage.setItem(`host_${this.hostCode}`, this.peer.id);
        return this.hostCode;
    }

    async joinSession(hostCode) {
        await this.initialize();
        // Get the actual peer ID from the host code
        const hostPeerId = sessionStorage.getItem(`host_${hostCode}`);
        if (!hostPeerId) {
            throw new Error('Invalid host code or host not found');
        }
        this.connection = this.peer.connect(hostPeerId);
        this._setupConnectionHandlers();
    }

    sendData(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    onData(callback) {
        this.onDataCallback = callback;
    }

    onConnected(callback) {
        this.onConnectedCallback = callback;
    }

    _setupConnectionHandlers() {
        this.connection.on('open', () => {
            console.log('Connected to peer');
            if (this.onConnectedCallback) {
                this.onConnectedCallback();
            }
        });

        this.connection.on('data', (data) => {
            if (this.onDataCallback) {
                this.onDataCallback(data);
            }
        });
    }
}

export default PeerConnection;
