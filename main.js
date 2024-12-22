import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

let scene, camera, renderer;
let controllers = [];
let peer;
let connection;
let isHost = false;
let availableRooms = new Set();
const DISCOVERY_SERVER_ID = 'webxr-discovery-1234'; // Fixed discovery server ID
let discoveryServer = null;
let discoveryConnection = null;
const players = new Map(); // Store other players' data

// Initialize Three.js scene
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add a floor
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    setupControllers();
    setupNetwork();

    camera.position.set(0, 1.6, 3);
}

// Set up VR controllers
function setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);
        controller.userData.index = i;
        scene.add(controller);

        const grip = renderer.xr.getControllerGrip(i);
        grip.add(controllerModelFactory.createControllerModel(grip));
        scene.add(grip);

        controllers.push({ controller, grip });

        controller.addEventListener('selectstart', onSelectStart);
        controller.addEventListener('selectend', onSelectEnd);
    }
}

// Controller event handlers
function onSelectStart(event) {
    const controller = event.target;
    controller.userData.isSelecting = true;
    broadcastControllerState(controller.userData.index, true);
}

function onSelectEnd(event) {
    const controller = event.target;
    controller.userData.isSelecting = false;
    broadcastControllerState(controller.userData.index, false);
}

// Generate a random 4-digit room ID
function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Networking setup
function setupNetwork() {
    // Create peer with random ID for actual gameplay
    peer = new Peer(generateRoomId());
    
    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        setupUIHandlers(id);
        
        // Try to connect to discovery server first
        console.log('Attempting to connect to discovery server...');
        connectToDiscoveryServer().then(() => {
            if (isHost) {
                registerRoom(id);
            }
        }).catch(error => {
            console.error('Error with discovery server:', error);
        });
    });

    peer.on('error', (error) => {
        console.error('Peer error:', error);
        if (error.type === 'unavailable-id') {
            // If ID is taken, try again with a new ID
            peer.destroy();
            setupNetwork();
        } else if (error.type === 'peer-unavailable') {
            if (error.message.includes(DISCOVERY_SERVER_ID)) {
                console.log('Discovery server not found, retrying connection...');
                // Wait a bit and retry the connection
                setTimeout(() => {
                    connectToDiscoveryServer().then(() => {
                        if (isHost) {
                            registerRoom(peer.id);
                        }
                    });
                }, 2000);
            } else {
                alert('Room not found or no longer available');
            }
        }
    });

    peer.on('connection', handleIncomingConnection);
}

function handleIncomingConnection(conn) {
    console.log('Received connection from:', conn.peer);
    if (isHost) {
        connection = conn;
        setupConnectionHandlers();
    } else if (discoveryServer) {
        // If we're the discovery server, handle discovery protocol
        handleDiscoveryConnection(conn);
    }
}

async function connectToDiscoveryServer() {
    // First try to connect to existing discovery server
    try {
        console.log('Trying to connect to existing discovery server...');
        const conn = peer.connect(DISCOVERY_SERVER_ID, {
            reliable: true,
            serialization: 'json'
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.close();
                // If connection times out, try to become the discovery server
                console.log('Connection timed out, attempting to become discovery server...');
                createDiscoveryServer()
                    .then(resolve)
                    .catch(reject);
            }, 5000);

            conn.on('open', () => {
                clearTimeout(timeout);
                console.log('Connected to existing discovery server');
                discoveryConnection = conn;
                setupDiscoveryClientHandlers(conn);
                resolve(conn);
            });

            conn.on('error', () => {
                clearTimeout(timeout);
                // If connection fails, try to become the discovery server
                console.log('Connection failed, attempting to become discovery server...');
                createDiscoveryServer()
                    .then(resolve)
                    .catch(reject);
            });
        });
    } catch (error) {
        console.error('Error connecting to discovery server:', error);
        return createDiscoveryServer();
    }
}

function setupDiscoveryClientHandlers(conn) {
    conn.on('data', (data) => {
        console.log('Received from discovery server:', data);
        if (data.type === 'room-list') {
            availableRooms = new Set(data.rooms);
        }
    });

    conn.on('close', () => {
        console.log('Lost connection to discovery server, attempting to reconnect...');
        setTimeout(() => {
            connectToDiscoveryServer();
        }, 2000);
    });
}

async function createDiscoveryServer() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Creating discovery server...');
            discoveryServer = new Peer(DISCOVERY_SERVER_ID, {
                reliable: true,
                serialization: 'json'
            });

            discoveryServer.on('open', () => {
                console.log('Successfully created discovery server');
                availableRooms = new Set(); // Reset rooms list
                resolve(discoveryServer);
            });

            discoveryServer.on('connection', handleDiscoveryConnection);

            discoveryServer.on('error', (error) => {
                console.error('Discovery server error:', error);
                if (error.type === 'unavailable-id') {
                    // Someone else became the discovery server first
                    discoveryServer = null;
                    console.log('Another discovery server exists, connecting as client...');
                    connectToDiscoveryServer()
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(error);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

function handleDiscoveryConnection(conn) {
    console.log('New discovery connection from:', conn.peer);
    
    conn.on('data', (data) => {
        console.log('Discovery server received:', data);
        if (data.type === 'register') {
            console.log('Registering room:', data.roomId);
            availableRooms.add(data.roomId);
            broadcastRoomList();
            
            conn.on('close', () => {
                console.log('Room closed:', data.roomId);
                availableRooms.delete(data.roomId);
                broadcastRoomList();
            });
        } else if (data.type === 'request-rooms') {
            console.log('Sending room list:', Array.from(availableRooms));
            conn.send({
                type: 'room-list',
                rooms: Array.from(availableRooms)
            });
        }
    });
}

function broadcastRoomList() {
    if (!discoveryServer) return;
    
    const roomList = Array.from(availableRooms);
    console.log('Broadcasting room list:', roomList);
    
    Object.values(discoveryServer.connections).forEach(connections => {
        connections.forEach(conn => {
            conn.send({
                type: 'room-list',
                rooms: roomList
            });
        });
    });
}

function registerRoom(roomId) {
    console.log('Attempting to register room:', roomId);
    if (discoveryConnection) {
        discoveryConnection.send({
            type: 'register',
            roomId: roomId
        });
    } else {
        console.log('No discovery connection, attempting to connect...');
        connectToDiscoveryServer().then(() => {
            registerRoom(roomId);
        });
    }
}

function hostGame(id) {
    isHost = true;
    const mainMenu = document.getElementById('mainMenu');
    const roomIdElement = document.getElementById('roomId');
    roomIdElement.textContent = `Room ID: ${id}`;
    roomIdElement.style.display = 'block';
    mainMenu.style.display = 'none';
    document.getElementById('joinMenu').style.display = 'none';

    registerRoom(id);
}

function quickJoin() {
    console.log('Attempting quick join...');
    if (!discoveryConnection) {
        connectToDiscoveryServer().then(() => {
            requestAndJoinRoom();
        });
    } else {
        requestAndJoinRoom();
    }
}

function requestAndJoinRoom() {
    if (!discoveryConnection) {
        alert('Not connected to discovery server. Please try again.');
        return;
    }

    console.log('Requesting room list...');
    discoveryConnection.send({ type: 'request-rooms' });
    
    // Wait for response
    const handleRoomList = (data) => {
        if (data.type === 'room-list') {
            console.log('Received room list:', data);
            const rooms = data.rooms.filter(id => id !== peer.id);
            if (rooms.length > 0) {
                const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
                console.log('Joining room:', randomRoom);
                joinGame(randomRoom);
            } else {
                alert('No available rooms found. Try hosting a game or joining with an ID.');
            }
            discoveryConnection.off('data', handleRoomList);
        }
    };
    
    discoveryConnection.on('data', handleRoomList);
}

function setupUIHandlers(id) {
    const mainMenu = document.getElementById('mainMenu');
    const joinMenu = document.getElementById('joinMenu');
    
    document.getElementById('hostButton').onclick = () => hostGame(id);
    document.getElementById('joinWithIdButton').onclick = () => {
        mainMenu.style.display = 'none';
        joinMenu.style.display = 'block';
    };
    document.getElementById('quickJoinButton').onclick = () => quickJoin();
    document.getElementById('joinButton').onclick = () => {
        const roomId = document.getElementById('roomIdInput').value;
        joinGame(roomId);
    };
    document.getElementById('backButton').onclick = () => {
        mainMenu.style.display = 'block';
        joinMenu.style.display = 'none';
    };

    // Input validation for room ID
    const roomIdInput = document.getElementById('roomIdInput');
    roomIdInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    });
}

function joinGame(roomId) {
    if (roomId && roomId.length === 4 && !isNaN(roomId)) {
        connection = peer.connect(roomId);
        setupConnectionHandlers();
        document.getElementById('menu').style.display = 'none';
    } else {
        alert('Please enter a valid 4-digit room ID');
    }
}

function setupConnectionHandlers() {
    connection.on('open', () => {
        console.log('Connected to peer');
    });

    connection.on('data', (data) => {
        handlePeerData(data);
    });
}

function broadcastControllerState(controllerIndex, isSelecting) {
    if (connection && connection.open) {
        connection.send({
            type: 'controller',
            index: controllerIndex,
            position: controllers[controllerIndex].controller.position.toArray(),
            rotation: controllers[controllerIndex].controller.rotation.toArray(),
            isSelecting
        });
    }
}

function handlePeerData(data) {
    if (data.type === 'controller') {
        updateRemoteController(data);
    }
}

function updateRemoteController(data) {
    let remoteController = players.get(data.index);
    
    if (!remoteController) {
        // Create new remote controller representation
        const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        remoteController = new THREE.Mesh(geometry, material);
        scene.add(remoteController);
        players.set(data.index, remoteController);
    }

    // Update remote controller position and rotation
    remoteController.position.fromArray(data.position);
    remoteController.rotation.fromArray(data.rotation);
    
    // Visual feedback for selection
    remoteController.material.color.setHex(data.isSelecting ? 0x00ff00 : 0xff0000);
}

// Animation loop
function animate() {
    renderer.setAnimationLoop(() => {
        // Update controller positions
        controllers.forEach((controllerSet, index) => {
            if (connection && connection.open) {
                broadcastControllerState(index, controllerSet.controller.userData.isSelecting);
            }
        });

        renderer.render(scene, camera);
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the application
init();
animate();
