import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

class XRScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.remoteControllers = new Map();
    }

    initialize() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

        // Add a floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0x808080 })
        );
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Set camera position
        this.camera.position.set(0, 1.6, 3);

        // Handle window resize
        window.addEventListener('resize', this._onWindowResize.bind(this));
    }

    _onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateRemoteController(data) {
        let remoteController = this.remoteControllers.get(data.index);
        
        if (!remoteController) {
            const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.2);
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            remoteController = new THREE.Mesh(geometry, material);
            this.scene.add(remoteController);
            this.remoteControllers.set(data.index, remoteController);
        }

        remoteController.position.fromArray(data.position);
        remoteController.rotation.fromArray(data.rotation);
        remoteController.material.color.setHex(data.isSelecting ? 0x00ff00 : 0xff0000);
    }

    startAnimation(callback) {
        this.renderer.setAnimationLoop(() => {
            if (callback) callback();
            this.renderer.render(this.scene, this.camera);
        });
    }
}

export default XRScene;
