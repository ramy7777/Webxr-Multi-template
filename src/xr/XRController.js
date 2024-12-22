import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

class XRController {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.controllers = [];
        this.onSelectStartCallback = null;
        this.onSelectEndCallback = null;
    }

    setup() {
        const controllerModelFactory = new XRControllerModelFactory();

        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.userData.index = i;
            this.scene.add(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.scene.add(grip);

            this.controllers.push({ controller, grip });

            controller.addEventListener('selectstart', this._onSelectStart.bind(this));
            controller.addEventListener('selectend', this._onSelectEnd.bind(this));
        }
    }

    onSelectStart(callback) {
        this.onSelectStartCallback = callback;
    }

    onSelectEnd(callback) {
        this.onSelectEndCallback = callback;
    }

    _onSelectStart(event) {
        const controller = event.target;
        controller.userData.isSelecting = true;
        if (this.onSelectStartCallback) {
            this.onSelectStartCallback(controller.userData.index);
        }
    }

    _onSelectEnd(event) {
        const controller = event.target;
        controller.userData.isSelecting = false;
        if (this.onSelectEndCallback) {
            this.onSelectEndCallback(controller.userData.index);
        }
    }

    getControllerState(index) {
        const controller = this.controllers[index].controller;
        return {
            index,
            position: controller.position.toArray(),
            rotation: controller.rotation.toArray(),
            isSelecting: controller.userData.isSelecting || false
        };
    }
}

export default XRController;
