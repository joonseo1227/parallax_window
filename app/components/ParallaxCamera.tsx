import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { FacePosition } from '../hooks/useFaceTracking';

interface ParallaxCameraProps {
    facePosition: FacePosition;
    facePositionRef?: React.MutableRefObject<FacePosition>; // Optional ref for high-freq updates
    screenSize?: { width: number; height: number };
}

export const ParallaxCamera = ({ facePosition, facePositionRef, screenSize = { width: 40, height: 22.5 } }: ParallaxCameraProps) => {
    const { camera } = useThree();
    const currentPos = useRef(new THREE.Vector3(0, 0, 60)); // Initial camera position (Standard Z distance)

    // Tuning parameters
    const SMOOTHING_FACTOR = 0.3; // Increased responsiveness (was 0.1)

    // Physical-ish mapping
    // Input x,y: [-1, 1]. Map to physical units relative to screen center.
    // If screen width is 40 units, logical max X movement might be +/- 40 or more.
    const SCALE_X = 30;
    const SCALE_Y = 20;

    // Z Mapping: Input Z is approximate. Map to distance range.
    // Standard monitoring distance ~60 units. 
    // Closer (~30) -> High distortion. Further (~100) -> Flat.
    const BASE_Z = 60;
    const Z_RANGE = 40; // Variation

    useFrame(() => {
        // 1. Smoothing & Target Calculation
        let targetVec: THREE.Vector3;

        // Use ref if available for latest data, otherwise prop
        const latestPos = facePositionRef?.current || facePosition;

        if (!latestPos.detected) {
            // Return to center if lost
            targetVec = new THREE.Vector3(0, 0, BASE_Z);
        } else {
            // Invert X because if I move LEFT (negative), 
            // the camera effectively moves LEFT to see transparency.
            // Wait, standard Off-Axis:
            // Eye at (px, py, pz).
            // Screen is fixed window at Z=0.

            const px = -latestPos.x * SCALE_X; // X input is normalized -1(left)..1(right). 

            const py = latestPos.y * SCALE_Y;

            // Z Logic: facePosition.z is roughly (nose.z).
            const pz = BASE_Z + (latestPos.z * Z_RANGE);

            targetVec = new THREE.Vector3(px, py, Math.max(10, pz)); // Clamp Z min 10
        }

        // Apply Smoothing
        currentPos.current.lerp(targetVec, SMOOTHING_FACTOR);

        // 2. Camera Positioning
        // Important: Camera must NEVER rotate. STRICT look down -Z.
        camera.position.copy(currentPos.current);
        camera.rotation.set(0, 0, 0);
        camera.updateMatrixWorld();

        // 3. Off-Axis Projection Matrix Calculation
        // Screen Plane: Z=0. Width=W, Height=H.
        // Dimensions relative to center (0,0,0).
        const halfW = screenSize.width / 2;
        const halfH = screenSize.height / 2;

        // Distances from camera (px, py, pz) to screen edges
        // Camera is at (px, py, pz). Looking at -Z.
        // Screen is at Z=0.
        // Near plane distance 'n'.
        // Relationship: (screen_edge - camera_pos) / (screen_z - camera_z) = (near_edge - 0) / n
        // But standard Perspective Matrix is defined at 'near' plane.
        // We map screen corners (at Z=0) to near plane (at Z = pz - near)? 
        // No, standard formula:
        // left = ( (-halfW) - px ) * (near / pz)

        const near = 0.1;
        const far = 1000.0;
        const pz = camera.position.z;

        // Avoid division by zero
        const safePz = Math.max(0.1, pz);

        const left = (-halfW - currentPos.current.x) * (near / safePz);
        const right = (halfW - currentPos.current.x) * (near / safePz);
        const top = (halfH - currentPos.current.y) * (near / safePz);
        const bottom = (-halfH - currentPos.current.y) * (near / safePz);

        camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    });

    return null;
};

