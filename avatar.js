import * as THREE from 'three';

class Avatar {
    constructor(color = 0x66ccff) {
        this.container = new THREE.Group();
        
        // Create head with face features
        this.createHead(color);
        
        // Create hands with finger joints
        this.createHands(color);
        
        // Add everything to container
        this.container.add(this.head);
        this.container.add(this.leftHand);
        this.container.add(this.rightHand);
    }

    createHead(color) {
        // Head group
        this.head = new THREE.Group();

        // Main head sphere
        const headGeometry = new THREE.SphereGeometry(0.15, 32, 32);
        const headMaterial = new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 30
        });
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        this.head.add(headMesh);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const pupilGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });

        // Left eye
        const leftEye = new THREE.Group();
        const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeMaterial);
        const leftEyePupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftEyePupil.position.z = 0.015;
        leftEye.add(leftEyeWhite);
        leftEye.add(leftEyePupil);
        leftEye.position.set(-0.05, 0.03, 0.12);
        this.head.add(leftEye);

        // Right eye
        const rightEye = new THREE.Group();
        const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeMaterial);
        const rightEyePupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightEyePupil.position.z = 0.015;
        rightEye.add(rightEyeWhite);
        rightEye.add(rightEyePupil);
        rightEye.position.set(0.05, 0.03, 0.12);
        this.head.add(rightEye);

        // Smile
        const smileGeometry = new THREE.TorusGeometry(0.05, 0.01, 8, 16, Math.PI);
        const smileMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
        const smile = new THREE.Mesh(smileGeometry, smileMaterial);
        smile.position.set(0, -0.03, 0.12);
        smile.rotation.x = -Math.PI / 2;
        this.head.add(smile);
    }

    createHands(color) {
        // Create hand groups
        this.leftHand = new THREE.Group();
        this.rightHand = new THREE.Group();

        // Hand material with better shading
        const handMaterial = new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 30
        });

        // Create palm for each hand
        const palmGeometry = new THREE.BoxGeometry(0.08, 0.02, 0.12);
        
        // Adjust palm orientation to match controller grip
        const leftPalm = new THREE.Mesh(palmGeometry, handMaterial);
        leftPalm.rotation.set(0, 0, -Math.PI / 2); // Rotate to match grip orientation
        leftPalm.position.set(0, 0, -0.05); // Move palm forward
        
        const rightPalm = new THREE.Mesh(palmGeometry, handMaterial);
        rightPalm.rotation.set(0, 0, Math.PI / 2); // Mirror rotation for right hand
        rightPalm.position.set(0, 0, -0.05); // Move palm forward

        this.leftHand.add(leftPalm);
        this.rightHand.add(rightPalm);

        // Create fingers with adjusted positions
        const fingerGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.03);
        const fingerPositions = [
            [-0.03, 0.01, -0.08], // Thumb
            [-0.02, 0.01, -0.09], // Index
            [0, 0.01, -0.09],     // Middle
            [0.02, 0.01, -0.09],  // Ring
            [0.04, 0.01, -0.09]   // Pinky
        ];

        // Add fingers to left hand
        fingerPositions.forEach(pos => {
            const finger = new THREE.Mesh(fingerGeometry, handMaterial);
            finger.position.set(...pos);
            finger.rotation.set(0, 0, -Math.PI / 2); // Align with palm
            this.leftHand.add(finger);
        });

        // Add fingers to right hand (mirror positions)
        fingerPositions.forEach(pos => {
            const finger = new THREE.Mesh(fingerGeometry, handMaterial);
            finger.position.set(-pos[0], pos[1], pos[2]); // Mirror X position
            finger.rotation.set(0, 0, Math.PI / 2); // Mirror rotation
            this.rightHand.add(finger);
        });

        // Add grip indicators
        const gripGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const gripMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        
        this.leftGrip = new THREE.Mesh(gripGeometry, gripMaterial);
        this.rightGrip = new THREE.Mesh(gripGeometry, gripMaterial);
        
        this.leftGrip.visible = false;
        this.rightGrip.visible = false;
        
        // Position grip indicators at fingertips
        this.leftGrip.position.set(0, 0, -0.09);
        this.rightGrip.position.set(0, 0, -0.09);
        
        this.leftHand.add(this.leftGrip);
        this.rightHand.add(this.rightGrip);
    }

    updatePositions(headPos, leftHandPos, rightHandPos, leftHandRot, rightHandRot, leftGrip, rightGrip, headRotation) {
        if (headPos) {
            this.head.position.copy(headPos);
            if (headRotation) {
                // Apply 180-degree rotation around Y-axis
                const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                this.head.quaternion.copy(headRotation).multiply(rotationY);
            }
        }
        if (leftHandPos && leftHandRot) {
            this.leftHand.position.copy(leftHandPos);
            this.leftHand.quaternion.copy(leftHandRot);
            if (this.leftGrip) {
                this.leftGrip.visible = leftGrip;
            }
        }
        if (rightHandPos && rightHandRot) {
            this.rightHand.position.copy(rightHandPos);
            this.rightHand.quaternion.copy(rightHandRot);
            if (this.rightGrip) {
                this.rightGrip.visible = rightGrip;
            }
        }
    }
}

export { Avatar };
