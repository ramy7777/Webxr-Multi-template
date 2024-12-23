import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { Avatar } from './avatar.js';

let scene, camera, renderer;
let controllers = [];
let peer;
let connection;
let isHost = false;
let availableRooms = new Set();
const DISCOVERY_SERVER_ID = 'webxr-discovery-1234';
let discoveryServer = null;
let discoveryConnection = null;
let isConnectingToDiscovery = false;
const players = new Map();

// Avatar-related variables
let localAvatar;
const remoteAvatars = new Map();
let lastUpdateTime = 0;
const UPDATE_RATE = 1000 / 60; // 60 updates per second for smoother movement

// Initialize Three.js scene
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add a floor
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    
    // Create local avatar
    localAvatar = new Avatar();
    localAvatar.setHeadVisibility(false); // Hide head for local player
    scene.add(localAvatar.container);
    
    // Setup VR controllers
    setupControllers();
    setupNetwork();

    camera.position.set(0, 1.6, 3);
    
    document.body.appendChild(VRButton.createButton(renderer));
    
    window.addEventListener('resize', onWindowResize, false);
}

// Set up VR controllers
function setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    // Setup controllers array to store both controller and grip references
    controllers = [
        {
            controller: renderer.xr.getController(0),
            grip: renderer.xr.getControllerGrip(0),
            model: null
        },
        {
            controller: renderer.xr.getController(1),
            grip: renderer.xr.getControllerGrip(1),
            model: null
        }
    ];

    // Setup each controller
    controllers.forEach((controllerSet, index) => {
        // Add controller for ray and events
        controllerSet.controller.addEventListener('selectstart', () => {
            controllerSet.controller.userData.isSelecting = true;
            broadcastControllerState(index, true);
        });

        controllerSet.controller.addEventListener('selectend', () => {
            controllerSet.controller.userData.isSelecting = false;
            broadcastControllerState(index, false);
        });

        scene.add(controllerSet.controller);

        // Add grip for visual representation
        controllerSet.model = controllerModelFactory.createControllerModel(controllerSet.grip);
        controllerSet.grip.add(controllerSet.model);
        scene.add(controllerSet.grip);
    });
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

function setupConnectionHandlers() {
    connection.on('open', () => {
        console.log('Connected to peer:', connection.peer);
    });

    connection.on('data', (data) => {
        if (data.type === 'avatar-update') {
            handleAvatarUpdate(connection.peer, data);
        } else if (data.type === 'controller') {
            handleControllerUpdate(connection.peer, data);
        }
    });

    connection.on('close', () => {
        console.log('Connection closed');
        removeRemoteAvatar(connection.peer);
    });
}

function handleAvatarUpdate(peerId, data) {
    let avatar = remoteAvatars.get(peerId);
    if (!avatar) {
        // Create avatar with a different color for each peer
        const peerColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
        avatar = new Avatar(peerColor);
        scene.add(avatar.container);
        remoteAvatars.set(peerId, avatar);
        console.log('Created new remote avatar for peer:', peerId);
    }

    // Convert arrays back to Three.js objects
    const headPos = new THREE.Vector3().fromArray(data.head);
    const headRot = new THREE.Quaternion().fromArray(data.headRot);
    const leftHandPos = new THREE.Vector3().fromArray(data.leftHand);
    const rightHandPos = new THREE.Vector3().fromArray(data.rightHand);
    const leftHandRot = new THREE.Quaternion().fromArray(data.leftHandRot);
    const rightHandRot = new THREE.Quaternion().fromArray(data.rightHandRot);

    // Update avatar positions and rotations
    avatar.updatePositions(
        headPos,
        leftHandPos,
        rightHandPos,
        leftHandRot,
        rightHandRot,
        data.leftGrip,
        data.rightGrip,
        headRot
    );
}

function handleControllerUpdate(peerId, data) {
    const avatar = remoteAvatars.get(peerId);
    if (avatar) {
        if (data.index === 0) {
            avatar.leftGrip.visible = data.isSelecting;
        } else {
            avatar.rightGrip.visible = data.isSelecting;
        }
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

function removeRemoteAvatar(peerId) {
    const avatar = remoteAvatars.get(peerId);
    if (avatar) {
        scene.remove(avatar.container);
        remoteAvatars.delete(peerId);
    }
}

function broadcastControllerState(controllerIndex, isSelecting) {
    if (connection && connection.open) {
        connection.send({
            type: 'controller',
            index: controllerIndex,
            isSelecting: isSelecting
        });
    }
}

function handlePeerData(data) {
    if (data.type === 'controller') {
        handleControllerUpdate(connection.peer, data);
    }
}

function handleController(controller, index) {
    if (!controller.gamepad) return;

    const gamepad = controller.gamepad;
    const thumbstick = gamepad.axes;

    // Left thumbstick for movement (index 0)
    if (index === 0) {
        // Only process if thumbstick is beyond deadzone
        if (Math.abs(thumbstick[2]) > THUMBSTICK_DEADZONE || Math.abs(thumbstick[3]) > THUMBSTICK_DEADZONE) {
            // Get the camera's forward and right vectors for movement relative to view
            const xrCamera = renderer.xr.getCamera();
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();
            
            // Extract the forward and right vectors from the camera's matrix
            forward.setFromMatrixColumn(xrCamera.matrix, 2);
            right.setFromMatrixColumn(xrCamera.matrix, 0);
            
            // Zero out y components to keep movement horizontal
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();

            // Calculate movement
            const moveX = -thumbstick[2] * MOVEMENT_SPEED;
            const moveZ = -thumbstick[3] * MOVEMENT_SPEED;

            // Apply movement
            camera.position.addScaledVector(right, moveX);
            camera.position.addScaledVector(forward, moveZ);

            // Haptic feedback for movement
            if (gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
                const intensity = Math.min(
                    Math.sqrt(moveX * moveX + moveZ * moveZ) / MOVEMENT_SPEED,
                    1.0
                ) * HAPTIC_INTENSITY.movement;
                gamepad.hapticActuators[0].pulse(intensity, HAPTIC_DURATION.movement);
            }

            // Broadcast movement to peers
            if (connection && connection.open) {
                connection.send({
                    type: 'movement',
                    position: camera.position.toArray()
                });
            }
        }
    }
    // Right thumbstick for snap rotation (index 1)
    else if (index === 1) {
        // Check for horizontal thumbstick movement beyond deadzone
        if (Math.abs(thumbstick[2]) > THUMBSTICK_DEADZONE) {
            // Store the last rotation time to prevent too frequent rotations
            const now = performance.now();
            if (!controller.userData.lastRotationTime || now - controller.userData.lastRotationTime > 250) {
                // Determine rotation direction
                const rotationDirection = thumbstick[2] > 0 ? 1 : -1;
                
                // Apply rotation to the camera
                camera.rotation.y += SNAP_ROTATION_ANGLE * rotationDirection;

                // Haptic feedback for rotation
                if (gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
                    gamepad.hapticActuators[0].pulse(HAPTIC_INTENSITY.rotation, HAPTIC_DURATION.rotation);
                }

                // Update last rotation time
                controller.userData.lastRotationTime = now;

                // Broadcast rotation to peers
                if (connection && connection.open) {
                    connection.send({
                        type: 'rotation',
                        rotation: camera.rotation.toArray()
                    });
                }
            }
        }
    }
}

// Animation loop
function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp) {
    if (renderer.xr.isPresenting) {
        // Get XR camera position for head
        const xrCamera = renderer.xr.getCamera();
        const headPos = xrCamera.position;

        // Get controller positions and rotations
        const leftController = controllers[0].controller;
        const rightController = controllers[1].controller;
        
        // Get controller grip for better hand positioning
        const leftGrip = controllers[0].grip;
        const rightGrip = controllers[1].grip;

        // Update local avatar
        if (localAvatar) {
            localAvatar.updatePositions(
                headPos,
                leftGrip.position,
                rightGrip.position,
                leftGrip.quaternion,
                rightGrip.quaternion,
                leftController.userData.isSelecting || false,
                rightController.userData.isSelecting || false,
                xrCamera.quaternion
            );
        }
        
        // Send position updates to peers at fixed rate
        if (connection && connection.open && timestamp - lastUpdateTime > UPDATE_RATE) {
            const positionData = {
                type: 'avatar-update',
                head: headPos.toArray(),
                headRot: xrCamera.quaternion.toArray(),
                leftHand: leftGrip.position.toArray(),
                rightHand: rightGrip.position.toArray(),
                leftHandRot: leftGrip.quaternion.toArray(),
                rightHandRot: rightGrip.quaternion.toArray(),
                leftGrip: leftController.userData.isSelecting || false,
                rightGrip: rightController.userData.isSelecting || false
            };
            connection.send(positionData);
            lastUpdateTime = timestamp;
        }

        // Handle controller input for movement and rotation
        controllers.forEach((controllerSet, index) => {
            handleController(controllerSet.controller, index);
        });
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();
animate();
