import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

let scene, camera, renderer;
let controllers = [];
let peer;
let connection;
let isHost = false;
let availableRooms = new Set();
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
    peer = new Peer(generateRoomId());
    
    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        setupUIHandlers(id);
    });

    peer.on('error', (error) => {
        if (error.type === 'unavailable-id') {
            // If ID is taken, try again with a new ID
            peer.destroy();
            setupNetwork();
        }
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnectionHandlers();
    });
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

function hostGame(id) {
    isHost = true;
    const mainMenu = document.getElementById('mainMenu');
    const roomIdElement = document.getElementById('roomId');
    roomIdElement.textContent = `Room ID: ${id}`;
    roomIdElement.style.display = 'block';
    mainMenu.style.display = 'none';
    document.getElementById('joinMenu').style.display = 'none';
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

function quickJoin() {
    // Get a list of all peers
    fetch('https://0.peerjs.com/peerjs/peers')
        .then(response => response.json())
        .then(peers => {
            // Filter for valid 4-digit IDs
            const validPeers = peers.filter(id => /^\d{4}$/.test(id));
            if (validPeers.length > 0) {
                // Try to connect to the first available peer
                const randomIndex = Math.floor(Math.random() * validPeers.length);
                joinGame(validPeers[randomIndex]);
            } else {
                alert('No available rooms found. Try joining with an ID.');
            }
        })
        .catch(error => {
            console.error('Error finding rooms:', error);
            alert('Error finding rooms. Try joining with an ID.');
        });
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
